# Firebase Google Authentication Setup Guide

This guide will help you set up Firebase Google Authentication for your Bro Meet application.

## Prerequisites

- A Google account
- Access to the Firebase Console
- Your application should be running on a proper domain (localhost works for development)

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "bro-meet-app")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project dashboard, click on "Authentication" in the left sidebar
2. Click on the "Get started" button
3. Go to the "Sign-in method" tab
4. Click on "Google" in the providers list
5. Toggle the "Enable" switch
6. Enter your project's public-facing name (e.g., "Bro Meet")
7. Choose a support email from the dropdown
8. Click "Save"

## Step 3: Add Your Domain

1. Still in the "Sign-in method" tab, scroll down to "Authorized domains"
2. Add your domain(s):
   - For development: `localhost`
   - For production: `yourdomain.com` (replace with your actual domain)
   - If using Render: `your-app-name.onrender.com`
3. Click "Add domain"

## Step 4: Get Firebase Configuration

1. Click on the gear icon (⚙️) next to "Project Overview" in the left sidebar
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click on the "</>" (Web) icon to add a web app
5. Enter an app nickname (e.g., "Bro Meet Web")
6. Click "Register app"
7. Copy the Firebase configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};
```

## Step 5: Update Your Application

1. Open `static/firebase-auth.js` in your project
2. Replace the placeholder configuration with your actual Firebase config:

```javascript
// Replace this placeholder configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// With your actual configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};
```

## Step 6: Test the Implementation

1. Start your application
2. Open it in a web browser
3. Click the "Sign in with Google" button
4. Complete the Google sign-in flow
5. Verify that:
   - The user interface updates to show logged-in state
   - User's name and avatar are displayed
   - Username field is auto-filled when joining a meeting
   - Logout functionality works correctly

## Security Considerations

### Firebase Security Rules
Since you're only using Authentication, you don't need to configure Firestore or Realtime Database rules. However, if you plan to store user data, consider these rules:

```javascript
// Firestore rules (if you add Firestore later)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### API Key Security
- Your Firebase API key is safe to expose in client-side code
- Firebase automatically restricts it to your authorized domains
- However, monitor your usage in the Firebase Console

## Environment Variables (Optional)

For better security and configuration management, you can use environment variables:

1. Create a `.env` file in your project root:
```env
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456789
```

2. Update your backend (Flask) to serve these values:
```python
@app.route('/api/firebase-config')
def firebase_config():
    return jsonify({
        'apiKey': os.environ.get('FIREBASE_API_KEY'),
        'authDomain': os.environ.get('FIREBASE_AUTH_DOMAIN'),
        'projectId': os.environ.get('FIREBASE_PROJECT_ID'),
        'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET'),
        'messagingSenderId': os.environ.get('FIREBASE_MESSAGING_SENDER_ID'),
        'appId': os.environ.get('FIREBASE_APP_ID')
    })
```

## Troubleshooting

### Common Issues:

1. **"auth/unauthorized-domain" error**
   - Add your domain to authorized domains in Firebase Console
   - Make sure you're accessing the app from the authorized domain

2. **"auth/popup-blocked" error**
   - Ensure popups are allowed in your browser
   - Try using `signInWithRedirect()` instead of `signInWithPopup()`

3. **Firebase not defined error**
   - Make sure Firebase SDK scripts are loaded before your custom scripts
   - Check browser console for loading errors

4. **Sign-in button not working**
   - Check browser console for JavaScript errors
   - Verify Firebase configuration is correct
   - Ensure all required scripts are loaded

### Debug Mode:
Add this to your `firebase-auth.js` for debugging:
```javascript
// Enable Firebase Auth debug mode
firebase.auth().useDeviceLanguage();
firebase.auth().onAuthStateChanged((user) => {
  console.log('Auth state changed:', user);
});
```

## Additional Features

### User Profile Information
The Firebase user object provides:
- `user.displayName` - User's full name
- `user.email` - User's email address
- `user.photoURL` - User's profile picture URL
- `user.uid` - Unique user identifier

### Persistent Authentication
Firebase automatically maintains the user's authentication state across browser sessions. Users will remain logged in until they explicitly log out.

## Next Steps

1. Test the implementation thoroughly
2. Consider adding user profile management
3. Implement user data storage if needed
4. Add error handling for network issues
5. Consider implementing additional sign-in providers (Facebook, Twitter, etc.)

## Support

If you encounter issues:
1. Check the Firebase Console for error logs
2. Review browser console for JavaScript errors
3. Visit [Firebase Documentation](https://firebase.google.com/docs/auth)
4. Check [Firebase Support](https://firebase.google.com/support)

---

**Important**: Remember to keep your Firebase configuration secure and never commit sensitive credentials to public repositories.
