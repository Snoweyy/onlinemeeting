// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXRyb6oJZYBgzst0YH-AXr2noWiXgy9eY",
  authDomain: "bro-meet-db883.firebaseapp.com",
  projectId: "bro-meet-db883",
  storageBucket: "bro-meet-db883.firebasestorage.app",
  messagingSenderId: "198288836239",
  appId: "1:198288836239:web:3f61ef2ed9df5b0991d2fa",
  measurementId: "G-980BCSE7XF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Configure Google Provider
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Current user state
let firebaseUser = null;

// Auth state listener
auth.onAuthStateChanged((user) => {
  firebaseUser = user;
  updateAuthUI();
  
  if (user) {
    console.log('User signed in:', user.displayName);
    // Auto-fill username if not already filled
    const usernameInput = document.getElementById('usernameInput');
    if (!usernameInput.value.trim()) {
      usernameInput.value = user.displayName || 'User';
    }
  } else {
    console.log('User signed out');
  }
});

// Update authentication UI
function updateAuthUI() {
  const loggedInState = document.getElementById('loggedInState');
  const loggedOutState = document.getElementById('loggedOutState');
  
  if (firebaseUser) {
    // Show logged in state
    loggedInState.style.display = 'block';
    loggedOutState.style.display = 'none';
    
    // Update user info
    document.getElementById('userName').textContent = firebaseUser.displayName || 'User';
    document.getElementById('userEmail').textContent = firebaseUser.email || '';
    document.getElementById('userAvatar').src = firebaseUser.photoURL || '';
    
    // Show success message
    showFlashMessage('Successfully signed in with Google!', 'success');
  } else {
    // Show logged out state
    loggedInState.style.display = 'none';
    loggedOutState.style.display = 'block';
  }
}

// Google Sign In
async function loginWithGoogle() {
  try {
    console.log('Current domain:', window.location.origin);
    console.log('Current hostname:', window.location.hostname);
    console.log('Current port:', window.location.port);
    
    showFlashMessage('Signing in with Google...', 'info');
    
    // Try popup first, fallback to redirect for localhost issues
    let result;
    try {
      result = await auth.signInWithPopup(googleProvider);
    } catch (popupError) {
      console.log('Popup failed, trying redirect:', popupError.code);
      if (popupError.code === 'auth/unauthorized-domain' || popupError.code === 'auth/popup-blocked') {
        // Fallback to redirect method
        await auth.signInWithRedirect(googleProvider);
        return; // Exit here as redirect will reload the page
      }
      throw popupError; // Re-throw if it's a different error
    }
    const user = result.user;
    
    console.log('Google sign-in successful:', user.displayName);
    
    // Optional: Send user info to your backend
    await sendUserInfoToBackend(user);
    
  } catch (error) {
    console.error('Google sign-in error:', error);
    
    let errorMessage = 'Failed to sign in with Google';
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Sign-in cancelled';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later.';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    showFlashMessage(errorMessage, 'error');
  }
}

// Google Sign Out
async function logout() {
  try {
    await auth.signOut();
    showFlashMessage('Successfully signed out', 'info');
    
    // Clear username input
    const usernameInput = document.getElementById('usernameInput');
    usernameInput.value = '';
    
  } catch (error) {
    console.error('Sign-out error:', error);
    showFlashMessage('Error signing out', 'error');
  }
}

// Send user info to backend (optional)
async function sendUserInfoToBackend(user) {
  try {
    const idToken = await user.getIdToken();
    
    const response = await fetch('/api/firebase-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      })
    });
    
    if (response.ok) {
      console.log('User info sent to backend successfully');
    }
  } catch (error) {
    console.error('Error sending user info to backend:', error);
  }
}

// Enhanced join room function to use Firebase user info
function enhanceJoinRoomWithFirebase() {
  const originalJoinRoom = window.joinRoom;
  
  window.joinRoom = async function() {
    // Use Firebase user name if available and no name entered
    const usernameInput = document.getElementById('usernameInput');
    if (firebaseUser && firebaseUser.displayName && !usernameInput.value.trim()) {
      usernameInput.value = firebaseUser.displayName;
    }
    
    // Add Firebase user ID to the room join data if available
    if (firebaseUser) {
      // Store Firebase UID for potential backend integration
      window.firebaseUID = firebaseUser.uid;
    }
    
    // Call original join room function
    return originalJoinRoom.apply(this, arguments);
  };
}

// Flash message system
function showFlashMessage(message, type = 'info') {
  // Create flash messages container if it doesn't exist
  let flashContainer = document.querySelector('.flash-messages');
  if (!flashContainer) {
    flashContainer = document.createElement('div');
    flashContainer.className = 'flash-messages';
    document.body.appendChild(flashContainer);
  }
  
  // Create flash message element
  const flashMessage = document.createElement('div');
  flashMessage.className = `flash-message ${type}`;
  flashMessage.textContent = message;
  
  // Add to container
  flashContainer.appendChild(flashMessage);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (flashMessage.parentNode) {
      flashMessage.parentNode.removeChild(flashMessage);
    }
  }, 5000);
  
  // Remove on click
  flashMessage.addEventListener('click', () => {
    if (flashMessage.parentNode) {
      flashMessage.parentNode.removeChild(flashMessage);
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Enhance join room function
  enhanceJoinRoomWithFirebase();
  
  // Handle redirect result (for when using signInWithRedirect)
  auth.getRedirectResult().then((result) => {
    if (result.user) {
      console.log('Sign-in successful via redirect:', result.user.displayName);
      showFlashMessage('Successfully signed in with Google!', 'success');
    }
  }).catch((error) => {
    console.error('Redirect sign-in error:', error);
    if (error.code === 'auth/unauthorized-domain') {
      showFlashMessage('Domain not authorized. Please contact support.', 'error');
    }
  });
  
  // Check if user is already signed in
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('User already signed in on page load');
    }
  });
});

// Export functions for global access
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.firebaseUser = () => firebaseUser;
