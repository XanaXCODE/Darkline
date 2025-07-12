import { EventEmitter } from 'events';
import { BluetoothMeshManager } from './mesh-manager';
import { BluetoothServerConfig, BluetoothMessage, BluetoothDevice } from './types';
import { User, Message } from '../types';
import { CryptoEngine, KeyPair } from '../crypto/encryption';
import { v4 as uuidv4 } from 'uuid';

export class BluetoothP2PClient extends EventEmitter {
  private meshManager: BluetoothMeshManager;
  private keyPair: KeyPair;
  private nickname: string = '';
  private nodeId: string;
  private currentRoom: string = 'general';
  private connectedPeers: Map<string, User> = new Map();
  private messageHistory: Map<string, Message[]> = new Map();
  private isActive: boolean = false;

  constructor(private config: BluetoothServerConfig) {
    super();
    
    this.keyPair = CryptoEngine.generateKeyPair();
    this.nodeId = uuidv4();
    this.meshManager = new BluetoothMeshManager(config);
    
    this.setupMeshHandlers();
  }

  private setupMeshHandlers() {
    this.meshManager.on('deviceDiscovered', (device: BluetoothDevice) => {
      this.emit('peerDiscovered', device);
    });

    this.meshManager.on('nodeConnected', (meshNode) => {
      this.isActive = true;
      this.emit('peerConnected', meshNode.device);
      
      // Send our user info to the new peer
      this.announcePresence();
    });

    this.meshManager.on('messageReceived', (message: BluetoothMessage) => {
      this.handleIncomingMessage(message);
    });

    this.meshManager.on('nodeDisconnected', (meshNode) => {
      // Remove from peers list
      this.connectedPeers.delete(meshNode.device.id);
      
      // Check if we still have connections
      const connectedDevices = this.meshManager.getConnectedDevices();
      if (connectedDevices.length === 0) {
        this.isActive = false;
        this.emit('isolated'); // No more peers
      }
      
      this.emit('peerDisconnected', meshNode.device);
    });

    // Note: We'll need to implement message handling in the mesh manager
    // For now, messages will be handled through the broadcast mechanism
  }

  async join(nickname: string): Promise<void> {
    this.nickname = nickname;
    
    try {
      await this.meshManager.startMesh();
      
      // Announce our presence periodically
      this.startPresenceAnnouncement();
      
    } catch (error) {
      throw error;
    }
  }

  private startPresenceAnnouncement() {
    // Announce presence every 30 seconds
    setInterval(() => {
      if (this.isActive || this.meshManager.getConnectedDevices().length > 0) {
        this.announcePresence();
      }
    }, 30000);
  }

