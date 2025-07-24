const socket = io("https://onlinemeeting.onrender.com");

// Global variables
let localStream;
let peerConnections = {};
let roomId;
let currentUserId;
let currentUsername;
let isScreenSharing = false;
let screenStream;
const participants = {};

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Update status with visual feedback
function updateStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  if (type === 'success') statusDiv.style.color = '#11998e';
  if (type === 'error') statusDiv.style.color = '#ee5a52';
  if (type === 'info') statusDiv.style.color = '#667eea';
  console.log(`[BroMeet] ${message}`);
}

// Join room function
async function joinRoom() {
  currentUsername = document.getElementById('usernameInput').value.trim();
  roomId = document.getElementById('roomInput').value.trim();
  
  if (!currentUsername || !roomId) {
    alert('Please enter both your name and a room ID.');
    return;
  }
  
  try {
    updateStatus("🎥 Initializing camera...", 'info');
    await initCamera();
    
    updateStatus("🚀 Joining room...", 'info');
    currentUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    socket.emit('join-room', { 
      room: roomId, 
      username: currentUsername,
      userId: currentUserId 
    });
    
    // Show controls and create local video
    document.getElementById('meetingControls').style.display = 'block';
    document.getElementById('participantsList').style.display = 'block';
    
    // Hide the join section with smooth animation since user has joined
    document.querySelector('.join-section').classList.add('hidden');
    
    createLocalVideoElement();
    
  } catch (error) {
    updateStatus("❌ Failed to initialize camera", 'error');
    console.error('Join room error:', error);
  }
}

// Initialize camera
async function initCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 1280, height: 720 }, 
      audio: true 
    });
    updateStatus("✅ Camera initialized", 'success');
  } catch (err) {
    updateStatus("❌ Camera access denied", 'error');
    throw err;
  }
}

// Create local video element
function createLocalVideoElement() {
  const videoGrid = document.getElementById('videoGrid');
  
  // Remove existing local video if it exists
  const existingLocal = document.getElementById('localVideoContainer');
  if (existingLocal) {
    existingLocal.remove();
  }
  
  const localVideoContainer = document.createElement('div');
  localVideoContainer.className = 'video-container local';
  localVideoContainer.id = 'localVideoContainer';
  
  const localVideo = document.createElement('video');
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.id = 'localVideo';
  localVideo.playsInline = true; // For mobile compatibility
  
  const localLabel = document.createElement('div');
  localLabel.className = 'video-label';
  localLabel.innerHTML = `<span class="status-indicator"></span> ${currentUsername} (You)`;
  
  // Add connection status
  const connectionStatus = document.createElement('div');
  connectionStatus.className = 'connection-status';
  connectionStatus.innerHTML = '<i class="fas fa-wifi" style="color: #38ef7d;"></i> Connected';
  
  localVideoContainer.appendChild(localVideo);
  localVideoContainer.appendChild(localLabel);
  localVideoContainer.appendChild(connectionStatus);
  videoGrid.appendChild(localVideoContainer);
  
  participants[currentUserId] = {
    username: currentUsername,
    isLocal: true,
    element: localVideoContainer
  };
  
  updateParticipantsList();
  console.log('Created local video element');
}

// Create peer connection
function createPeerConnection(userId) {
  console.log(`Creating peer connection for ${userId}`);
  
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections[userId] = peerConnection;
  
  // Add local stream
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
    console.log(`Added ${track.kind} track for ${userId}`);
  });
  
  // Handle incoming remote stream
  peerConnection.ontrack = (event) => {
    console.log(`Received ${event.track.kind} track from ${userId}`);
    const remoteStream = event.streams[0];
    
    if (!participants[userId]?.element) {
      createRemoteVideoElement(userId, participants[userId]?.username || 'Unknown User');
    }
    
    const remoteVideo = participants[userId].element.querySelector('video');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      console.log(`Set stream for ${userId}`);
      
      // Update connection status
      const connectionStatus = participants[userId].element.querySelector('.connection-status');
      if (connectionStatus) {
        connectionStatus.innerHTML = '<i class="fas fa-wifi" style="color: #38ef7d;"></i> Connected';
      }
      
      const statusIndicator = participants[userId].element.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.classList.remove('connecting');
      }
      
      // Add connected class to video container
      participants[userId].element.classList.add('connected');
      
      // Show in screen share area if this user is sharing
      if (isUserScreenSharing(userId)) {
        document.getElementById('screenShareVideo').srcObject = remoteStream;
      }
    }
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`Sending ICE candidate to ${userId}`);
      socket.emit('signal', {
        room: roomId,
        fromUser: currentUserId,
        targetUser: userId,
        candidate: event.candidate
      });
    }
  };
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection with ${userId}: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'connected') {
      updateStatus(`✅ Connected to all participants`, 'success');
    }
  };
  
  return peerConnection;
}

