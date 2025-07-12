# Darkline - Decentralized Chat System

A secure, decentralized chat application with end-to-end encryption using Curve25519 + AES-GCM.

## Features

- 🔐 **End-to-End Encryption**: Curve25519 key exchange + AES-GCM
- 🏠 **Room-based Chat**: Create public, password-protected, or P2P rooms
- 💬 **Direct Messaging**: Private conversations between users
- ⭐ **Favorites System**: Mark important users as favorites
- 📢 **Mentions**: Notify users with @nickname
- 💾 **Store & Forward**: Messages delivered when users come online
- 🌐 **Decentralized**: Connect to any server or run your own
- 🚫 **No Tracking**: Privacy-focused design

## Installation

### Linux (Ubuntu/Debian)
```bash
# Install Node.js if not already installed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install Darkline
git clone <repository-url>
cd darkline
npm install
npm run build

# Make globally available
sudo npm link
```

### Windows
1. Install [Node.js](https://nodejs.org/) (LTS version)
2. Download and extract Darkline
3. Open Command Prompt as Administrator:
```cmd
cd path\to\darkline
npm install
npm run build
npm link
```

### Android APK
Build and install the mobile app:
```bash
# Build APK (requires Expo account)
bash scripts/build-android.sh

# Or for local development
cd mobile
npm install
expo start
```

## Quick Start

### 1. Start a Server
```bash
# Interactive server setup
darkline create-server

# Or start with defaults
darkline server --port 8080 --host localhost
```

### 2. Connect as Client
```bash
# Connect to a server
darkline connect --server ws://localhost:8080 --nickname YourName

# Or with interactive setup
darkline connect
```

## Usage

### Chat Commands
- `/help` - Show available commands
- `/users` - List online users
- `/rooms` - List available rooms
- `/join #roomname [password]` - Join a room
- `/create roomname [type] [password]` - Create new room
- `/leave` - Leave current room
- `/favorite username` - Toggle user as favorite
- `@username message` - Send direct message
- `/quit` - Exit chat

### Room Types
- **Public**: Anyone can join (default)
- **Password**: Requires password to join
- **P2P**: Direct peer-to-peer rooms

### Mentions
Use `@username` in messages to notify specific users.

## Server Configuration

### Environment Variables
```bash
DARKLINE_PORT=8080
DARKLINE_HOST=localhost
DARKLINE_MAX_CONNECTIONS=100
DARKLINE_ENABLE_P2P=true
DARKLINE_STORE_MESSAGES=true
```

### Custom Server
```bash
darkline server \
  --port 8080 \
  --host 0.0.0.0 \
  --name "My Server" \
  --max-connections 200 \
  --no-p2p \
  --no-store
```

## Security

- **Key Exchange**: Curve25519 elliptic curve
- **Encryption**: AES-256-GCM with random nonces
- **No Plaintext Storage**: Messages encrypted in transit and storage
- **Perfect Forward Secrecy**: New keys per session
- **No User Tracking**: Privacy by design

## Development

### Build from Source
```bash
git clone <repository-url>
cd darkline
npm install
npm run build
```

### Run Tests
```bash
npm test
```

### Development Mode
```bash
# Server
npm run dev

# Client (separate terminal)
npm run start
```

## Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Client App    │◄───────────────►│  Darkline       │
│                 │                 │  Server         │
│ - Chat UI       │                 │                 │
│ - Encryption    │                 │ - Message       │
│ - P2P Support   │                 │   Routing       │
└─────────────────┘                 │ - User Mgmt     │
                                    │ - Room Mgmt     │
                                    │ - Store & Fwd   │
                                    └─────────────────┘
```

## API Protocol

### Message Types
- `handshake` - Initial connection
- `join` - Join server with nickname
- `message` - Room message
- `dm` - Direct message
- `create_room` - Create new room
- `join_room` - Join existing room
- `leave_room` - Leave room

### Example Message
```json
{
  "type": "message",
  "payload": {
    "roomId": "general",
    "content": "Hello @username!",
    "mentions": ["username"]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please create an issue on the repository.