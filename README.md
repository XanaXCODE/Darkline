# 🌑 DarkLine

**Decentralized Terminal Chat Application**

DarkLine is a peer-to-peer, terminal-based chat application that enables secure, encrypted communication without relying on centralized servers. Built with Node.js, it features automatic peer discovery, end-to-end encryption, and a beautiful terminal interface.

## ✨ Features

- 🔐 **End-to-End Encryption**: All messages are encrypted using RSA + AES hybrid encryption
- 🌐 **Decentralized P2P Network**: No central server required - peers discover each other automatically
- 💻 **Terminal UI**: Clean, responsive terminal interface built with Blessed
- 💾 **Local Storage**: All contacts and message history stored locally
- 🔑 **Identity Management**: Automatic key generation and identity management
- 🔍 **Auto-Discovery**: Automatic peer discovery on local network
- 📱 **Contact Management**: Add, remove, and manage contacts
- 💬 **Real-time Chat**: Instant messaging with online/offline status
- 🔒 **Privacy-First**: No data collection, everything stays on your device

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd darkline

# Install dependencies
npm install

# Start the application
npm start
```

### Building from Source

```bash
# Install dependencies
npm install

# Build (no build step required for Node.js)
npm run build

# Start DarkLine
npm start
```

## 🎮 Usage

### Interface Overview

DarkLine features a **hacker-style terminal interface** similar to Claude:
- **Main Area**: Scrollable output with command history and messages
- **Command Line**: Bottom input area with green prompt
- **Command-Based**: All actions done via text commands

### Commands

#### 🔧 **System Commands**
```bash
help              # Show all available commands
address           # Show your network address
clear             # Clear screen (or Ctrl+L)
exit              # Exit DarkLine (or Ctrl+C)
```

#### 👥 **Contact Management**
```bash
contacts          # List all contacts (saved + online)
add <name> <ip>   # Add contact manually
                  # Example: add john 192.168.1.100:8080
```

#### 💬 **Messaging** 
```bash
connect <name>    # Start chat with contact
/disconnect       # Exit current chat
# Type normally to send messages when connected
```

### First Launch

1. Run `npm start`
2. DarkLine will:
   - Generate your unique identity
   - Create data directory (`~/.darkline`) 
   - Start network discovery
   - Show the ASCII art welcome screen

### Example Session

```bash
darkline> help                    # Show commands
darkline> address                 # Get your address  
darkline> add alice 192.168.1.50  # Add contact
darkline> contacts                # List contacts
darkline> connect alice           # Start chatting
[alice]> Hello Alice!             # Send message
[alice]> /disconnect              # Exit chat
darkline> exit                    # Quit
```

### Navigation Shortcuts

- **↑/↓**: Command history navigation
- **Ctrl+C**: Exit application  
- **Ctrl+L**: Clear screen
- **Tab**: Focus input (if needed)

## 🔧 Configuration

Configuration is handled in `src/config/config.js`:

```javascript
{
  network: {
    port: 8080,                    // Main WebSocket port
    discoveryPorts: [8080, 8081],  // Discovery ports
    timeout: 5000,                 // Connection timeout
    maxConnections: 50             // Max concurrent connections
  },
  
  storage: {
    dataDir: '~/.darkline',        // Data directory
    contactsFile: 'contacts.json', // Contacts file
    messagesFile: 'messages.json'  // Messages file
  },
  
  security: {
    keySize: 2048,                 // RSA key size
    encryptionAlgorithm: 'aes-256-gcm' // Encryption algorithm
  }
}
```

## 🏗️ Architecture

### Core Components

- **DarkLine**: Main application coordinator
- **NetworkManager**: P2P networking and peer discovery
- **UIManager**: Terminal interface using Blessed
- **StorageManager**: Local data persistence
- **CryptoManager**: Encryption and security
- **Identity**: User identity and key management

### Network Protocol

1. **Discovery**: UDP broadcasts for peer discovery
2. **Connection**: WebSocket connections between peers
3. **Handshake**: Exchange of public keys and identity verification
4. **Messaging**: Encrypted message exchange with digital signatures

### Security Model

- **RSA 2048-bit** keys for identity and key exchange
- **AES-256-GCM** for message encryption
- **Digital signatures** for message authentication
- **Key fingerprints** for identity verification
- **Local storage** only - no cloud sync

## 📁 Project Structure

```
darkline/
├── src/
│   ├── core/
│   │   ├── DarkLine.js      # Main application
│   │   ├── NetworkManager.js # P2P networking
│   │   ├── UIManager.js     # Terminal interface
│   │   ├── StorageManager.js # Data persistence
│   │   ├── CryptoManager.js # Encryption
│   │   └── Identity.js      # Identity management
│   ├── config/
│   │   └── config.js        # Configuration
│   └── index.js             # Entry point
├── package.json
└── README.md
```

## 🔒 Privacy & Security

### What DarkLine Does

- ✅ Encrypts all messages end-to-end
- ✅ Stores data locally only
- ✅ Uses strong cryptographic algorithms
- ✅ Verifies message integrity
- ✅ Generates unique identities

### What DarkLine Doesn't Do

- ❌ No central servers
- ❌ No data collection
- ❌ No cloud storage
- ❌ No analytics or tracking
- ❌ No plaintext storage

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

### Dependencies

- **blessed**: Terminal UI framework
- **ws**: WebSocket implementation
- **node-forge**: Cryptography library
- **uuid**: UUID generation

### Adding Features

1. Core functionality goes in `src/core/`
2. Configuration in `src/config/`
3. Follow the existing architecture patterns
4. Maintain security best practices

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using port 8080
lsof -i :8080
# Kill the process or change port in config
```

**Network Discovery Issues**
- Ensure UDP port 9080 is not blocked
- Check firewall settings
- Verify network connectivity

**Identity/Key Issues**
- Delete `~/.darkline/identity.json` to regenerate
- Ensure sufficient entropy for key generation

### Debug Mode

Set `DEBUG=darkline:*` environment variable for verbose logging:

```bash
DEBUG=darkline:* npm start
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues, questions, or contributions:

- Open an issue on GitHub
- Check the troubleshooting section
- Review the code documentation

---

**DarkLine** - Secure, Private, Decentralized Chat 🌑