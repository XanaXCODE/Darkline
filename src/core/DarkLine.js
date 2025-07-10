const EventEmitter = require('events');
const NetworkManager = require('./NetworkManager');
const StorageManager = require('./StorageManager');
const UIManager = require('./UIManager');
const CryptoManager = require('./CryptoManager');
const Identity = require('./Identity');
const PeerServerManager = require('./PeerServer');

class DarkLine extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.identity = null;
    this.networkManager = null;
    this.storageManager = null;
    this.uiManager = null;
    this.cryptoManager = null;
    this.peerServerManager = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      throw new Error('DarkLine is already running');
    }

    try {
      // Initialize storage
      this.storageManager = new StorageManager(this.config.storage);
      await this.storageManager.init();

      // Initialize or load identity
      this.identity = new Identity(this.storageManager);
      await this.identity.init();

      // Initialize crypto manager
      this.cryptoManager = new CryptoManager(this.config.security);

      // Initialize network manager
      this.networkManager = new NetworkManager(this.config, this.identity);
      await this.networkManager.start();

      // Initialize UI
      this.uiManager = new UIManager(this.config.ui);
      await this.uiManager.init();

      // Load saved contacts
      await this.loadSavedContacts();

      // Setup event handlers
      this.setupEventHandlers();

      this.isRunning = true;
      
      // Start UI loop
      this.uiManager.start();
      
    } catch (error) {
      throw new Error(`Failed to start DarkLine: ${error.message}`);
    }
  }

  setupEventHandlers() {
    // Network events
    this.networkManager.on('peer_connected', (peer) => {
      this.uiManager.addPeer(peer);
    });

    this.networkManager.on('peer_disconnected', (peerId) => {
      this.uiManager.removePeer(peerId);
    });

    this.networkManager.on('message_received', (message) => {
      this.handleIncomingMessage(message);
    });

    // UI events
    this.uiManager.on('send_message', (data) => {
      this.sendMessage(data.peerId, data.message);
    });

    this.uiManager.on('add_contact', (contact) => {
      this.addContact(contact);
    });
  }

  async handleIncomingMessage(message) {
    try {
      const decryptedMessage = await this.cryptoManager.decrypt(message);
      await this.storageManager.saveMessage(decryptedMessage);
      this.uiManager.displayMessage(decryptedMessage);
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }

  async sendMessage(peerId, messageText) {
    try {
      const message = {
        id: require('uuid').v4(),
        from: this.identity.getId(),
        to: peerId,
        text: messageText,
        timestamp: Date.now()
      };

      const encryptedMessage = await this.cryptoManager.encrypt(message, peerId);
      await this.networkManager.sendMessage(peerId, encryptedMessage);
      await this.storageManager.saveMessage(message);
      
    } catch (error) {
      this.uiManager.showError(`Failed to send message: ${error.message}`);
    }
  }

  async loadSavedContacts() {
    try {
      const savedContacts = await this.storageManager.loadContacts();
      for (const contact of savedContacts) {
        this.uiManager.addSavedContact(contact);
      }
    } catch (error) {
      console.error('Failed to load saved contacts:', error);
    }
  }

  async addContact(contact) {
    try {
      // Add unique ID if not present
      if (!contact.id) {
        contact.id = require('uuid').v4();
      }
      
      await this.storageManager.saveContact(contact);
      this.uiManager.addSavedContact(contact);
      this.uiManager.refreshContacts();
    } catch (error) {
      this.uiManager.showError(`Failed to add contact: ${error.message}`);
    }
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.networkManager) {
      await this.networkManager.stop();
    }
    
    if (this.uiManager) {
      this.uiManager.stop();
    }
  }
}

module.exports = DarkLine;