const socket = io("https://bro-meet.onrender.com");

// Add socket connection event handlers
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

let localStream;
let peerConnection;
let roomId;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' }
  ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');

async function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  if (!roomId) return alert("Enter a room ID");

  statusDiv.textContent = "Initializing camera...";
  await initCamera();  // ✅ wait for camera first
  statusDiv.textContent = `Joining room: ${roomId}...`;
  socket.emit("join-room", { room: roomId });  // ✅ then join room
  // Set waiting status after a short delay if no one joins
  setTimeout(() => {
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
      statusDiv.textContent = `🕰️ Waiting for others to join room: ${roomId}`;
      statusDiv.style.color = '#666';
    }
  }, 2000);
}

socket.on("user-joined", () => {
  statusDiv.textContent = "User joined! Connecting...";
  createPeer(true);
});

socket.on("signal", async (data) => {
  try {
    if (!peerConnection) createPeer(false);

    if (data.description) {
      console.log("Received description:", data.description.type);
      await peerConnection.setRemoteDescription(data.description);
      if (data.description.type === "offer") {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log("Sending answer");
        socket.emit("signal", { room: roomId, description: peerConnection.localDescription });
      }
    } else if (data.candidate) {
      console.log("Received ICE candidate");
      await peerConnection.addIceCandidate(data.candidate);
    }
  } catch (error) {
    console.error("Error handling signal:", error);
  }
});

async function initCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    console.log("Camera initialized successfully");
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("Could not access camera/microphone. Please grant permissions and try again.");
    throw error;
  }
}

function createPeer(isCaller) {
  console.log(isCaller ? "Creating offer..." : "Waiting for offer...");
  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    console.log("Remote stream received");
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate");
      socket.emit("signal", { room: roomId, candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Connection state:", peerConnection.connectionState);
    statusDiv.textContent = `Connection: ${peerConnection.connectionState}`;
    if (peerConnection.connectionState === 'connected') {
      console.log("Peers connected successfully!");
      statusDiv.textContent = "✅ Connected! Meeting in progress";
      statusDiv.style.color = 'green';
    } else if (peerConnection.connectionState === 'failed') {
      statusDiv.textContent = "❌ Connection failed";
      statusDiv.style.color = 'red';
    }
  };

  if (isCaller) {
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        console.log("Sending offer");
        socket.emit("signal", { room: roomId, description: peerConnection.localDescription });
      })
      .catch(error => console.error("Error creating offer:", error));
  }
}
function toggleMic() {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  alert(`Mic is now ${audioTrack.enabled ? "ON" : "OFF"}`);
}

function toggleCamera() {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  alert(`Camera is now ${videoTrack.enabled ? "ON" : "OFF"}`);
}


async function shareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];

    // Replace the video track in peer connection
    const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(screenTrack);
      alert("Screen sharing started");
    }

    // When screen sharing stops, switch back to webcam
    screenTrack.onended = async () => {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      sender.replaceTrack(cameraTrack);
      localVideo.srcObject = localStream; // reset local view
      alert("Switched back to camera");
    };

    // Update local video preview
    localVideo.srcObject = screenStream;
  } catch (err) {
    console.error("Screen sharing error:", err);
    alert("Screen sharing failed");
  }
}
