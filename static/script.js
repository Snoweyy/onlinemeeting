const socket = io("https://bro-meet.onrender.com");
let localStream;
let peerConnection;
let roomId;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  if (!roomId) return alert("Enter a room ID");

  socket.emit("join-room", { room: roomId });
  initCamera();
}

socket.on("user-joined", () => {
  createPeer(true);
});

socket.on("signal", async (data) => {
  if (!peerConnection) createPeer(false);

  if (data.description) {
    await peerConnection.setRemoteDescription(data.description);
    if (data.description.type === "offer") {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { room: roomId, description: peerConnection.localDescription });
    }
  } else if (data.candidate) {
    await peerConnection.addIceCandidate(data.candidate);
  }
});

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPeer(isCaller) {
  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { room: roomId, candidate: event.candidate });
    }
  };

  if (isCaller) {
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        socket.emit("signal", { room: roomId, description: peerConnection.localDescription });
      });
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
