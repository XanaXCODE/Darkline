const blessed = require('blessed');
const EventEmitter = require('events');

class UIManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.screen = null;
    this.contactList = null;
    this.chatBox = null;
    this.messageInput = null;
    this.statusBar = null;
    this.currentChat = null;
    this.contacts = new Map();
    this.messages = new Map();
    this.isRunning = false;
  }

  async init() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'DarkLine Chat',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'white'
      }
    });

    this.createLayout();
    this.setupEventHandlers();
    this.setupKeyBindings();
  }

  createLayout() {
    // Main container
    const container = blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: {
        bg: 'black'
      }
    });

    // Contact list (left panel)
    this.contactList = blessed.list({
      parent: container,
      label: ' 📋 Contacts (Online) ',
      width: '30%',
      height: '90%',
      left: 0,
      top: 0,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white',
        selected: {
          bg: 'cyan',
          fg: 'black'
        },
        item: {
          hover: {
            bg: 'blue',
            fg: 'white'
          }
        }
      },
      keys: true,
      mouse: true,
      scrollable: true,
      items: ['📡 Discovering peers...']
    });

    // Chat area (right panel)
    this.chatBox = blessed.box({
      parent: container,
      label: ' 💬 Chat ',
      width: '70%',
      height: '80%',
      left: '30%',
      top: 0,
      border: {
        type: 'line',
        fg: 'green'
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      content: '🌑 Welcome to DarkLine!\n\nSelect a contact to start chatting.\n\nShortcuts:\n• Tab: Switch between panels\n• Ctrl+C: Quit\n• Ctrl+A: Add contact\n• Enter: Send message'
    });

    // Message input (bottom right)
    this.messageInput = blessed.textbox({
      parent: container,
      label: ' ✍️  Message ',
      width: '70%',
      height: '10%',
      left: '30%',
      top: '80%',
      border: {
        type: 'line',
        fg: 'yellow'
      },
      style: {
        bg: 'black',
        fg: 'white',
        focus: {
          bg: 'black',
          fg: 'yellow'
        }
      },
      inputOnFocus: true,
      mouse: true,
      keys: true
    });

    // Status bar (bottom)
    this.statusBar = blessed.box({
      parent: container,
      width: '100%',
      height: '10%',
      left: 0,
      top: '90%',
      border: {
        type: 'line',
        fg: 'magenta'
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      content: '🔵 Status: Starting...'
    });
  }

  setupEventHandlers() {
    // Contact selection
    this.contactList.on('select', (item, index) => {
      const contactId = this.contactList.items[index].contactId;
      if (contactId) {
        this.selectContact(contactId);
      }
    });

    // Message input
    this.messageInput.on('submit', (text) => {
      if (text.trim() && this.currentChat) {
        this.sendMessage(text.trim());
        this.messageInput.clearValue();
        this.screen.render();
      }
    });

    // Focus management
    this.messageInput.on('focus', () => {
      this.statusBar.setContent('🟢 Type your message and press Enter to send');
      this.screen.render();
    });

    this.contactList.on('focus', () => {
      this.statusBar.setContent('🔵 Select a contact to chat');
      this.screen.render();
    });
  }

  setupKeyBindings() {
    // Quit application
    this.screen.key(['C-c', 'q'], () => {
      process.exit(0);
    });

    // Tab switching
    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.contactList) {
        if (this.currentChat) {
          this.messageInput.focus();
        }
      } else {
        this.contactList.focus();
      }
    });

    // Add contact
    this.screen.key(['C-a'], () => {
      this.showAddContactDialog();
    });

    // Show my address
    this.screen.key(['C-s'], () => {
      this.showMyAddress();
    });

    // Refresh
    this.screen.key(['f5'], () => {
      this.refreshUI();
    });

    // Help
    this.screen.key(['f1'], () => {
      this.showHelp();
    });
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.contactList.focus();
    this.updateStatus('🟢 Ready - Waiting for connections...');
    this.screen.render();
  }

  addPeer(peer) {
    this.contacts.set(peer.id, {
      id: peer.id,
      name: peer.name,
      online: true,
      lastSeen: Date.now()
    });
    
    this.refreshContactList();
    this.updateStatus(`🔵 ${peer.name} connected`);
  }

  removePeer(peerId) {
    const contact = this.contacts.get(peerId);
    if (contact) {
      contact.online = false;
      contact.lastSeen = Date.now();
      this.refreshContactList();
      this.updateStatus(`🔴 ${contact.name} disconnected`);
    }
  }

  refreshContactList() {
    const items = [];
    
    for (const contact of this.contacts.values()) {
      const status = contact.online ? '🟢' : '🔴';
      const item = `${status} ${contact.name}`;
      items.push(item);
      
      // Store contact ID for reference
      const itemIndex = items.length - 1;
      if (!this.contactList.items[itemIndex]) {
        this.contactList.items[itemIndex] = {};
      }
      this.contactList.items[itemIndex].contactId = contact.id;
    }

    if (items.length === 0) {
      items.push('📡 No contacts online');
    }

    this.contactList.setItems(items);
    this.screen.render();
  }

  selectContact(contactId) {
    const contact = this.contacts.get(contactId);
    if (!contact) return;

    this.currentChat = contactId;
    this.chatBox.setLabel(` 💬 Chat with ${contact.name} `);
    
    // Load chat history
    this.loadChatHistory(contactId);
    
    // Focus message input
    this.messageInput.focus();
    this.screen.render();
  }

  loadChatHistory(contactId) {
    const messages = this.messages.get(contactId) || [];
    let content = '';
    
    if (messages.length === 0) {
      content = `🌑 Start a conversation with ${this.contacts.get(contactId)?.name || 'Unknown'}!\n\n`;
    } else {
      content = messages.map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.from === contactId ? this.contacts.get(contactId)?.name : 'You';
        return `[${time}] ${sender}: ${msg.text}`;
      }).join('\n') + '\n\n';
    }
    
    this.chatBox.setContent(content);
    this.chatBox.scrollTo(this.chatBox.getScrollHeight());
    this.screen.render();
  }

  displayMessage(message) {
    if (!this.messages.has(message.from)) {
      this.messages.set(message.from, []);
    }
    
    this.messages.get(message.from).push(message);
    
    // If this is the current chat, refresh the display
    if (this.currentChat === message.from) {
      this.loadChatHistory(message.from);
    }
    
    // Show notification
    const senderName = this.contacts.get(message.from)?.name || 'Unknown';
    this.updateStatus(`💬 New message from ${senderName}`);
  }

  sendMessage(text) {
    if (!this.currentChat) return;
    
    const message = {
      id: require('uuid').v4(),
      from: 'self',
      to: this.currentChat,
      text: text,
      timestamp: Date.now()
    };
    
    // Add to local message history
    if (!this.messages.has(this.currentChat)) {
      this.messages.set(this.currentChat, []);
    }
    this.messages.get(this.currentChat).push(message);
    
    // Refresh chat display
    this.loadChatHistory(this.currentChat);
    
    // Emit event for network layer
    this.emit('send_message', {
      peerId: this.currentChat,
      message: text
    });
  }

  showAddContactDialog() {
    const form = blessed.form({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: 60,
      height: 12,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      label: ' Add Contact '
    });

    const helpText = blessed.box({
      parent: form,
      content: 'Enter IP:PORT (e.g., 192.168.1.100:8080) or just IP (uses default port 8080)',
      width: '90%',
      height: 2,
      left: 'center',
      top: 0,
      style: {
        bg: 'black',
        fg: 'yellow'
      }
    });

    const nameInput = blessed.textbox({
      parent: form,
      label: ' Name: ',
      width: '80%',
      height: 3,
      left: 'center',
      top: 2,
      border: {
        type: 'line'
      },
      style: {
        bg: 'black',
        fg: 'white',
        focus: {
          bg: 'blue'
        }
      },
      inputOnFocus: true
    });

    const addressInput = blessed.textbox({
      parent: form,
      label: ' Address (IP:PORT): ',
      width: '80%',
      height: 3,
      left: 'center',
      top: 5,
      border: {
        type: 'line'
      },
      style: {
        bg: 'black',
        fg: 'white',
        focus: {
          bg: 'blue'
        }
      },
      inputOnFocus: true
    });

    const submitButton = blessed.button({
      parent: form,
      content: ' Add Contact ',
      width: 15,
      height: 3,
      left: 'center',
      top: 8,
      border: {
        type: 'line'
      },
      style: {
        bg: 'green',
        fg: 'white',
        focus: {
          bg: 'white',
          fg: 'green'
        }
      },
      mouse: true
    });

    form.key(['escape', 'C-c'], () => {
      form.destroy();
      this.screen.render();
    });

    form.key(['tab'], () => {
      if (nameInput.focused) {
        addressInput.focus();
      } else if (addressInput.focused) {
        submitButton.focus();
      } else {
        nameInput.focus();
      }
    });

    const addContact = () => {
      const name = nameInput.getValue().trim();
      const address = addressInput.getValue().trim();
      
      if (name && address) {
        // Parse address - add default port if not provided
        let finalAddress = address;
        if (!address.includes(':')) {
          finalAddress = `${address}:8080`;
        }
        
        this.emit('add_contact', { name, address: finalAddress });
        form.destroy();
        this.screen.render();
      } else {
        this.showError('Please enter both name and address');
      }
    };

    form.key(['enter'], addContact);
    submitButton.on('press', addContact);

    nameInput.focus();
    this.screen.render();
  }

  showMyAddress() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIPs = [];
    
    // Get all local IP addresses
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIPs.push(iface.address);
        }
      }
    }
    
    const port = this.config.network?.port || 8080;
    const addresses = localIPs.map(ip => `${ip}:${port}`);
    
    const addressBox = blessed.box({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: 70,
      height: 15,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      label: ' 📍 My Address ',
      content: `
🌐 Share these addresses with friends to connect:

${addresses.map(addr => `📡 ${addr}`).join('\n')}

${localIPs.length === 0 ? '⚠️  No network interfaces found' : ''}

💡 Your friends can add you using any of these addresses.
🔄 Your address changes if you switch networks.
🏠 Local network addresses work only on the same WiFi/LAN.

Press any key to close.
      `
    });

    addressBox.key(['C-c', 'escape', 'enter', 'space'], () => {
      addressBox.destroy();
      this.screen.render();
    });

    addressBox.focus();
    this.screen.render();
  }

  showHelp() {
    const help = blessed.box({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: 60,
      height: 20,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      label: ' Help ',
      content: `
🌑 DarkLine - Decentralized Chat

NAVIGATION:
• Tab         - Switch between panels
• Arrow keys  - Navigate lists
• Enter       - Select/Send
• Escape      - Cancel/Back

SHORTCUTS:
• Ctrl+C / q  - Quit application
• Ctrl+A      - Add contact manually
• Ctrl+S      - Show my address
• F1          - Show this help
• F5          - Refresh interface

USAGE:
1. Contacts appear automatically when online
2. Select a contact to start chatting
3. Type messages and press Enter to send
4. Messages are encrypted end-to-end
5. Use Ctrl+S to see your address to share

Press any key to close this help.
      `
    });

    help.key(['C-c', 'escape', 'enter', 'space'], () => {
      help.destroy();
      this.screen.render();
    });

    help.focus();
    this.screen.render();
  }

  updateStatus(message) {
    this.statusBar.setContent(`🔵 ${message}`);
    this.screen.render();
  }

  showError(message) {
    this.updateStatus(`❌ Error: ${message}`);
  }

  refreshUI() {
    this.refreshContactList();
    this.updateStatus('🔄 Interface refreshed');
  }

  refreshContacts() {
    this.refreshContactList();
  }

  stop() {
    if (this.screen) {
      this.screen.destroy();
    }
    this.isRunning = false;
  }
}

module.exports = UIManager;