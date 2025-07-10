const EventEmitter = require('events');
const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class NetworkManager extends EventEmitter {
  constructor(config, identity) {
    super();
    this.config = config;
    this.identity = identity;
    this.server = null;
    this.peers = new Map();
    this.discoverySocket = null;
    this.isRunning = false;
    this.availablePorts = [8080, 8081, 8082, 8083, 8084];
    this.currentPort = null;
    this.broadcastAddresses = [];
  }

  async start() {
    if (this.isRunning) return;

    try {
      await this.detectNetworkInterfaces();
      await this.startWebSocketServer();
      await this.startPeerDiscovery();
      this.isRunning = true;
      console.log(`🌐 Enhanced P2P Network started on port ${this.currentPort}`);
      console.log(`🔍 Broadcasting to: ${this.broadcastAddresses.join(', ')}`);
      console.log(`🆔 Your ID: ${this.identity.getId()}`);
    } catch (error) {
      throw new Error(`Failed to start network: ${error.message}`);
    }
  }

  async detectNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    this.broadcastAddresses = [];

    for (const [name, iface] of Object.entries(interfaces)) {
      for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal) {
          // Calculate broadcast address
          const ip = config.address.split('.').map(Number);
          const netmask = config.netmask.split('.').map(Number);
          const broadcast = ip.map((octet, i) => octet | (255 - netmask[i])).join('.');
          this.broadcastAddresses.push(broadcast);
        }
      }
    }

    // Add fallback broadcast
    if (!this.broadcastAddresses.includes('255.255.255.255')) {
      this.broadcastAddresses.push('255.255.255.255');
    }
  }

  async startWebSocketServer() {
    for (const port of this.availablePorts) {
      try {
        this.server = new WebSocket.Server({ 
          port: port,
          perMessageDeflate: false
        });

        this.currentPort = port;
        console.log(`✅ WebSocket server started on port ${port}`);
        break;
      } catch (error) {
        console.log(`❌ Port ${port} is busy, trying next...`);
        if (port === this.availablePorts[this.availablePorts.length - 1]) {
          throw new Error('All ports are busy');
        }
        continue;
      }
    }

    this.server.on('connection', (ws, req) => {
      const peerId = uuidv4();
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.log(`📡 New connection from ${clientIP}`);
      
      ws.peerId = peerId;
      ws.isAlive = true;
      
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.peers.delete(peerId);
        this.emit('peer_disconnected', peerId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for peer ${peerId}:`, error);
        this.peers.delete(peerId);
        this.emit('peer_disconnected', peerId);
      });
    });

    // Enhanced heartbeat system
    setInterval(() => {
      this.server.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  async startPeerDiscovery() {
    this.discoverySocket = dgram.createSocket('udp4');
    
    this.discoverySocket.on('message', (msg, rinfo) => {
      this.handleDiscoveryMessage(msg, rinfo);
    });

    this.discoverySocket.on('error', (err) => {
      console.error('Discovery socket error:', err);
    });

    // Try to bind to discovery port
    const discoveryPort = this.currentPort + 1000;
    try {
      this.discoverySocket.bind(discoveryPort);
      console.log(`📢 Discovery listening on port ${discoveryPort}`);
    } catch (error) {
      console.warn(`Could not bind discovery socket to port ${discoveryPort}`);
    }

    // Enhanced discovery broadcasts
    setInterval(() => {
      this.broadcastDiscovery();
    }, 5000); // More frequent broadcasts
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'handshake':
          this.handleHandshake(ws, message);
          break;
        case 'message':
          this.emit('message_received', message);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'peer_list_request':
          this.sendPeerList(ws);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  handleHandshake(ws, message) {
    const peer = {
      id: message.peerId,
      name: message.name,
      publicKey: message.publicKey,
      socket: ws,
      lastSeen: Date.now()
    };

    this.peers.set(message.peerId, peer);
    ws.peerId = message.peerId;
    
    // Send handshake response
    ws.send(JSON.stringify({
      type: 'handshake_response',
      peerId: this.identity.getId(),
      name: this.identity.getName(),
      publicKey: this.identity.getPublicKey()
    }));

    this.emit('peer_connected', peer);
    console.log(`🤝 Peer connected: ${peer.name} (${peer.id})`);
  }

  handleDiscoveryMessage(msg, rinfo) {
    try {
      const data = JSON.parse(msg.toString());
      
      if (data.type === 'discovery' && data.peerId !== this.identity.getId()) {
        //console.log(`🔍 Discovered peer: ${data.name} at ${rinfo.address}:${data.port}`);
        // Try to connect to discovered peer
        this.connectToPeer(rinfo.address, data.port);
      }
    } catch (error) {
      // Ignore invalid discovery messages
    }
  }

  broadcastDiscovery() {
    const message = JSON.stringify({
      type: 'discovery',
      peerId: this.identity.getId(),
      name: this.identity.getName(),
      port: this.currentPort,
      timestamp: Date.now()
    });

    // Broadcast to all detected network segments
    this.broadcastAddresses.forEach(address => {
      try {
        this.discoverySocket.send(message, this.currentPort + 1000, address);
      } catch (error) {
        // Ignore broadcast errors
      }
    });
  }

  async connectToPeer(address, port) {
    if (this.peers.size >= this.config.maxConnections) {
      console.log('⚠️  Maximum connections reached');
      return;
    }

    const connectionKey = `${address}:${port}`;
    
    // Avoid connecting to self
    if (port === this.currentPort) {
      return;
    }

    // Check if already connected
    const existingPeer = Array.from(this.peers.values()).find(p => 
      p.socket && p.socket.url === `ws://${address}:${port}`
    );
    if (existingPeer) {
      return;
    }

    try {
      console.log(`🔗 Attempting to connect to ${address}:${port}`);
      const ws = new WebSocket(`ws://${address}:${port}`);
      
      ws.on('open', () => {
        console.log(`✅ Connected to ${address}:${port}`);
        // Send handshake
        ws.send(JSON.stringify({
          type: 'handshake',
          peerId: this.identity.getId(),
          name: this.identity.getName(),
          publicKey: this.identity.getPublicKey()
        }));
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        if (ws.peerId) {
          this.peers.delete(ws.peerId);
          this.emit('peer_disconnected', ws.peerId);
        }
      });

      ws.on('error', (error) => {
        // Only log if not a connection refused error
        if (error.code !== 'ECONNREFUSED') {
          console.error(`Connection error to ${address}:${port}:`, error.message);
        }
      });

    } catch (error) {
      console.error(`Failed to connect to ${address}:${port}:`, error.message);
    }
  }

  sendPeerList(ws) {
    const peerList = Array.from(this.peers.values()).map(peer => ({
      id: peer.id,
      name: peer.name,
      publicKey: peer.publicKey,
      online: peer.socket && peer.socket.readyState === WebSocket.OPEN
    }));

    ws.send(JSON.stringify({
      type: 'peer_list',
      peers: peerList
    }));
  }

  async sendMessage(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.socket) {
      throw new Error('Peer not found or not connected');
    }

    try {
      peer.socket.send(JSON.stringify({
        type: 'message',
        ...message
      }));
    } catch (error) {
      throw new Error(`Failed to send message to peer: ${error.message}`);
    }
  }

  getPeers() {
    return Array.from(this.peers.values()).map(peer => ({
      id: peer.id,
      name: peer.name,
      online: peer.socket && peer.socket.readyState === WebSocket.OPEN,
      lastSeen: peer.lastSeen
    }));
  }

  // Get your own peer ID
  getPeerId() {
    return this.identity.getId();
  }

  // Get current port
  getCurrentPort() {
    return this.currentPort;
  }

  // Get network info
  getNetworkInfo() {
    return {
      peerId: this.identity.getId(),
      port: this.currentPort,
      broadcastAddresses: this.broadcastAddresses,
      peersCount: this.peers.size,
      isRunning: this.isRunning
    };
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.server) {
      this.server.close();
    }

    if (this.discoverySocket) {
      this.discoverySocket.close();
    }

    this.peers.clear();
    console.log('🛑 Enhanced P2P Network stopped');
  }
}

module.exports = NetworkManager;