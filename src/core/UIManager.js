const blessed = require('blessed');
const EventEmitter = require('events');

class UIManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.screen = null;
    this.mainBox = null;
    this.inputBox = null;
    this.currentMode = 'chat'; // 'chat', 'contacts', 'command'
    this.currentChat = null;
    this.contacts = new Map();
    this.savedContacts = new Map();
    this.messages = new Map();
    this.commandHistory = [];
    this.historyIndex = 0;
    this.isRunning = false;
    this.output = [];
    this.maxOutput = 1000;
  }

  async init() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'DarkLine',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'green'
      },
      debug: false
    });

    this.createLayout();
    this.setupEventHandlers();
    this.setupKeyBindings();
    this.displayWelcome();
  }

  createLayout() {
    // Main output area
    this.mainBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      content: '',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: {
        bg: 'black',
        fg: 'green'
      },
      scrollbar: {
        style: {
          bg: 'green'
        }
      }
    });

    // Input area
    this.inputBox = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      inputOnFocus: true,
      tags: false,
      style: {
        bg: 'black',
        fg: 'bright-green',
        focus: {
          bg: 'black',
          fg: 'bright-green'
        }
      },
      border: {
        type: 'line',
        fg: 'green'
      }
    });

    this.updatePrompt();
  }

  setupEventHandlers() {
    this.inputBox.on('submit', (input) => {
      this.handleInput(input.trim());
      this.inputBox.clearValue();
      this.screen.render();
    });

    this.inputBox.on('keypress', (ch, key) => {
      if (key.name === 'up' && this.commandHistory.length > 0) {
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        this.inputBox.setValue(this.commandHistory[this.historyIndex]);
        this.screen.render();
      } else if (key.name === 'down' && this.commandHistory.length > 0) {
        this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
        this.inputBox.setValue(this.commandHistory[this.historyIndex]);
        this.screen.render();
      }
    });
  }

  setupKeyBindings() {
    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    this.screen.key(['C-l'], () => {
      this.clearScreen();
    });

    this.screen.key(['tab'], () => {
      this.inputBox.focus();
    });
  }

  displayWelcome() {
    const welcome = [
      '',
      '{bold}{green-fg}██████╗  █████╗ ██████╗ ██╗  ██╗██╗     ██╗███╗   ██╗███████╗{/}',
      '{bold}{green-fg}██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝██║     ██║████╗  ██║██╔════╝{/}',
      '{bold}{green-fg}██║  ██║███████║██████╔╝█████╔╝ ██║     ██║██╔██╗ ██║█████╗{/}',
      '{bold}{green-fg}██║  ██║██╔══██║██╔══██╗██╔═██╗ ██║     ██║██║╚██╗██║██╔══╝{/}',
      '{bold}{green-fg}██████╔╝██║  ██║██║  ██║██║  ██╗███████╗██║██║ ╚████║███████╗{/}',
      '{bold}{green-fg}╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝{/}',
      '',
      '{bold}{cyan-fg}[SECURE DECENTRALIZED CHAT TERMINAL]{/}',
      '{dim}VERSION 1.0.0 | P2P ENCRYPTED MESSAGING{/}',
      '',
      '{yellow-fg}AVAILABLE COMMANDS:{/}',
      '  {bold}help{/}        - Show all commands',
      '  {bold}contacts{/}    - List all contacts',
      '  {bold}add{/}         - Add new contact',
      '  {bold}connect{/}     - Connect to contact',
      '  {bold}address{/}     - Show my address',
      '  {bold}clear{/}       - Clear screen',
      '  {bold}exit{/}        - Exit DarkLine',
      '',
      '{green-fg}Ready. Type {bold}help{/}{green-fg} for commands.{/}',
      ''
    ];

    this.addOutput(welcome);
  }

  handleInput(input) {
    if (!input) return;

    // Add to history
    this.commandHistory.push(input);
    this.historyIndex = this.commandHistory.length;

    // Show input in output
    this.addOutput(`{dim}${this.getPrompt()}{/}${input}`);

    // Parse command
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
      case 'h':
        this.showHelp();
        break;
      case 'contacts':
      case 'c':
        this.showContacts();
        break;
      case 'add':
      case 'a':
        this.addContactCommand(args);
        break;
      case 'connect':
      case 'conn':
        this.connectCommand(args);
        break;
      case 'address':
      case 'addr':
        this.showAddress();
        break;
      case 'clear':
      case 'cls':
        this.clearScreen();
        break;
      case 'exit':
      case 'quit':
      case 'q':
        process.exit(0);
        break;
      default:
        if (this.currentChat) {
          this.sendMessage(input);
        } else {
          this.addOutput(`{red-fg}Unknown command: {bold}${command}{/}{red-fg}. Type {bold}help{/}{red-fg} for available commands.{/}`);
        }
    }
  }

  showHelp() {
    const help = [
      '',
      '{bold}{cyan-fg}[DARKLINE COMMANDS]{/}',
      '',
      '{bold}CONTACT MANAGEMENT:{/}',
      '  {bold}contacts{/}           - List all contacts',
      '  {bold}add <name> <ip:port>{/} - Add contact (e.g., add john 192.168.1.100:8080)',
      '  {bold}connect <name>{/}      - Connect to contact for chat',
      '',
      '{bold}MESSAGING:{/}',
      '  {bold}connect <name>{/}      - Start chatting with contact',
      '  {bold}/disconnect{/}         - Disconnect from current chat',
      '  {bold}Type normally{/}       - Send message when connected',
      '',
      '{bold}SYSTEM:{/}',
      '  {bold}address{/}             - Show your address to share',
      '  {bold}clear{/}               - Clear screen',
      '  {bold}exit{/}                - Exit DarkLine',
      '',
      '{bold}SHORTCUTS:{/}',
      '  {bold}Ctrl+C{/}              - Exit',
      '  {bold}Ctrl+L{/}              - Clear screen',
      '  {bold}↑/↓{/}                 - Command history',
      ''
    ];

    this.addOutput(help);
  }

  showContacts() {
    const allContacts = new Map([...this.savedContacts, ...this.contacts]);
    
    if (allContacts.size === 0) {
      this.addOutput([
        '',
        '{yellow-fg}No contacts found. Add contacts with:{/}',
        '  {bold}add <name> <ip:port>{/}',
        ''
      ]);
      return;
    }

    const output = [
      '',
      '{bold}{cyan-fg}[CONTACTS]{/}',
      ''
    ];

    for (const [id, contact] of allContacts) {
      const status = contact.online ? '{green-fg}●{/}' : '{red-fg}●{/}';
      const statusText = contact.online ? 'ONLINE' : 'OFFLINE';
      const current = this.currentChat === id ? '{bold}{yellow-fg}[ACTIVE]{/}' : '';
      
      output.push(`${status} {bold}${contact.name}{/} ${current}`);
      output.push(`  {dim}${contact.address || 'Auto-discovered'} - ${statusText}{/}`);
    }

    output.push('');
    this.addOutput(output);
  }

  addContactCommand(args) {
    if (args.length < 2) {
      this.addOutput([
        '',
        '{red-fg}Usage: {bold}add <name> <ip:port>{/}',
        '{yellow-fg}Example: {bold}add john 192.168.1.100:8080{/}',
        ''
      ]);
      return;
    }

    const name = args[0];
    let address = args[1];

    // Add default port if not specified
    if (!address.includes(':')) {
      address = `${address}:8080`;
    }

    this.emit('add_contact', { name, address });
    this.addOutput(`{green-fg}Contact {bold}${name}{/}{green-fg} added with address {bold}${address}{/}`);
  }

  connectCommand(args) {
    if (args.length < 1) {
      this.addOutput([
        '',
        '{red-fg}Usage: {bold}connect <name>{/}',
        '{yellow-fg}Use {bold}contacts{/}{yellow-fg} to see available contacts{/}',
        ''
      ]);
      return;
    }

    const name = args[0];
    const allContacts = new Map([...this.savedContacts, ...this.contacts]);
    
    // Find contact by name
    let targetContact = null;
    for (const [id, contact] of allContacts) {
      if (contact.name.toLowerCase() === name.toLowerCase()) {
        targetContact = { id, ...contact };
        break;
      }
    }

    if (!targetContact) {
      this.addOutput(`{red-fg}Contact {bold}${name}{/}{red-fg} not found. Use {bold}contacts{/}{red-fg} to see available contacts.{/}`);
      return;
    }

    if (!targetContact.online) {
      this.addOutput(`{red-fg}Contact {bold}${name}{/}{red-fg} is offline.{/}`);
      return;
    }

    this.currentChat = targetContact.id;
    this.updatePrompt();
    this.loadChatHistory(targetContact.id);
    
    this.addOutput([
      '',
      `{green-fg}Connected to {bold}${targetContact.name}{/}`,
      '{dim}Type messages to chat. Use {bold}/disconnect{/} to exit chat.{/}',
      ''
    ]);
  }

  showAddress() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIPs = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIPs.push(iface.address);
        }
      }
    }
    
    const port = this.config.network?.port || 8080;
    const addresses = localIPs.map(ip => `${ip}:${port}`);
    
    const output = [
      '',
      '{bold}{cyan-fg}[MY ADDRESS]{/}',
      '',
      '{yellow-fg}Share these addresses with contacts:{/}'
    ];

    addresses.forEach(addr => {
      output.push(`  {bold}{green-fg}${addr}{/}`);
    });

    if (addresses.length === 0) {
      output.push('  {red-fg}No network interfaces found{/}');
    }

    output.push('');
    this.addOutput(output);
  }

  sendMessage(text) {
    if (text.startsWith('/disconnect')) {
      this.currentChat = null;
      this.updatePrompt();
      this.addOutput(`{yellow-fg}Disconnected from chat.{/}`);
      return;
    }

    if (!this.currentChat) return;

    const contact = this.contacts.get(this.currentChat) || this.savedContacts.get(this.currentChat);
    if (!contact) return;

    // Display message locally
    this.addOutput(`{dim}[${new Date().toLocaleTimeString()}]{/} {bold}You:{/} ${text}`);

    // Emit to network layer
    this.emit('send_message', {
      peerId: this.currentChat,
      message: text
    });

    // Save to local history
    const message = {
      id: require('uuid').v4(),
      from: 'self',
      to: this.currentChat,
      text: text,
      timestamp: Date.now()
    };

    if (!this.messages.has(this.currentChat)) {
      this.messages.set(this.currentChat, []);
    }
    this.messages.get(this.currentChat).push(message);
  }

  addOutput(content) {
    if (Array.isArray(content)) {
      this.output.push(...content);
    } else {
      this.output.push(content);
    }

    // Limit output size
    if (this.output.length > this.maxOutput) {
      this.output = this.output.slice(-this.maxOutput);
    }

    this.updateDisplay();
  }

  updateDisplay() {
    this.mainBox.setContent(this.output.join('\n'));
    this.mainBox.scrollTo(this.mainBox.getScrollHeight());
    this.screen.render();
  }

  clearScreen() {
    this.output = [];
    this.updateDisplay();
  }

  getPrompt() {
    if (this.currentChat) {
      const contact = this.contacts.get(this.currentChat) || this.savedContacts.get(this.currentChat);
      return `[${contact?.name || 'Unknown'}]> `;
    }
    return 'darkline> ';
  }

  getPromptFormatted() {
    if (this.currentChat) {
      const contact = this.contacts.get(this.currentChat) || this.savedContacts.get(this.currentChat);
      return `{bold}{green-fg}[${contact?.name || 'Unknown'}]>{/} `;
    }
    return '{bold}{green-fg}darkline>{/} ';
  }

  updatePrompt() {
    this.inputBox.setLabel(` ${this.getPrompt()}`);
    this.screen.render();
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.inputBox.focus();
    this.screen.render();
  }

  // Network event handlers
  addPeer(peer) {
    this.contacts.set(peer.id, {
      id: peer.id,
      name: peer.name,
      online: true,
      lastSeen: Date.now()
    });
    
    this.addOutput(`{green-fg}● {bold}${peer.name}{/}{green-fg} connected{/}`);
  }

  removePeer(peerId) {
    const contact = this.contacts.get(peerId);
    if (contact) {
      contact.online = false;
      contact.lastSeen = Date.now();
      this.addOutput(`{red-fg}● {bold}${contact.name}{/}{red-fg} disconnected{/}`);
    }
  }

  addSavedContact(contact) {
    this.savedContacts.set(contact.id, {
      ...contact,
      online: false
    });
  }

  displayMessage(message) {
    const contact = this.contacts.get(message.from) || this.savedContacts.get(message.from);
    const senderName = contact?.name || 'Unknown';
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    this.addOutput(`{dim}[${time}]{/} {bold}{cyan-fg}${senderName}:{/} ${message.text}`);
    
    // Save to local history
    if (!this.messages.has(message.from)) {
      this.messages.set(message.from, []);
    }
    this.messages.get(message.from).push(message);
  }

  loadChatHistory(contactId) {
    const messages = this.messages.get(contactId) || [];
    
    if (messages.length === 0) {
      this.addOutput('{dim}No previous messages.{/}');
      return;
    }

    this.addOutput([
      '',
      '{dim}--- Chat History ---{/}'
    ]);

    messages.slice(-10).forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const sender = msg.from === 'self' ? 'You' : (this.contacts.get(msg.from)?.name || 'Unknown');
      this.addOutput(`{dim}[${time}]{/} {bold}${sender}:{/} ${msg.text}`);
    });

    this.addOutput('');
  }

  refreshContacts() {
    // This is called when contacts are updated
  }

  showError(message) {
    this.addOutput(`{red-fg}ERROR: ${message}{/}`);
  }

  stop() {
    if (this.screen) {
      this.screen.destroy();
    }
    this.isRunning = false;
  }
}

module.exports = UIManager;