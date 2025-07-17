import os
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@app.route('/')
def index():
    return "Video call server is live!"

@socketio.on("join-room")
def on_join(data):
    room = data['room']
    join_room(room)
    print(f"User joined room: {room}")
    emit("user-joined", room=room, include_self=False)

@socketio.on("signal")
def on_signal(data):
    room = data['room']
    emit("signal", data, room=room, include_self=False)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)
