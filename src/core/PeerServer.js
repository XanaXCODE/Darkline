const { PeerServer } = require('peer');
const EventEmitter = require('events');

class PeerServerManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.server = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;

    try {
      this.server = PeerServer({
        port: this.config.peerServer.port,
        path: this.config.peerServer.path,
        key: this.config.peerServer.key,
        corsOptions: {
          origin: true,
          credentials: true
        }
      });

      this.server.on('connection', (client) => {
        console.log(`🔗 PeerJS client connected: ${client.getId()}`);
        this.emit('client_connected', client.getId());
      });

      this.server.on('disconnect', (client) => {
        console.log(`🔌 PeerJS client disconnected: ${client.getId()}`);
        this.emit('client_disconnected', client.getId());
      });

      this.server.on('error', (error) => {
        console.error('PeerJS server error:', error);
        this.emit('error', error);
      });

      this.isRunning = true;
      console.log(`🚀 PeerJS server started on port ${this.config.peerServer.port}`);
      console.log(`📡 Server path: ${this.config.peerServer.path}`);
      
    } catch (error) {
      throw new Error(`Failed to start PeerJS server: ${error.message}`);
    }
  }

  async stop() {
    if (!this.isRunning) return;

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.isRunning = false;
    console.log('🛑 PeerJS server stopped');
  }

  getServerInfo() {
    return {
      port: this.config.peerServer.port,
      path: this.config.peerServer.path,
      isRunning: this.isRunning
    };
  }
}

module.exports = PeerServerManager;