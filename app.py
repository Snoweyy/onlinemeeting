import eventlet
eventlet.monkey_patch()  # MUST be at the top BEFORE any other imports

from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room


eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join-room')
def handle_join(data):
    room = data['room']
    join_room(room)
    emit('user-joined', data, room=room, include_self=False)

@socketio.on('signal')
def handle_signal(data):
    room = data['room']
    emit('signal', data, room=room, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True)
