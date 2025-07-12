import * as blessed from 'blessed';
import { BluetoothP2PClient } from './peer-to-peer-client';
import { BluetoothDevice } from './types';
import { User, Message, UserGroup } from '../types';

export class BluetoothUI {
  private screen: blessed.Widgets.Screen;
  private client: BluetoothP2PClient;
  private nickname: string;
  
  // Layout components
  private headerBox!: blessed.Widgets.BoxElement;
  private chatBox!: blessed.Widgets.BoxElement;
  private inputBox!: blessed.Widgets.TextareaElement;
  private helpBox!: blessed.Widgets.BoxElement;
  
  // Data
  private messages: string[] = [];
  private peers: User[] = [];
  private devices: BluetoothDevice[] = [];
  private isConnected: boolean = false;
  private showingHelp: boolean = false;

  constructor(client: BluetoothP2PClient, nickname: string) {
    this.client = client;
    this.nickname = nickname;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Darkline Bluetooth Mesh',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'white'
      },
      keys: true,
      mouse: false, // Disable mouse capture to allow text selection
      dockBorders: true,
      sendFocus: false, // Don't steal focus from terminal
      warnings: false
    });

    this.setupUI();
    this.setupEventHandlers();
    this.setupClientEvents();
    this.render();
  }

  private setupUI() {
    // Header with room name and connected count
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: this.getHeaderContent(),
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        bold: true
      }
    });

    // Main chat area - full screen minus header and input
    this.chatBox = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-3', // Leave space for header and input
      content: this.getWelcomeMessage(),
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          bg: 'green'
        }
      },
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Input box with dark green border
    this.inputBox = blessed.textarea({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      label: ` <@${this.nickname}> `,
      style: {
        fg: 'green',
        bg: 'black',
        label: {
          fg: 'green',
          bg: 'black'
        }
      },
      border: {
        type: 'line',
        fg: '#001100' // Very dark green, almost black
      } as any,
      inputOnFocus: true,
      keys: true,
      mouse: false, // Allow native mouse behavior
      scrollable: false,
      wrap: true
    });

    // Help box (hidden by default)
    this.helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      label: ' 📋 Darkline Commands ',
      content: this.getHelpContent(),
      tags: true,
      hidden: true,
      style: {
        fg: 'white',
        bg: 'black'
      },
      border: {
        type: 'line',
        fg: 'green'
      } as any
    });

    // Add all components to screen
    this.screen.append(this.headerBox);
    this.screen.append(this.chatBox);
    this.screen.append(this.inputBox);
    this.screen.append(this.helpBox);
  }

  private setupEventHandlers() {
    // Input handling - usar key event em vez de submit
    this.inputBox.key('enter', () => {
      const input = this.inputBox.getValue().trim();
      if (input) {
        this.handleUserInput(input);
        this.inputBox.clearValue();
      }
      this.inputBox.focus();
    });

    // Keyboard shortcuts - melhorar captura
    this.screen.key(['escape'], () => {
      this.shutdown();
    });

    this.screen.key(['C-c'], () => {
      this.shutdown();
    });

    // Simple Ctrl+V detection without raw capture
    this.screen.key(['C-v'], () => {
      this.handleClipboardPaste();
    });

    // Global key handling
    this.screen.on('keypress', (ch, key) => {
      // Permitir que o input box capture normalmente
      if (key.name === 'tab') {
        this.inputBox.focus();
      }
    });

    // Focus on input by default
    this.inputBox.focus();
  }

  private setupClientEvents() {
    this.client.on('peerDiscovered', (device: BluetoothDevice) => {
      this.devices.push(device);
      // Silent discovery
    });

    this.client.on('peerConnected', (device: BluetoothDevice) => {
      this.isConnected = true;
      this.updateHeader();
    });

    this.client.on('userJoined', (user: User) => {
      this.peers.push(user);
      this.addChatMessage('system', `* ${user.nickname} connected *`);
      this.updateHeader();
    });

    this.client.on('userLeft', (user: User) => {
      this.peers = this.peers.filter(p => p.id !== user.id);
      this.addChatMessage('system', `* ${user.nickname} disconnected *`);
      this.updateHeader();
    });

    this.client.on('messageReceived', (message: Message) => {
      this.addChatMessage(message.fromNickname || 'Unknown', message.content);
    });

    this.client.on('messageSent', (message: Message) => {
      // Our messages are handled in sendMessage method
    });

    this.client.on('directMessageReceived', (dm: any) => {
      this.addChatMessage('dm', `📩 ${dm.from}: ${dm.content}`);
    });

    this.client.on('isolated', () => {
      this.isConnected = false;
      this.updateHeader();
    });
  }

  private getHeaderContent(): string {
    const peersCount = this.peers.length;
    const statusIcon = this.isConnected ? '🟢' : '🔴';
    return `{bold}#darkline-mesh{/bold} ${statusIcon} {gray-fg}${peersCount} connected{/gray-fg}`;
  }

  private getWelcomeMessage(): string {
    return `{center}{green-fg}{bold}🌐 Darkline Bluetooth Mesh{/bold}{/green-fg}

{gray-fg}* get people around you to download darkline..and chat with them here! *{/gray-fg}

{yellow-fg}📱 Looking for nearby users...{/yellow-fg}
{gray-fg}Type /help for commands{/gray-fg}
{gray-fg}Paste: right-click, /paste, or select text normally{/gray-fg}{/center}`;
  }

  private getHelpContent(): string {
    return `{center}{bold}{green-fg}🌐 DARKLINE COMMANDS{/green-fg}{/bold}{/center}

{green-fg}{bold}💬 Chat Commands:{/bold}{/green-fg}
• Just type and press Enter to broadcast to all peers
• /dm <nickname> <message> - Send direct message
• /peers - List connected users
• /devices - Show nearby Bluetooth devices
• /status - Show network status

{cyan-fg}{bold}📡 Network Commands:{/bold}{/cyan-fg}
• /connect - Force scan for new devices
• /disconnect - Leave mesh network
• /clear - Clear chat messages

{yellow-fg}{bold}⌨️  Shortcuts:{/bold}{/yellow-fg}
• / - Show this help
• Esc/Ctrl+C - Exit
• Enter - Send message

{magenta-fg}{bold}📶 About Mesh:{/bold}{/magenta-fg}
• Peer-to-peer communication (no server needed)
• Messages route through nearby devices
• Works completely offline via Bluetooth

{red-fg}Press Esc to close help{/red-fg}`;
  }

  private handleUserInput(input: string) {
    if (input.startsWith('/')) {
      this.handleCommand(input);
    } else {
      this.sendMessage(input);
    }
  }

  private async handleCommand(command: string) {
    const parts = command.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.showHelpInChat();
        break;
      case 'peers':
        this.showPeers();
        break;
      case 'devices':
        this.showDevices();
        break;
      case 'status':
        this.showStatus();
        break;
      case 'clear':
        this.clearMessages();
        break;
      case 'dm':
        if (args.length >= 2) {
          const targetNick = args[0];
          const message = args.slice(1).join(' ');
          await this.sendDirectMessage(targetNick, message);
        } else {
          this.addChatMessage('system', '* Usage: /dm <nickname> <message> *');
        }
        break;
      case 'paste':
        this.handleClipboardPaste();
        break;
      case 'connect':
        this.addChatMessage('system', '* Scanning for devices... *');
        break;
      case 'disconnect':
      case 'quit':
      case 'exit':
        this.shutdown();
        break;
      default:
        this.addChatMessage('system', `* Unknown command: ${cmd}. Type /help for available commands *`);
    }
  }

  private async sendMessage(content: string) {
    // Always show our own message first
    this.addChatMessage(this.nickname, content);
    
    if (!this.client.isActiveInMesh() && this.peers.length === 0) {
      this.addChatMessage('system', '* No peers connected - message stored for when peers join *');
      return;
    }

    try {
      await this.client.sendMessage(content);
      
      // Simulate receiving echo from test user after delay
      if (this.peers.length > 0) {
        setTimeout(() => {
          this.addChatMessage('TestUser', `Echo: ${content}`);
        }, 1000);
      }
    } catch (error: any) {
      this.addChatMessage('system', `* Failed to send message: ${error.message} *`);
    }
  }

  private async sendDirectMessage(targetNick: string, content: string) {
    try {
      await this.client.sendDirectMessage(targetNick, content);
      this.addChatMessage('dm', `📤 To ${targetNick}: ${content}`);
    } catch (error: any) {
      this.addChatMessage('system', `* Failed to send DM: ${error.message} *`);
    }
  }

  private addChatMessage(from: string, content: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    let message: string;
    
    if (from === 'system') {
      message = `{gray-fg}[${timestamp}] ${content}{/gray-fg}`;
    } else if (from === 'dm') {
      message = `{magenta-fg}[${timestamp}] ${content}{/magenta-fg}`;
    } else if (from === this.nickname) {
      message = `{gray-fg}[${timestamp}]{/gray-fg} {green-fg}<@${from}>{/green-fg} ${content}`;
    } else {
      message = `{gray-fg}[${timestamp}]{/gray-fg} {cyan-fg}<@${from}>{/cyan-fg} ${content}`;
    }
    
    this.messages.push(message);
    this.updateChatDisplay();
  }

  private updateChatDisplay() {
    const content = this.messages.length === 0 ? 
      this.getWelcomeMessage() : 
      this.messages.join('\n');
    
    this.chatBox.setContent(content);
    this.chatBox.scrollTo(this.messages.length);
    this.render();
  }

  private updateHeader() {
    this.headerBox.setContent(this.getHeaderContent());
    this.render();
  }

  private showPeers() {
    if (this.peers.length === 0) {
      this.addChatMessage('system', '* No peers connected *');
    } else {
      this.addChatMessage('system', `* Connected peers (${this.peers.length}): ${this.peers.map(p => p.nickname).join(', ')} *`);
    }
  }

  private showDevices() {
    if (this.devices.length === 0) {
      this.addChatMessage('system', '* No devices discovered *');
    } else {
      this.addChatMessage('system', `* Discovered devices (${this.devices.length}): ${this.devices.map(d => d.name).join(', ')} *`);
    }
  }

  private showStatus() {
    const activeStatus = this.client.isActiveInMesh() ? 'Active' : 'Idle';
    const deviceCount = this.devices.length;
    const peerCount = this.peers.length;
    const nodeId = this.client.getNodeId().slice(0, 8);

    this.addChatMessage('system', `* Status: ${activeStatus} | Devices: ${deviceCount} | Peers: ${peerCount} | Node: ${nodeId}... *`);
  }

  private clearMessages() {
    this.messages = [];
    this.updateChatDisplay();
    this.addChatMessage('system', '* Chat cleared *');
  }

  private showHelpInChat() {
    this.addChatMessage('system', '* 🌐 DARKLINE COMMANDS *');
    this.addChatMessage('system', '* *');
    this.addChatMessage('system', '* 💬 Chat Commands: *');
    this.addChatMessage('system', '* • Just type and press Enter to broadcast to all peers *');
    this.addChatMessage('system', '* • /dm <nickname> <message> - Send direct message *');
    this.addChatMessage('system', '* • /peers - List connected users *');
    this.addChatMessage('system', '* • /devices - Show nearby Bluetooth devices *');
    this.addChatMessage('system', '* • /status - Show network status *');
    this.addChatMessage('system', '* *');
    this.addChatMessage('system', '* 📡 Network Commands: *');
    this.addChatMessage('system', '* • /connect - Force scan for new devices *');
    this.addChatMessage('system', '* • /disconnect - Leave mesh network *');
    this.addChatMessage('system', '* • /clear - Clear chat messages *');
    this.addChatMessage('system', '* • /paste - Paste from clipboard *');
    this.addChatMessage('system', '* *');
    this.addChatMessage('system', '* ⌨️  Shortcuts: *');
    this.addChatMessage('system', '* • Esc/Ctrl+C - Exit *');
    this.addChatMessage('system', '* • Enter - Send message *');
    this.addChatMessage('system', '* • Ctrl+V - Paste from clipboard *');
    this.addChatMessage('system', '* • Right-click - Paste (alternative) *');
    this.addChatMessage('system', '* *');
    this.addChatMessage('system', '* 📶 About Mesh: *');
    this.addChatMessage('system', '* • Peer-to-peer communication (no server needed) *');
    this.addChatMessage('system', '* • Messages route through nearby devices *');
    this.addChatMessage('system', '* • Works completely offline via Bluetooth *');
  }

  private toggleHelp() {
    if (this.helpBox.hidden) {
      this.helpBox.show();
      this.helpBox.focus();
      this.showingHelp = true;
    } else {
      this.helpBox.hide();
      this.inputBox.focus();
      this.showingHelp = false;
    }
    this.render();
  }



  private handleClipboardPaste() {
    try {
      const { exec } = require('child_process');
      
      // Try different clipboard commands based on platform
      let command = '';
      if (process.platform === 'darwin') {
        command = 'pbpaste';
      } else if (process.platform === 'linux') {
        command = 'xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null';
      } else if (process.platform === 'win32') {
        command = 'powershell -command "Get-Clipboard"';
      }

      if (command) {
        exec(command, (error: any, stdout: string) => {
          if (!error && stdout && stdout.trim()) {
            const content = stdout.trim();
            const currentValue = this.inputBox.getValue();
            this.inputBox.setValue(currentValue + content);
            this.inputBox.focus();
            this.render();
            this.addChatMessage('system', `* Pasted ${content.length} characters *`);
          } else {
            this.addChatMessage('system', '* Clipboard empty or try right-click paste *');
          }
        });
      } else {
        this.addChatMessage('system', '* Use right-click or selection paste instead *');
      }
    } catch (error) {
      this.addChatMessage('system', '* Use terminal native paste (right-click) *');
    }
  }

  private render() {
    this.screen.render();
  }

  private async shutdown() {
    this.addChatMessage('system', '* Leaving mesh network... *');
    try {
      await this.client.leave();
    } catch (error) {
      // Ignore errors during shutdown
    }
    
    this.screen.destroy();
    process.exit(0);
  }

  public start() {
    this.render();
    this.addChatMessage('system', '* Bluetooth mesh started *');
    this.addChatMessage('system', '* get people around you to download darkline..and chat with them here! *');
    
    // Start simulator for testing
    this.startSimulator();
  }

  private startSimulator() {
    // Simulate some devices being discovered after 3 seconds
    setTimeout(() => {
      this.devices.push({
        id: 'sim001',
        name: 'Darkline_Mobile_001',
        address: 'aa:bb:cc:dd:ee:01',
        rssi: -45,
        lastSeen: new Date(),
        isConnected: false
      });
      
      // Simulate connection after 5 seconds
      setTimeout(() => {
        this.isConnected = true;
        this.updateHeader();
        
        // Simulate a user joining
        const simUser: User = {
          id: 'simuser001',
          nickname: 'TestUser',
          publicKey: 'sim_key',
          lastSeen: new Date(),
          isOnline: true,
          hardId: 'sim_hard_id',
          isAuthenticated: true,
          group: UserGroup.USER,
          registrationDate: new Date()
        };
        
        this.peers.push(simUser);
        this.addChatMessage('system', `* ${simUser.nickname} connected *`);
        this.updateHeader();
        
      }, 2000);
    }, 3000);
  }
}