// Create remote video element
function createRemoteVideoElement(userId, username) {
  const videoGrid = document.getElementById('videoGrid');
  
  // Remove existing element if it exists
  const existingElement = document.getElementById(`container_${userId}`);
  if (existingElement) {
    existingElement.remove();
  }
  
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container remote';
  videoContainer.id = `container_${userId}`;
  
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.playsInline = true; // For mobile compatibility
  videoElement.id = `video_${userId}`;
  
  // Add loading placeholder
  videoElement.poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDMyMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMjQwIiBmaWxsPSIjMjEyMTIxIi8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTIwIiBmaWxsPSIjNjY3ZWVhIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNvbm5lY3RpbmcuLi48L3RleHQ+Cjwvc3ZnPgo=';
  
  const videoLabel = document.createElement('div');
  videoLabel.className = 'video-label';
  videoLabel.innerHTML = `<span class="status-indicator connecting"></span> ${username}`;
  
  // Add connection status
  const connectionStatus = document.createElement('div');
  connectionStatus.className = 'connection-status';
  connectionStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="color: #667eea;"></i> Connecting...';
  
  videoContainer.appendChild(videoElement);
  videoContainer.appendChild(videoLabel);
  videoContainer.appendChild(connectionStatus);
  videoGrid.appendChild(videoContainer);
  
  participants[userId] = {
    username: username,
    isLocal: false,
    element: videoContainer
  };
  
  updateParticipantsList();
  console.log(`Created video element for ${userId} (${username})`);
  
  return videoElement;
}

// Socket event handlers
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('user-joined', (data) => {
  console.log('User joined event:', data);
  
  if (data.userId === currentUserId) {
    updateStatus(`🎉 Successfully joined room: ${roomId}`, 'success');
    return;
  }
  
  // Store participant info
  participants[data.userId] = {
    username: data.username,
    isLocal: false
  };
  
  // Create peer connection and initiate call
  const peerConnection = createPeerConnection(data.userId);
  
  // Create offer for new user
  peerConnection.createOffer()
    .then(offer => {
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      console.log(`Sending offer to ${data.userId}`);
      socket.emit('signal', {
        room: roomId,
        fromUser: currentUserId,
        targetUser: data.userId,
        description: peerConnection.localDescription
      });
    })
    .catch(error => console.error('Error creating offer:', error));
    
  updateParticipantsList();
});

socket.on('room-users', (data) => {
  console.log('Room users:', data);
  
  // Store all participant info
  Object.keys(data.users).forEach(userId => {
    if (userId !== currentUserId) {
      participants[userId] = {
        username: data.users[userId].username,
        isLocal: false
      };
    }
  });
  
  updateParticipantsList();
});

socket.on('signal', async (data) => {
  console.log('Received signal:', data.description?.type || 'candidate', 'from:', data.fromUser);
  
  const fromUserId = data.fromUser;
  let peerConnection = peerConnections[fromUserId];
  
  // Create peer connection if it doesn't exist
  if (!peerConnection) {
    console.log(`Creating new peer connection for ${fromUserId}`);
    peerConnection = createPeerConnection(fromUserId);
  }
  
  try {
    if (data.description) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
      
      if (data.description.type === 'offer') {
        console.log(`Answering offer from ${fromUserId}`);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('signal', {
          room: roomId,
          fromUser: currentUserId,
          targetUser: fromUserId,
          description: peerConnection.localDescription
        });
      }
    } else if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      console.log(`Added ICE candidate from ${fromUserId}`);
    }
  } catch (error) {
    console.error('Error handling signal:', error);
  }
});

socket.on('user-left', (data) => {
  console.log('User left:', data.userId);
  
  // Remove video element
  const container = document.getElementById(`container_${data.userId}`);
  if (container) {
    container.remove();
  }
  
  // Close and remove peer connection
  if (peerConnections[data.userId]) {
    peerConnections[data.userId].close();
    delete peerConnections[data.userId];
  }
  
  // Clean up participant data
  delete participants[data.userId];
  updateParticipantsList();
});

socket.on('screen-share-started', (data) => {
  console.log('Screen sharing started by:', data.username);
  
  const screenShareContainer = document.getElementById('screenShareContainer');
  screenShareContainer.classList.add('active');
  document.getElementById('screenSharerName').textContent = data.username;
  
  // Show screen share stream
  if (participants[data.userId]?.element) {
    const video = participants[data.userId].element.querySelector('video');
    if (video && video.srcObject) {
      document.getElementById('screenShareVideo').srcObject = video.srcObject;
    }
  }
  
  // Update UI
  if (data.userId !== currentUserId) {
    document.getElementById('shareScreenBtn').disabled = true;
  } else {
    document.getElementById('shareScreenBtn').style.display = 'none';
    document.getElementById('stopShareBtn').style.display = 'inline-flex';
  }
});

