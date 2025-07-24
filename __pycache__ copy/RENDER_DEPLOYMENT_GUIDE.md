# Render.com Deployment Guide

## 🚀 Your Website is Ready for Deployment!

Your online meeting platform is fully configured for Render.com deployment. Here's how to get it live:

## Step 1: Push to GitHub

1. Initialize git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit - Online Meeting Platform ready for Render"
```

2. Create a new repository on GitHub and push:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Step 2: Deploy on Render.com

1. **Go to [render.com](https://render.com)** and sign up/sign in
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Render will automatically detect your `render.yaml` configuration**
5. **Click "Create Web Service"**

That's it! Render will automatically:
- Install Python 3.12.8
- Install all dependencies from `requirements.txt`
- Start your app with Gunicorn + eventlet
- Set up health monitoring
- Generate secure environment variables

## Step 3: Access Your Live Website

Once deployed, your website will be available at:
`https://your-service-name.onrender.com`

## Features Included

✅ **Real-time Video Conferencing** - WebRTC-based peer-to-peer connections
✅ **Screen Sharing** - Share your screen with meeting participants  
✅ **Google OAuth Login** - Secure authentication with Google accounts
✅ **Multi-room Support** - Create and join different meeting rooms
✅ **Mobile Responsive** - Works on desktop and mobile devices
✅ **Health Monitoring** - Built-in health check endpoint at `/health`
✅ **Auto-deployment** - Updates automatically when you push to GitHub

## Testing Your Deployment

1. Open your deployed URL in two different browser windows
2. Enter the same room ID in both windows
3. Click "Join" and allow camera/microphone permissions
4. You should see successful video connection between the windows!

## Environment Variables (Already Configured)

The following environment variables are automatically set:
- `SECRET_KEY` - Auto-generated secure key
- `FLASK_DEBUG` - Set to `false` for production
- `PYTHON_VERSION` - Python 3.12.8
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## Troubleshooting

**If deployment fails:**
1. Check the build logs in your Render dashboard
2. Ensure all files are committed to your GitHub repository
3. Verify your `render.yaml` file is in the root directory

**If video connection fails:**
1. Make sure to allow camera/microphone permissions
2. Try different browsers (Chrome/Firefox work best)
3. Check browser console for error messages

## Next Steps

Your video conferencing platform is now live! Consider:
- Setting up a custom domain
- Adding more authentication providers
- Implementing recording features
- Adding chat functionality
- Setting up monitoring and analytics

Enjoy your deployed online meeting platform! 🎉
