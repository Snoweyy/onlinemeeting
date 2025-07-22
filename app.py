#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bro Meet - Modern Multi-User Video Conference Platform
Compatible with Python 3.12+ and optimized for Render.com deployment
"""

# import eventlet
# Patch before importing anything else
# eventlet.monkey_patch()

import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_socketio import SocketIO, join_room, leave_room, emit, disconnect
from flask_dance.contrib.google import make_google_blueprint, google

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app with modern configuration
app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'bro-meet-secret-key-change-in-production'),
    DEBUG=os.environ.get('FLASK_DEBUG', 'False').lower() == 'true',
    TESTING=False,
    # Security headers (disabled for development)
    SESSION_COOKIE_SECURE=False,  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax'
)

# Get port from environment (Render sets PORT)
port = int(os.environ.get('PORT', 5000))

# Initialize SocketIO with production-ready configuration
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=app.config['DEBUG'],
    engineio_logger=app.config['DEBUG'],
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1e6,  # 1MB
    allow_upgrades=True,
    transports=['websocket', 'polling']
)

# Google OAuth Configuration
google_bp = make_google_blueprint(
    client_id=os.environ.get('GOOGLE_CLIENT_ID', '1078000715877-o5migh7kbaiv59n7nndpej08f1t5gkg0.apps.googleusercontent.com'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', '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'),
    scope=["openid", "email", "profile"]
)

# OAuth event handler - must be set before blueprint registration
@google_bp.before_app_request
def load_logged_in_user():
    if google.authorized and 'google_user' not in session:
        resp = google.get('/oauth2/v2/userinfo')
        if resp.ok:
            info = resp.json()
            session['google_user'] = {
                'id': info.get('id'),
                'email': info.get('email'),
                'name': info.get('name'),
                'picture': info.get('picture')
            }
            logger.info(f"User {info.get('name')} ({info.get('email')}) logged in with Google")

app.register_blueprint(google_bp, url_prefix="/login")

# Store room participants and their info
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')  # serves the HTML

@socketio.on("join-room")
def join(data):
    try:
        room = data.get("room")
        user_id = data.get("userId", str(uuid.uuid4()))
        username = data.get("username", f"User_{user_id[:8]}")
        
        if not room:
            logger.error("No room specified in join request")
            return
        
        logger.info(f"User {username} ({user_id}) joining room {room}")
        
        join_room(room)
        
        # Initialize room if it doesn't exist
        if room not in rooms:
            rooms[room] = {"users": {}, "screen_sharer": None}
            logger.info(f"Created new room: {room}")
        
        # Add user to room
        rooms[room]["users"][user_id] = {
            "username": username,
            "socket_id": request.sid
        }
        
        logger.info(f"Room {room} now has {len(rooms[room]['users'])} users")
        
        # Notify others and send current room state
        emit("user-joined", {
            "userId": user_id, 
            "username": username,
            "roomUsers": list(rooms[room]["users"].keys()),
            "screenSharer": rooms[room]["screen_sharer"]
        }, room=room)
        
        # Send current users list to the new user
        emit("room-users", {
            "users": rooms[room]["users"],
            "screenSharer": rooms[room]["screen_sharer"]
        })
        
    except Exception as e:
        logger.error(f"Error in join-room: {str(e)}")
        emit("error", {"message": "Failed to join room"})

@socketio.on("leave-room")
def leave(data):
    room = data["room"]
    user_id = data["userId"]
    
    leave_room(room)
    
    if room in rooms and user_id in rooms[room]["users"]:
        # If leaving user was screen sharing, stop it
        if rooms[room]["screen_sharer"] == user_id:
            rooms[room]["screen_sharer"] = None
            emit("screen-share-stopped", {"userId": user_id}, room=room)
        
        del rooms[room]["users"][user_id]
        emit("user-left", {"userId": user_id}, room=room, include_self=False)
        
        # Clean up empty rooms
        if not rooms[room]["users"]:
            del rooms[room]

@socketio.on("signal")
def signal(data):
    room = data["room"]
    target_user = data.get("targetUser")
    from_user = data.get("fromUser")
    
    # Add the sender's user ID to the signal data
    signal_data = {
        "room": room,
        "fromUser": from_user or request.sid,
        "targetUser": target_user
    }
    
    # Copy the WebRTC signaling data
    if "description" in data:
        signal_data["description"] = data["description"]
    if "candidate" in data:
        signal_data["candidate"] = data["candidate"]
    
    if target_user:
        # Send signal to specific user via their socket ID
        target_socket_id = None
        if room in rooms:
            for user_id, user_data in rooms[room]["users"].items():
                if user_id == target_user:
                    target_socket_id = user_data["socket_id"]
                    break
        
        if target_socket_id:
            emit("signal", signal_data, room=target_socket_id)
        else:
            # Fallback: broadcast to room
            emit("signal", signal_data, room=room, include_self=False)
    else:
        # Broadcast to all users in room except sender
        emit("signal", signal_data, room=room, include_self=False)

@socketio.on("start-screen-share")
def start_screen_share(data):
    room = data["room"]
    user_id = data["userId"]
    username = data.get("username", "Unknown User")
    
    if room in rooms:
        rooms[room]["screen_sharer"] = user_id
        emit("screen-share-started", {
            "userId": user_id,
            "username": username
        }, room=room)

@socketio.on("stop-screen-share")
def stop_screen_share(data):
    room = data["room"]
    user_id = data["userId"]
    
    if room in rooms and rooms[room]["screen_sharer"] == user_id:
        rooms[room]["screen_sharer"] = None
        emit("screen-share-stopped", {"userId": user_id}, room=room)

# Google OAuth Routes
@app.route('/login')
def login():
    """Redirect to Google OAuth"""
    return redirect(url_for('google.login'))

# OAuth successful callback will be handled by Flask-Dance automatically
# After successful auth, it will redirect to '/' by default

@app.route('/logout')
def logout():
    """Logout user"""
    session.pop('google_user', None)
    flash('You have been logged out.', category='info')
    return redirect(url_for('index'))

@app.route('/api/user')
def get_user():
    """Get current logged-in user info"""
    if 'google_user' in session:
        return jsonify(session['google_user'])
    return jsonify(None)

# Health check endpoint for Render
@app.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'version': '2.0.0',
        'rooms': len(rooms),
        'total_users': sum(len(room['users']) for room in rooms.values())
    })

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return render_template('index.html'), 200  # Redirect to main app

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

# Disconnect handler for cleanup
@socketio.on('disconnect')
def handle_disconnect():
    """Clean up when user disconnects"""
    logger.info(f"Client {request.sid} disconnected")
    # Clean up user from all rooms
    for room_id, room_data in list(rooms.items()):
        for user_id, user_data in list(room_data['users'].items()):
            if user_data['socket_id'] == request.sid:
                logger.info(f"Removing user {user_id} from room {room_id}")
                if room_data['screen_sharer'] == user_id:
                    room_data['screen_sharer'] = None
                    emit('screen-share-stopped', {'userId': user_id}, room=room_id)
                del room_data['users'][user_id]
                emit('user-left', {'userId': user_id}, room=room_id)
                if not room_data['users']:
                    del rooms[room_id]
                break

def create_app():
    """Application factory for production deployment"""
    return app

if __name__ == "__main__":
    logger.info(f"Starting Bro Meet server on port {port}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Debug mode: {app.config['DEBUG']}")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=app.config['DEBUG'],
        use_reloader=True,  # Disable for production
        log_output=True
    )