socket.on('screen-share-stopped', (data) => {
  console.log('Screen sharing stopped');
  
  document.getElementById('screenShareContainer').classList.remove('active');
  document.getElementById('shareScreenBtn').disabled = false;
  document.getElementById('shareScreenBtn').style.display = 'inline-flex';
  document.getElementById('stopShareBtn').style.display = 'none';
  
  isScreenSharing = false;
});

// Control functions
async function shareScreen() {
  try {
    updateStatus("🖥️ Starting screen share...", 'info');
    
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    
    // Replace video track for all peer connections
    Object.values(peerConnections).forEach(peerConnection => {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
    });
    
    // Update local video
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = screenStream;
    }
    
    isScreenSharing = true;
    socket.emit('start-screen-share', { 
      room: roomId, 
      userId: currentUserId, 
      username: currentUsername 
    });
    
    updateStatus("✅ Screen sharing started", 'success');
    
    // Handle screen share ending
    screenTrack.onended = () => {
      stopScreenShare();
    };
    
  } catch (err) {
    updateStatus("❌ Screen share failed", 'error');
    console.error('Screen sharing error:', err);
  }
}

function stopScreenShare() {
  if (isScreenSharing && screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    
    // Switch back to camera
    const videoTrack = localStream.getVideoTracks()[0];
    Object.values(peerConnections).forEach(peerConnection => {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    // Update local video
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = localStream;
    }
    
    socket.emit('stop-screen-share', { room: roomId, userId: currentUserId });
    updateStatus("📷 Switched back to camera", 'success');
  }
}

function toggleMic() {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    const micStatus = document.getElementById('micStatus');
    const micIcon = micStatus.parentElement.querySelector('i');
    
    micStatus.textContent = audioTrack.enabled ? "Mic On" : "Mic Off";
    micIcon.className = audioTrack.enabled ? "fas fa-microphone" : "fas fa-microphone-slash";
  }
}

function toggleCamera() {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    const cameraStatus = document.getElementById('cameraStatus');
    const cameraIcon = cameraStatus.parentElement.querySelector('i');
    
    cameraStatus.textContent = videoTrack.enabled ? "Video On" : "Video Off";
    cameraIcon.className = videoTrack.enabled ? "fas fa-video" : "fas fa-video-slash";
  }
}

function leaveRoom() {
  // Close all peer connections
  Object.values(peerConnections).forEach(pc => pc.close());
  peerConnections = {};
  
  // Stop all streams
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  // Leave room
  if (roomId && currentUserId) {
    socket.emit('leave-room', { room: roomId, userId: currentUserId });
  }
  
  // Clean up UI
  document.getElementById('meetingControls').style.display = 'none';
  document.getElementById('participantsList').style.display = 'none';
  document.getElementById('screenShareContainer').classList.remove('active');
  
  // Clear video grid
  const videoGrid = document.getElementById('videoGrid');
  videoGrid.innerHTML = '';
  
  // Clear participants
  Object.keys(participants).forEach(userId => delete participants[userId]);
  
  // Reset screen sharing state
  isScreenSharing = false;
  document.getElementById('shareScreenBtn').style.display = 'inline-flex';
  document.getElementById('stopShareBtn').style.display = 'none';
  
  // Show join section back with animation
  const joinSection = document.querySelector('.join-section');
  joinSection.classList.remove('hidden');
  
  // Reset room field only (preserve username if user is logged in with Firebase)
  document.getElementById('roomInput').value = '';
  
  // Only clear username if user is not logged in with Firebase
  if (typeof window.firebaseUser === 'function' && !window.firebaseUser()) {
    document.getElementById('usernameInput').value = '';
  }
  
  // Reset global variables
  roomId = null;
  currentUserId = null;
  currentUsername = null;
  
  updateStatus("👋 Left the meeting. Ready to join another!", 'info');
}

// Helper functions
function updateParticipantsList() {
  const participantsContent = document.getElementById('participantsContent');
  participantsContent.innerHTML = '';
  
  Object.keys(participants).forEach(userId => {
    const participant = participants[userId];
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'participant-avatar';
    avatar.textContent = participant.username.charAt(0).toUpperCase();
    
    const name = document.createElement('span');
    name.textContent = participant.isLocal ? `${participant.username} (You)` : participant.username;
    
    participantDiv.appendChild(avatar);
    participantDiv.appendChild(name);
    participantsContent.appendChild(participantDiv);
  });
  
  // Update participant count
  const count = Object.keys(participants).length;
  const countElement = document.getElementById('participantCount');
  if (countElement) {
    countElement.textContent = count;
  }
}

function isUserScreenSharing(userId) {
  return isScreenSharing && userId === currentUserId;
}

// Note: Google OAuth functions are now handled by firebase-auth.js
