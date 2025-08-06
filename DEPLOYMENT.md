# MusicRoom Production Deployment Guide

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository and navigate to project folder**
   ```bash
   git clone <your-repo-url>
   cd onlinemeeting
   ```

2. **Create production environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Option 2: PM2 Deployment

1. **Install production dependencies**
   ```bash
   npm ci --production
   ```

2. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

3. **Start the application**
   ```bash
   npm run pm2:start
   ```

## 🔧 Environment Configuration

Create a `.env` file based on `.env.example`:

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=50000000
UPLOAD_DIR=./uploads
SESSION_SECRET=your-super-secret-key-here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🛡️ Security Considerations

- **CORS Origin**: Set `CORS_ORIGIN` to your domain in production
- **File Upload Limits**: Adjust `MAX_FILE_SIZE` based on your needs
- **Rate Limiting**: Configure `RATE_LIMIT_*` settings for your traffic
- **SSL/TLS**: Use a reverse proxy (nginx) for SSL termination
- **Firewall**: Only expose necessary ports (80, 443)

## 📊 Monitoring & Logging

### Health Check
- Endpoint: `GET /health`
- Returns server status, uptime, and version

### Logs
- Production logs: `./logs/`
- Error logs: `./logs/error.log`
- Combined logs: `./logs/combined.log`

### PM2 Commands
```bash
pm2 logs musicroom        # View logs
pm2 restart musicroom     # Restart app
pm2 stop musicroom        # Stop app
pm2 delete musicroom      # Remove app
pm2 monit                 # Monitor dashboard
```

## 🔄 Updates & Maintenance

### Rolling Updates with PM2
```bash
git pull origin main
npm ci --production
npm run pm2:restart
```

### Docker Updates
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

## 🌐 Reverse Proxy Setup (Nginx)

Create `/etc/nginx/sites-available/musicroom`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static file optimization
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

## 📈 Performance Optimization

- **PM2 Cluster Mode**: Runs multiple instances
- **Compression**: Gzip compression enabled
- **Static File Caching**: Nginx handles static files
- **Rate Limiting**: Prevents abuse
- **Memory Management**: Automatic restart on memory limit

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Permission Errors**
   ```bash
   sudo chown -R $USER:$USER uploads/ logs/
   ```

3. **Docker Build Issues**
   ```bash
   docker system prune -a
   docker-compose build --no-cache
   ```

### Logs Analysis
```bash
# PM2 logs
pm2 logs musicroom --lines 100

# Docker logs
docker-compose logs -f musicroom

# System logs
tail -f ./logs/error.log
```

## 🔄 Backup Strategy

### Files to Backup
- `uploads/` - User uploaded audio files
- `.env` - Environment configuration
- `logs/` - Application logs (optional)

### Automated Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "musicroom_backup_$DATE.tar.gz" uploads/ .env
```

## 📞 Support

For production issues:
1. Check application logs
2. Verify environment configuration
3. Test health endpoint: `curl http://localhost:3000/health`
4. Monitor system resources

## 🔒 Security Checklist

- [ ] SSL certificate installed
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] File upload restrictions in place
- [ ] Regular security updates
- [ ] Firewall configured
- [ ] Backup strategy implemented
