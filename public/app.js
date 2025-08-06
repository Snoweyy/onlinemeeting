class MusicRoom {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.currentUser = null;
        this.audioPlayer = document.getElementById('audio-player');
        this.isPlaying = false;
        this.currentSong = null;
        this.playlist = [];
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    initializeEventListeners() {
        // Login
        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.joinRoom();
        });

        // Enter key support for login
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        document.getElementById('room-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Music controls
        document.getElementById('play-btn').addEventListener('click', () => {
            this.playMusic();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.pauseMusic();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.nextSong();
        });

        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.uploadFile();
        });

        // URL processing
        document.getElementById('add-url-btn').addEventListener('click', () => {
            this.processURL();
        });

        // Enter key support for URL input
        document.getElementById('url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processURL();
        });

        // Audio player events
        this.audioPlayer.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        this.audioPlayer.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audioPlayer.addEventListener('ended', () => {
            this.nextSong();
        });
    }

    initializeSocketListeners() {
        this.socket.on('room-state', (data) => {
            this.handleRoomState(data);
        });

        this.socket.on('user-joined', (data) => {
            this.addMessage(`${data.username} joined the room`, 'system');
            this.updateUsersList(data.users);
        });

        this.socket.on('user-left', (data) => {
            this.addMessage(`${data.username} left the room`, 'system');
            this.updateUsersList(data.users);
        });

        this.socket.on('song-added', (data) => {
            this.addMessage(`${data.addedBy} added "${data.song.title}" to the playlist`, 'system');
            this.updatePlaylist(data.playlist);
        });

        this.socket.on('song-playing', (data) => {
            this.handleSongPlaying(data);
        });

        this.socket.on('song-paused', (data) => {
            this.handleSongPaused(data);
        });
    }

    joinRoom() {
        const username = document.getElementById('username').value.trim();
        const roomId = document.getElementById('room-id').value.trim();

        if (!username || !roomId) {
            alert('Please enter both username and room ID');
            return;
        }

        this.currentUser = username;
        this.currentRoom = roomId;

        this.socket.emit('join-room', { username, roomId });
        
        // Show music room interface
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('music-room').style.display = 'block';
        document.getElementById('current-room').textContent = roomId;
    }

    handleRoomState(data) {
        this.playlist = data.playlist;
        this.updatePlaylist(data.playlist);
        this.updateUsersList(data.users);

        if (data.currentSong) {
            this.currentSong = data.currentSong;
            this.updateCurrentSong(data.currentSong);
            this.loadAudioFile(data.currentSong);

            if (data.isPlaying) {
                // Sync playback with server time
                const serverTime = data.currentTime / 1000; // Convert to seconds
                this.audioPlayer.currentTime = serverTime;
                this.audioPlayer.play();
                this.isPlaying = true;
            }
        }
    }

    handleSongPlaying(data) {
        if (data.song) {
            this.currentSong = data.song;
            this.updateCurrentSong(data.song);
            this.loadAudioFile(data.song);

            // Sync playback
            const serverTime = data.currentTime / 1000;
            this.audioPlayer.currentTime = serverTime;
            this.audioPlayer.play();
            this.isPlaying = true;
        }
    }

    handleSongPaused(data) {
        this.audioPlayer.pause();
        this.isPlaying = false;
        const serverTime = data.currentTime / 1000;
        this.audioPlayer.currentTime = serverTime;
    }

    playMusic() {
        this.socket.emit('play-song');
    }

    pauseMusic() {
        this.socket.emit('pause-song');
    }

    nextSong() {
        this.socket.emit('next-song');
    }

    async processURL() {
        const urlInput = document.getElementById('url-input');
        const url = urlInput.value.trim();

        if (!url) {
            alert('Please enter a URL');
            return;
        }

        let endpoint;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            endpoint = '/process-youtube';
        } else if (url.includes('spotify.com')) {
            endpoint = '/process-spotify';
        } else {
            alert('Invalid URL. Please use a YouTube or Spotify link.');
            return;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (response.ok) {
                const song = await response.json();
                this.socket.emit('add-song', song);
                urlInput.value = ''; // Clear the input field
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('URL processing error:', error);
            alert('Failed to process URL');
        }
    }

    async uploadFile() {
        const fileInput = document.getElementById('file-input');
        const titleInput = document.getElementById('song-title-input');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select an audio file');
            return;
        }

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('title', titleInput.value || file.name);

        // Show upload progress
        const progressContainer = document.getElementById('upload-progress');
        const progressBar = document.getElementById('upload-progress-bar');
        progressContainer.style.display = 'block';

        try {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                }
            });

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const song = JSON.parse(xhr.responseText);
                    this.socket.emit('add-song', song);
                    
                    // Reset form
                    fileInput.value = '';
                    titleInput.value = '';
                    progressContainer.style.display = 'none';
                    progressBar.style.width = '0%';
                } else {
                    alert('Upload failed. Please try again.');
                }
            };

            xhr.onerror = () => {
                alert('Upload failed. Please try again.');
            };

            xhr.open('POST', '/upload');
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
        }
    }

    loadAudioFile(song) {
        if (!song) return;
        
        if (song.type === 'youtube' && song.streamUrl) {
            // YouTube audio stream
            this.audioPlayer.src = song.streamUrl;
            this.audioPlayer.load();
        } else if (song.type === 'spotify') {
            // Spotify: Open in new tab for each user
            if (song.url) {
                window.open(song.url, '_blank');
            }
            // No audio player needed for Spotify
            this.audioPlayer.src = '';
        } else if (song.filename) {
            // Local file upload
            this.audioPlayer.src = `/audio/${song.filename}`;
            this.audioPlayer.load();
        }
    }

    updateCurrentSong(song) {
        document.getElementById('song-title').textContent = song ? song.title : 'No song playing';
        
        // Update playlist visual indicators
        document.querySelectorAll('.song-item').forEach(item => {
            item.classList.remove('current');
        });
        
        if (song) {
            const currentItem = document.querySelector(`[data-song-id="${song.id}"]`);
            if (currentItem) {
                currentItem.classList.add('current');
            }
        }
    }

    updatePlaylist(playlist) {
        this.playlist = playlist;
        const playlistElement = document.getElementById('playlist');
        const countElement = document.getElementById('playlist-count');
        
        countElement.textContent = playlist.length;
        
        playlistElement.innerHTML = '';
        
        playlist.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            songElement.setAttribute('data-song-id', song.id);
            
            if (this.currentSong && song.id === this.currentSong.id) {
                songElement.classList.add('current');
            }
            
            const typeIcon = song.type === 'youtube' ? '🎬' : song.type === 'spotify' ? '🟢' : '📁';
            const artistInfo = song.artist ? ` - ${song.artist}` : '';
            const durationInfo = song.duration ? this.formatTime(song.duration) : 'Unknown';
            
            songElement.innerHTML = `
                <div class="song-info">
                    <h4>${typeIcon} ${song.title}${artistInfo}</h4>
                    <p>Added ${new Date(song.uploadedAt).toLocaleTimeString()} ${song.type === 'spotify' ? '(Opens in Spotify)' : ''}</p>
                </div>
                <div class="song-actions">
                    <span class="song-duration">${durationInfo}</span>
                </div>
            `;
            
            playlistElement.appendChild(songElement);
        });
    }

    updateUsersList(users) {
        const usersList = document.getElementById('users-list');
        const userCount = document.getElementById('user-count');
        
        userCount.textContent = users.length;
        
        usersList.innerHTML = '';
        users.forEach(user => {
            const userBadge = document.createElement('div');
            userBadge.className = 'user-badge';
            userBadge.textContent = user.username;
            usersList.appendChild(userBadge);
        });
    }

    updateProgress() {
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            document.getElementById('progress').style.width = progress + '%';
            document.getElementById('current-time').textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    updateDuration() {
        if (this.audioPlayer.duration) {
            document.getElementById('duration').textContent = this.formatTime(this.audioPlayer.duration);
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    addMessage(text, type = 'user') {
        const messagesContainer = document.getElementById('messages');
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (type === 'system') {
            message.innerHTML = `
                <span class="time">${timeString}</span>
                ${text}
            `;
        } else {
            message.innerHTML = `
                <span class="time">${timeString}</span>
                <span class="username">${this.currentUser}:</span>
                ${text}
            `;
        }
        
        messagesContainer.appendChild(message);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Limit message history
        if (messagesContainer.children.length > 50) {
            messagesContainer.removeChild(messagesContainer.firstChild);
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new MusicRoom();
});
