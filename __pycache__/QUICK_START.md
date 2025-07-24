# 🚀 Bro Meet - Quick Start Guide

## 🎯 **Multi-User Video Conference Platform - TESTED & VERIFIED ✅**

---

## 📋 **Prerequisites:**
- ✅ Python 3.13+ installed
- ✅ Modern web browser (Chrome, Firefox, Edge)
- ✅ Camera and microphone permissions

---

## 🏃‍♂️ **Quick Start (3 Steps):**

### **Step 1: Install Dependencies**
```bash
pip install -r requirements.txt
```

### **Step 2: Start the Server**
```bash
# Option A: Use the batch file (Windows)
start_server.bat

# Option B: Run directly
python app_test.py
```

### **Step 3: Open in Browser**
Navigate to: **http://127.0.0.1:5000**

---

## 👥 **Testing Multiple Users:**

### **For Local Testing:**
1. **Open multiple browser tabs/windows**
2. **Use different usernames in each tab**
3. **Use the same Room ID (e.g., "2222")**
4. **Click "Join Meeting" in each tab**

### **For Network Testing:**
1. **Share your local IP address** (shown in server startup)
2. **Others can connect using:** `http://YOUR_IP:5000`
3. **Everyone joins the same room ID**

---

## 🎥 **Using the Platform:**

### **Basic Controls:**
- 🎤 **Mute/Unmute:** Toggle microphone
- 📷 **Camera On/Off:** Toggle video
- 🖥️ **Share Screen:** Share your desktop
- 🚪 **Leave Meeting:** Exit the room

### **Features:**
- ✅ **Real-time video/audio**
- ✅ **Screen sharing**
- ✅ **Participant list**
- ✅ **Connection status**
- ✅ **Responsive design**

---

## 🔧 **Troubleshooting:**

### **Common Issues:**
1. **Camera/Mic not working?**
   - Check browser permissions
   - Allow camera/microphone access

2. **Can't connect to other users?**
   - Ensure same room ID
   - Check firewall settings

3. **Server not starting?**
   - Install dependencies: `pip install -r requirements.txt`
   - Check Python version: `python --version`

---

## 🌐 **Browser Support:**
- ✅ **Chrome** (Recommended)
- ✅ **Firefox** 
- ✅ **Edge**
- ✅ **Safari** (Mac)
- ✅ **Mobile browsers**

---

## 📊 **Tested Configurations:**
- ✅ **2+ users simultaneously**
- ✅ **Multiple rooms**
- ✅ **Screen sharing**
- ✅ **Cross-platform**
- ✅ **Mobile responsive**

---

## 🚀 **Ready for Production:**
For production deployment, consider:
- **HTTPS/SSL certificate**
- **TURN server for NAT traversal**
- **Load balancing**
- **Database integration**

---

**🎉 Start meeting now: Double-click `start_server.bat` and open http://127.0.0.1:5000 in your browser!**
