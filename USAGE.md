# Darkline Usage Guide

## Quick Start Example

### 1. Start a Test Server
```bash
# Terminal 1: Start server
darkline server --port 8080 --host localhost --name "Test Server"
```

### 2. Connect First Client
```bash
# Terminal 2: Connect as Alice
darkline connect --server ws://localhost:8080 --nickname Alice
```

### 3. Connect Second Client
```bash
# Terminal 3: Connect as Bob
darkline connect --server ws://localhost:8080 --nickname Bob
```

### 4. Chat Examples

**Basic Chat:**
```
[#general] Alice: Hello everyone!
[#general] Bob: Hey Alice, how's it going?
```

**Direct Messages:**
```
[#general] Alice: @Bob Want to chat privately?
[#general] Bob: Sure! DMing you now.
```

**Create Private Room:**
```
[#general] Alice: /create private-room password mysecret
[#general] Bob: /join private-room mysecret
```

## Advanced Features

### Room Management

#### Create Rooms
```bash
# Public room
/create announcements

# Password-protected room
/create private-chat password secret123

# P2P room (direct peer connection)
/create p2p-room p2p
```

#### Join/Leave Rooms
```bash
# Join public room
/join #announcements

# Join password-protected room
/join #private-chat secret123

# Leave current room
/leave
```

### Direct Messaging

#### Send Direct Messages
```bash
# From command line
@username Hello there!

# Multiple recipients (mentions)
Hey @alice and @bob, check this out!
```

#### Favorites System
```bash
# Add user to favorites
/favorite alice

# Remove from favorites
/favorite alice

# View favorites (starred users in /users list)
/users
```

### Mentions and Notifications

#### Mention Users
```bash
# Single mention
@alice did you see the news?

# Multiple mentions
@alice @bob @charlie meeting in 5 minutes!
```

#### Notification Features
- 🔔 Visual indicator for mentions
- Audio notification (if supported)
- Favorite users highlighted with ⭐

## Server Configuration

### Basic Server Setup
```bash
# Interactive setup
darkline create-server

# Manual configuration
darkline server \
  --port 8080 \
  --host 0.0.0.0 \
  --name "My Chat Server" \
  --max-connections 100 \
  --no-p2p \
  --no-store
```

### Server Options
- `--port`: Server port (default: 8080)
- `--host`: Server host (default: localhost)
- `--name`: Server display name
- `--max-connections`: Maximum concurrent connections
- `--no-p2p`: Disable P2P room support
- `--no-store`: Disable message storage for offline users

### Public Server Setup
```bash
# For public access
darkline server \
  --port 8080 \
  --host 0.0.0.0 \
  --name "Public Chat Server" \
  --max-connections 500
```

## Security Features

### End-to-End Encryption
- **Key Exchange**: Curve25519 ECDH
- **Encryption**: AES-256-GCM
- **Perfect Forward Secrecy**: New keys per session
- **No Plaintext Storage**: All messages encrypted

### Privacy Features
- **No User Tracking**: No analytics or logging
- **Decentralized**: No central authority
- **Local Storage**: Messages stored locally only
- **Secure by Default**: All communications encrypted

## Mobile App Usage

### Android Installation
1. Build APK using `bash scripts/build-android.sh` (requires Expo account)
2. Or download from releases (when available)
3. Enable "Unknown Sources" in Android settings
4. Install APK
5. Open app and enter server details

### Development Setup
```bash
cd mobile
npm install
expo start
# Scan QR code with Expo Go app
```

### Mobile Features
- All desktop features available
- Touch-optimized interface
- Background notifications
- Offline message storage

## Troubleshooting

### Connection Issues
```bash
# Check server status
curl -I http://localhost:8080

# Test WebSocket connection
wscat -c ws://localhost:8080

# Check firewall settings
sudo ufw status
```

### Common Problems

#### "Connection Refused"
- Ensure server is running
- Check firewall settings
- Verify correct port/host

#### "Handshake Failed"
- Server might be overloaded
- Check server logs
- Try different server

#### "Messages Not Delivering"
- Check network connectivity
- Verify recipient is online
- Check server message storage settings

### Debug Mode
```bash
# Enable verbose logging
DEBUG=darkline* darkline server
DEBUG=darkline* darkline connect
```

## Production Deployment

### Server Deployment
```bash
# Install on server
git clone <repo>
cd darkline
npm install
npm run build

# Run with PM2
npm install -g pm2
pm2 start "darkline server --port 8080 --host 0.0.0.0"
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

### SSL/TLS Setup
```bash
# Using reverse proxy (nginx)
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Reference

### Client Messages
```json
{
  "type": "message",
  "payload": {
    "roomId": "general",
    "content": "Hello world!",
    "mentions": ["alice"]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Server Messages
```json
{
  "type": "message",
  "payload": {
    "message": {
      "id": "msg-123",
      "fromNickname": "Alice",
      "content": "Hello world!",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Performance Tuning

### Server Optimization
```bash
# Increase connection limits
ulimit -n 65536

# Optimize Node.js
node --max-old-space-size=4096 dist/server/index.js
```

### Client Optimization
```bash
# Reduce message history
export DARKLINE_MAX_HISTORY=100

# Disable animations
export DARKLINE_NO_ANIMATIONS=true
```

## Contributing

### Development Setup
```bash
git clone <repo>
cd darkline
npm install
npm run build
npm test
```

### Adding Features
1. Create feature branch
2. Implement feature with tests
3. Update documentation
4. Submit pull request

## License

MIT License - see LICENSE file for details.