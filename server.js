const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const ytdl = require('ytdl-core');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// In-memory storage for rooms and playlists
const rooms = new Map();
const connectedUsers = new Map();

// Room state structure
class Room {
  constructor(id) {
    this.id = id;
    this.users = new Set();
    this.playlist = [];
    this.currentSong = null;
    this.currentSongIndex = -1;
    this.isPlaying = false;
    this.playStartTime = null;
    this.pausedAt = 0;
  }

  addUser(userId, username) {
    this.users.add({ id: userId, username });
  }

  removeUser(userId) {
    this.users.forEach(user => {
      if (user.id === userId) {
        this.users.delete(user);
      }
    });
  }

  addSong(song) {
    this.playlist.push(song);
  }

  playNextSong() {
    if (this.playlist.length > 0) {
      this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length;
      this.currentSong = this.playlist[this.currentSongIndex];
      this.isPlaying = true;
      this.playStartTime = Date.now();
      this.pausedAt = 0;
      return this.currentSong;
    }
    return null;
  }

  pause() {
    if (this.isPlaying) {
      this.pausedAt = Date.now() - this.playStartTime;
      this.isPlaying = false;
    }
  }

  resume() {
    if (!this.isPlaying && this.currentSong) {
      this.playStartTime = Date.now() - this.pausedAt;
      this.isPlaying = true;
    }
  }

  getCurrentTime() {
    if (this.isPlaying && this.playStartTime) {
      return Date.now() - this.playStartTime;
    }
    return this.pausedAt;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const song = {
    id: Date.now().toString(),
    title: req.body.title || req.file.originalname,
    filename: req.file.filename,
    originalname: req.file.originalname,
    uploadedAt: new Date()
  };

  res.json(song);
});

app.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// Helper functions for URL processing
function isYouTubeURL(url) {
  const youtubeRegex = /^(https?\:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(url);
}

function getYouTubeVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isSpotifyURL(url) {
  const spotifyRegex = /^https?:\/\/(?:open\.)?spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;
  return spotifyRegex.test(url);
}

function getSpotifyTrackId(url) {
  const regex = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Process YouTube URL
app.post('/process-youtube', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!isYouTubeURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract video ID from URL' });
    }

    // Get video info
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;

    // Get audio stream URL (expires after some time)
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const bestAudio = audioFormats.find(format => format.container === 'mp4') || audioFormats[0];

    if (!bestAudio) {
      return res.status(400).json({ error: 'No audio stream found' });
    }

    const song = {
      id: Date.now().toString(),
      title: videoDetails.title,
      artist: videoDetails.author.name,
      duration: parseInt(videoDetails.lengthSeconds),
      thumbnail: videoDetails.thumbnails[0]?.url,
      type: 'youtube',
      url: url,
      videoId: videoId,
      streamUrl: bestAudio.url,
      uploadedAt: new Date()
    };

    res.json(song);
  } catch (error) {
    console.error('YouTube processing error:', error);
    res.status(500).json({ error: 'Failed to process YouTube URL' });
  }
});

// Process Spotify URL (Note: Spotify doesn't allow direct streaming)
app.post('/process-spotify', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!isSpotifyURL(url)) {
      return res.status(400).json({ error: 'Invalid Spotify URL' });
    }

    const trackId = getSpotifyTrackId(url);
    if (!trackId) {
      return res.status(400).json({ error: 'Could not extract track ID from URL' });
    }

    // Note: This is a placeholder. Real Spotify integration requires API credentials
    // For now, we'll create a placeholder that opens Spotify
    const song = {
      id: Date.now().toString(),
      title: 'Spotify Track', // Would need Spotify API to get real title
      artist: 'Unknown Artist',
      duration: 0,
      type: 'spotify',
      url: url,
      trackId: trackId,
      uploadedAt: new Date(),
      note: 'Spotify links will open in Spotify app/web player'
    };

    res.json(song);
  } catch (error) {
    console.error('Spotify processing error:', error);
    res.status(500).json({ error: 'Failed to process Spotify URL' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, username } = data;
    
    // Leave any existing room
    if (connectedUsers.has(socket.id)) {
      const oldRoomId = connectedUsers.get(socket.id).roomId;
      socket.leave(oldRoomId);
      if (rooms.has(oldRoomId)) {
        rooms.get(oldRoomId).removeUser(socket.id);
      }
    }

    // Join new room
    socket.join(roomId);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Room(roomId));
    }

    const room = rooms.get(roomId);
    room.addUser(socket.id, username);
    
    connectedUsers.set(socket.id, { roomId, username });

    // Send room state to the new user
    socket.emit('room-state', {
      playlist: room.playlist,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      currentTime: room.getCurrentTime(),
      users: Array.from(room.users)
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', { username, users: Array.from(room.users) });
    
    console.log(`User ${username} joined room ${roomId}`);
  });

  socket.on('add-song', (song) => {
    const userInfo = connectedUsers.get(socket.id);
    if (!userInfo) return;

    const room = rooms.get(userInfo.roomId);
    if (!room) return;

    room.addSong(song);
    
    // Broadcast to all users in the room
    io.to(userInfo.roomId).emit('song-added', {
      song,
      playlist: room.playlist,
      addedBy: userInfo.username
    });

    console.log(`Song added to room ${userInfo.roomId}:`, song.title);
  });

  socket.on('play-song', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (!userInfo) return;

    const room = rooms.get(userInfo.roomId);
    if (!room) return;

    if (room.currentSong) {
      room.resume();
    } else {
      room.playNextSong();
    }

    io.to(userInfo.roomId).emit('song-playing', {
      song: room.currentSong,
      currentTime: room.getCurrentTime(),
      startTime: Date.now()
    });
  });

  socket.on('pause-song', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (!userInfo) return;

    const room = rooms.get(userInfo.roomId);
    if (!room) return;

    room.pause();
    
    io.to(userInfo.roomId).emit('song-paused', {
      currentTime: room.getCurrentTime()
    });
  });

  socket.on('next-song', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (!userInfo) return;

    const room = rooms.get(userInfo.roomId);
    if (!room) return;

    const nextSong = room.playNextSong();
    
    if (nextSong) {
      io.to(userInfo.roomId).emit('song-playing', {
        song: nextSong,
        currentTime: 0,
        startTime: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      const room = rooms.get(userInfo.roomId);
      if (room) {
        room.removeUser(socket.id);
        
        // Notify other users
        socket.to(userInfo.roomId).emit('user-left', { 
          username: userInfo.username,
          users: Array.from(room.users)
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(userInfo.roomId);
        }
      }
      
      connectedUsers.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎵 Music Room server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