  private async announcePresence(): Promise<void> {
    const presenceMessage: BluetoothMessage = {
      id: uuidv4(),
      type: 'user_join',
      payload: {
        user: {
          id: this.nodeId,
          nickname: this.nickname,
          publicKey: Buffer.from(this.keyPair.publicKey).toString('hex'),
          lastSeen: new Date(),
          isOnline: true,
          hardId: this.nodeId,
          isAuthenticated: true,
          group: 'user',
          registrationDate: new Date()
        },
        roomId: this.currentRoom
      },
      from: this.nodeId,
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(presenceMessage);
  }

  private async handleIncomingMessage(message: BluetoothMessage): Promise<void> {
    // Ignore our own messages
    if (message.from === this.nodeId) return;

    switch (message.type) {
      case 'user_join':
        this.handlePeerJoin(message);
        break;
      case 'user_leave':
        this.handlePeerLeave(message);
        break;
      case 'message':
        this.handleChatMessage(message);
        break;
      case 'direct_message':
        this.handleDirectMessage(message);
        break;
      case 'discovery':
        this.handleDiscovery(message);
        break;
    }
  }

  private handlePeerJoin(message: BluetoothMessage): void {
    const { user } = message.payload;
    
    if (user && user.id !== this.nodeId) {
      this.connectedPeers.set(user.id, user);
      this.emit('userJoined', user);
    }
  }

  private handlePeerLeave(message: BluetoothMessage): void {
    const { userId } = message.payload;
    const user = this.connectedPeers.get(userId);
    
    if (user) {
      this.connectedPeers.delete(userId);
      this.emit('userLeft', user);
    }
  }

  private handleChatMessage(message: BluetoothMessage): void {
    const { content, fromNickname, mentions = [] } = message.payload;
    
    const chatMessage: Message = {
      id: message.id,
      from: message.from,
      fromNickname: fromNickname || 'Unknown',
      roomId: this.currentRoom,
      content,
      encrypted: false,
      timestamp: message.timestamp,
      mentions,
      isDelivered: true,
      isStored: false
    };

    // Add to local history
    this.addToHistory(this.currentRoom, chatMessage);
    
    // Show message if it's from someone else
    if (message.from !== this.nodeId) {
      this.emit('messageReceived', chatMessage);
    }
  }

  private handleDirectMessage(message: BluetoothMessage): void {
    const { content, fromNickname, to } = message.payload;
    
    // Check if this DM is for us
    if (to === this.nodeId) {
      this.emit('directMessageReceived', {
        from: fromNickname,
        content,
        timestamp: message.timestamp
      });
    }
  }

  private handleDiscovery(message: BluetoothMessage): void {
    // Discovery handled silently
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.isActiveInMesh()) {
      throw new Error('Not connected to any peers in mesh network');
    }

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'message',
      payload: {
        content,
        fromNickname: this.nickname,
        mentions: this.extractMentions(content)
      },
      from: this.nodeId,
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
    
    // Add to our own history
    const chatMessage: Message = {
      id: message.id,
      from: this.nodeId,
      fromNickname: this.nickname,
      roomId: this.currentRoom,
      content,
      encrypted: false,
      timestamp: message.timestamp,
      mentions: message.payload.mentions,
      isDelivered: true,
      isStored: false
    };

    this.addToHistory(this.currentRoom, chatMessage);
    this.emit('messageSent', chatMessage);
  }

  async sendDirectMessage(targetNickname: string, content: string): Promise<void> {
    const targetUser = Array.from(this.connectedPeers.values()).find(u => u.nickname === targetNickname);
    if (!targetUser) {
      throw new Error(`User ${targetNickname} not found in mesh network`);
    }

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'direct_message',
      payload: {
        to: targetUser.id,
        content,
        fromNickname: this.nickname
      },
      from: this.nodeId,
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
    
    this.emit('directMessageSent', {
      to: targetNickname,
      content,
      timestamp: message.timestamp
    });
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@(\w+)/g);
    return mentions ? mentions.map(m => m.slice(1)) : [];
  }

  private addToHistory(roomId: string, message: Message): void {
    if (!this.messageHistory.has(roomId)) {
      this.messageHistory.set(roomId, []);
    }
    
    const history = this.messageHistory.get(roomId)!;
    history.push(message);
    
    // Limit history size
    const maxMessages = 100;
    if (history.length > maxMessages) {
      history.shift();
    }
  }

  // Public getters
  getConnectedDevices(): BluetoothDevice[] {
    return this.meshManager.getConnectedDevices();
  }

  getConnectedPeers(): User[] {
    return Array.from(this.connectedPeers.values());
  }

  getMessageHistory(): Message[] {
    return this.messageHistory.get(this.currentRoom) || [];
  }

  getNickname(): string {
    return this.nickname;
  }

  getNodeId(): string {
    return this.nodeId;
  }

  isActiveInMesh(): boolean {
    return this.isActive || this.meshManager.getConnectedDevices().length > 0;
  }

  async leave(): Promise<void> {
    if (this.isActive) {
      // Announce leaving
      const leaveMessage: BluetoothMessage = {
        id: uuidv4(),
        type: 'user_leave',
        payload: {
          userId: this.nodeId,
          nickname: this.nickname
        },
        from: this.nodeId,
        timestamp: new Date(),
        hops: 0
      };

      await this.meshManager.broadcastMessage(leaveMessage);
    }

    await this.meshManager.stop();
    this.isActive = false;
    this.connectedPeers.clear();
    this.messageHistory.clear();
    
    this.emit('left');
  }
}