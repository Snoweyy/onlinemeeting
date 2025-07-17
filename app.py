from flask import Flask, render_template
from flask_socketio import SocketIO, join_room, emit
import eventlet
eventlet.monkey_patch()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@app.route('/')
def index():
    return render_template('index.html')  # serves the HTML

@socketio.on("join-room")
def join(data):
    room = data["room"]
    join_room(room)
    emit("user-joined", room=room, include_self=False)

@socketio.on("signal")
def signal(data):
    room = data["room"]
    emit("signal", data, room=room, include_self=False)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)
