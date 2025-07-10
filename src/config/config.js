const os = require('os');
const path = require('path');

module.exports = {
  // PeerJS Server configuration
  peerServer: {
    host: 'localhost',
    port: 9000,
    path: '/peerjs',
    key: 'peerjs'
  },
  
  // Network configuration (legacy - kept for compatibility)
  port: 8080,
  maxConnections: 50,
  timeout: 5000,
  
  // Storage configuration
  storage: {
    dataDir: path.join(os.homedir(), '.darkline'),
    contactsFile: 'contacts.json',
    messagesFile: 'messages.json',
    identityFile: 'identity.json'
  },
  
  // UI configuration
  ui: {
    theme: 'dark',
    refreshRate: 100,
    maxMessageHistory: 1000
  },
  
  // Security configuration
  security: {
    keySize: 2048,
    encryptionAlgorithm: 'aes-256-gcm'
  }
};