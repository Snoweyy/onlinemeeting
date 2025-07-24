const socket = io("https://onlinemeeting.onrender.com");

// Global variables
let localStream;
let peerConnections = {};
let roomId;
let currentUserId;
let currentUsername;
let isScreenSharing = false;
let screenStream;
const remoteStreams = {};
const participants = {};

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// DOM elements
const statusDiv = document.getElementById('status');
const videoGrid = document.getElementById('videoGrid');
const screenShareContainer = document.getElementById('screenShareContainer');
const screenShareVideo = document.getElementById('screenShareVideo');
const participantsList = document.getElementById('participantsList');
const participantsContent = document.getElementById('participantsContent');
const meetingControls = document.getElementById('meetingControls');

// Console logging for debugging
function log(message, data = null) {
  console.log(`[BroMeet] ${message}`, data || '');
}

// Update status with visual feedback
function updateStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status-${type}`;
  if (type === 'success') statusDiv.style.color = '#11998e';
  if (type === 'error') statusDiv.style.color = '#ee5a52';
  if (type === 'info') statusDiv.style.color = '#667eea';
}
// Join room function
async function joinRoom() {
  currentUsername = document.getElementById('usernameInput').value;
  roomId = document.getElementById('roomInput').value;
  
  if (!currentUsername || !roomId) {
    alert('Please enter both your name and a room ID.');
    return;
  }
  
  statusDiv.textContent = "Initializing camera...";
  await initCamera();
  
  statusDiv.textContent = "Joining room...";
  socket.emit('join-room', { room: roomId, username: currentUsername });
  
  // Show controls and add local video
  document.getElementById('meetingControls').style.display = 'block';
  createLocalVideoElement();
}

// Initialize camera
async function initCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    statusDiv.textContent = "Camera initialized successfully";
  } catch (err) {
    statusDiv.textContent = "Failed to access camera/microphone";
    console.error('Camera error:', err);
    throw err;
  }
}

// Create local video element
function createLocalVideoElement() {
  const localVideoContainer = document.createElement('div');
  localVideoContainer.className = 'video-container';
  localVideoContainer.id = 'localVideoContainer';
  
  const localVideo = document.createElement('video');
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.id = 'localVideo';
  
  const localLabel = document.createElement('div');
  localLabel.className = 'video-label';
  localLabel.textContent = `${currentUsername} (You)`;
  
  localVideoContainer.appendChild(localVideo);
  localVideoContainer.appendChild(localLabel);
  videoGrid.appendChild(localVideoContainer);
}

// Create peer connection
function createPeerConnection(userId, username) {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections[userId] = peerConnection;
  
  // Add local stream
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Handle incoming stream
  peerConnection.ontrack = (event) => {
    console.log('Received remote stream from:', userId);
    const remoteStream = event.streams[0];
    
    if (!userElements[userId]) {
      createRemoteVideoElement(userId, username);
    }
    
    userElements[userId].srcObject = remoteStream;
    
    // If this user is screen sharing, also show in screen share area
    if (isUserScreenSharing(userId)) {
      screenShareVideo.srcObject = remoteStream;
    }
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        room: roomId,
        targetUser: userId,
        candidate: event.candidate
      });
    }
  };
  
  return peerConnection;
}

// Create remote video element
function createRemoteVideoElement(userId, username) {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  videoContainer.id = `container_${userId}`;
  
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.id = `video_${userId}`;
  
  const videoLabel = document.createElement('div');
  videoLabel.className = 'video-label';
  videoLabel.textContent = username || `User ${userId.substring(0, 8)}`;
  
  videoContainer.appendChild(videoElement);
  videoContainer.appendChild(videoLabel);
  videoGrid.appendChild(videoContainer);
  
  userElements[userId] = videoElement;
}

// Socket event handlers
socket.on('user-joined', async (data) => {
  console.log('User joined:', data);
  currentUserId = data.userId;
  currentUsername = data.username;
  
  statusDiv.textContent = `Connected to room: ${roomId}`;
  statusDiv.style.color = 'green';
  
  document.getElementById('participantsList').style.display = 'block';
  updateParticipantsList(data.roomUsers || [data.userId]);
});

socket.on('room-users', (data) => {
  console.log('Current room users:', data.users);
  
  // Create connections with existing users
  Object.keys(data.users).forEach(userId => {
    if (userId !== currentUserId && !peerConnections[userId]) {
      const username = data.users[userId].username;
      userInfo[userId] = { username };
      
      const peerConnection = createPeerConnection(userId, username);
      
      // Create and send offer
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', {
            room: roomId,
            targetUser: userId,
            description: peerConnection.localDescription
          });
        })
        .catch(error => console.error('Error creating offer:', error));
    }
  });
  
  updateParticipantsList(Object.keys(data.users));
});

socket.on('signal', async (data) => {
  console.log('Received signal:', data.description ? data.description.type : 'candidate');
  
  let peerConnection = peerConnections[data.userId];
  
  if (!peerConnection) {
    console.log('Creating new peer connection for:', data.userId);
    peerConnection = createPeerConnection(data.userId, userInfo[data.userId]?.username);
  }
  
  try {
    if (data.description) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.description));
      
      if (data.description.type === 'offer') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('signal', {
          room: roomId,
          targetUser: data.userId,
          description: peerConnection.localDescription
        });
      }
    } else if (data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (error) {
    console.error('Error handling signal:', error);
  }
});

socket.on('screen-share-started', (data) => {
  console.log('Screen sharing started by:', data.username);
  
  screenShareContainer.classList.add('active');
  document.getElementById('screenSharerName').textContent = data.username;
  
  // If we have this user's stream, show it in screen share area
  if (userElements[data.userId] && userElements[data.userId].srcObject) {
    screenShareVideo.srcObject = userElements[data.userId].srcObject;
  }
  
  // Disable screen share button for others
  if (data.userId !== currentUserId) {
    document.getElementById('shareScreenBtn').disabled = true;
  } else {
    document.getElementById('shareScreenBtn').style.display = 'none';
    document.getElementById('stopShareBtn').style.display = 'inline-block';
  }
});

socket.on('screen-share-stopped', (data) => {
  console.log('Screen sharing stopped');
  
  screenShareContainer.classList.remove('active');
  
  // Re-enable screen share button
  document.getElementById('shareScreenBtn').disabled = false;
  document.getElementById('shareScreenBtn').style.display = 'inline-block';
  document.getElementById('stopShareBtn').style.display = 'none';
  
  isScreenSharing = false;
});

socket.on('user-left', (data) => {
  console.log('User left:', data.userId);
  
  // Remove video element
  const container = document.getElementById(`container_${data.userId}`);
  if (container) {
    container.remove();
  }
  
  // Close peer connection
  if (peerConnections[data.userId]) {
    peerConnections[data.userId].close();
    delete peerConnections[data.userId];
  }
  
  // Clean up
  delete userElements[data.userId];
  delete userInfo[data.userId];
});

// Control functions
async function shareScreen() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    
    // Replace video track for all peer connections
    Object.values(peerConnections).forEach(peerConnection => {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
    });
    
    // Update local video preview
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = screenStream;
    }
    
    isScreenSharing = true;
    socket.emit('start-screen-share', { room: roomId, userId: currentUserId, username: currentUsername });
    
    // Handle screen share ending
    screenTrack.onended = () => {
      stopScreenShare();
    };
    
  } catch (err) {
    console.error('Screen sharing failed:', err);
    alert('Failed to start screen sharing');
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
    
    // Update local video preview
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
      localVideo.srcObject = localStream;
    }
    
    socket.emit('stop-screen-share', { room: roomId, userId: currentUserId });
  }
}

function toggleMic() {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('micStatus').textContent = audioTrack.enabled ? "Mic On" : "Mic Off";
  }
}

function toggleCamera() {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    document.getElementById('cameraStatus').textContent = videoTrack.enabled ? "Video On" : "Video Off";
  }
}

function leaveRoom() {
  // Clean up connections
  Object.values(peerConnections).forEach(pc => pc.close());
  
  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
  }
  
  socket.emit('leave-room', { room: roomId, userId: currentUserId });
  window.location.reload();
}

// Helper functions
function updateParticipantsList(userIds) {
  const participantsContent = document.getElementById('participantsContent');
  participantsContent.innerHTML = '';
  
  userIds.forEach(userId => {
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant-item';
    const username = userInfo[userId]?.username || (userId === currentUserId ? currentUsername : `User ${userId.substring(0, 8)}`);
    participantDiv.textContent = userId === currentUserId ? `${username} (You)` : username;
    participantsContent.appendChild(participantDiv);
  });
}

function isUserScreenSharing(userId) {
  // This would be better implemented with proper state management
  return screenShareContainer.classList.contains('active') && 
         document.getElementById('screenSharerName').textContent.includes(userInfo[userId]?.username || '');
}
