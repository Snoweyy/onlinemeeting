import os
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@app.route('/')
def index():
    return "SocketIO server is running!"

@socketio.on('connect')
def on_connect():
    print("A user connected")

@socketio.on('message')
def handle_message(data):
    print(f"Received message: {data}")
    socketio.send(data, broadcast=True)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
