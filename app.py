import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import uuid

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Store room participants and their info
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')  # serves the HTML

@socketio.on("join-room")
def join(data):
    room = data["room"]
    user_id = data.get("userId", str(uuid.uuid4()))
    username = data.get("username", f"User_{user_id[:8]}")
    
    join_room(room)
    
    # Initialize room if it doesn't exist
    if room not in rooms:
        rooms[room] = {"users": {}, "screen_sharer": None}
    
    # Add user to room
    rooms[room]["users"][user_id] = {
        "username": username,
        "socket_id": request.sid
    }
    
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
