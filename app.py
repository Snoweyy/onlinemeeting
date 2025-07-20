import eventlet
eventlet.monkey_patch()

import os
import uuid
import logging
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-this-in-production')

# Initialize SocketIO with modern configuration
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode="eventlet",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

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

if __name__ == "__main__":
    import os
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

#2st4aafu8Ph5ubdhMFSxeas7QIO_6GzcwQTXZkVSKa6Vgyi3c
