import { EventEmitter } from 'events';
import { BluetoothMeshManager } from './mesh-manager';
import { BluetoothServerConfig, BluetoothMessage, BluetoothDevice } from './types';
import { User, Message, Room, ServerMessage, UserGroup } from '../types';
import { AuthManager } from '../server/auth';
import { v4 as uuidv4 } from 'uuid';
import { CryptoEngine } from '../crypto/encryption';

export class BluetoothServer extends EventEmitter {
  private meshManager: BluetoothMeshManager;
  private authManager: AuthManager;
  private users: Map<string, User> = new Map();
  private rooms: Map<string, Room> = new Map();
  private messageHistory: Map<string, Message[]> = new Map();
  private serverKeyPair = CryptoEngine.generateKeyPair();

  constructor(private config: BluetoothServerConfig) {
    super();
    
    this.meshManager = new BluetoothMeshManager(config);
    this.authManager = new AuthManager(config.name + ' (Bluetooth)');
    
    this.setupMeshHandlers();
    this.setupDefaultRooms();
  }

  private setupMeshHandlers() {
    this.meshManager.on('deviceDiscovered', (device: BluetoothDevice) => {
      console.log(`Bluetooth device discovered: ${device.name}`);
      this.emit('deviceDiscovered', device);
    });

    this.meshManager.on('nodeConnected', (meshNode) => {
      console.log(`Bluetooth node connected: ${meshNode.device.name}`);
      this.handleNodeConnected(meshNode);
    });

    this.meshManager.on('nodeDisconnected', (meshNode) => {
      console.log(`Bluetooth node disconnected: ${meshNode.device.name}`);
      this.handleNodeDisconnected(meshNode);
    });
  }

  private setupDefaultRooms() {
    const generalRoom: Room = {
      id: 'general',
      name: '#general',
      type: 'public',
      members: [],
      createdAt: new Date(),
      createdBy: 'system',
      moderators: [],
      bannedUsers: []
    };
    this.rooms.set('general', generalRoom);
  }

  async start(): Promise<void> {
    console.log(`Starting Bluetooth Darkline server: ${this.config.name}`);
    console.log(`Auth database: ${this.authManager.getDbPath()}`);
    
    try {
      await this.meshManager.startMesh();
      console.log('Bluetooth mesh network started successfully');
    } catch (error) {
      console.error('Failed to start Bluetooth mesh:', error);
      throw error;
    }
  }

  private handleNodeConnected(meshNode: any) {
    // Create a temporary user for the connected device
    const user: User = {
      id: meshNode.device.id,
      nickname: meshNode.device.name || `BTDevice_${meshNode.device.id.slice(-4)}`,
      publicKey: '', // Will be updated during handshake
      lastSeen: new Date(),
      isOnline: true,
      hardId: meshNode.device.address,
      isAuthenticated: false,
      group: UserGroup.GUEST,
      registrationDate: new Date()
    };

    this.users.set(user.id, user);
    
    // Add to general room
    const generalRoom = this.rooms.get('general');
    if (generalRoom && !generalRoom.members.includes(user.id)) {
      generalRoom.members.push(user.id);
    }

    this.emit('userConnected', user);
  }

  private handleNodeDisconnected(meshNode: any) {
    const user = this.users.get(meshNode.device.id);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();

      // Remove from rooms
      this.rooms.forEach(room => {
        room.members = room.members.filter(id => id !== user.id);
      });

      this.emit('userDisconnected', user);
    }
  }

  async handleBluetoothMessage(message: BluetoothMessage): Promise<void> {
    console.log(`Received Bluetooth message: ${message.type} from ${message.from}`);

    switch (message.type) {
      case 'handshake':
        await this.handleHandshake(message);
        break;
      case 'message':
        await this.handleChatMessage(message);
        break;
      case 'user_join':
        await this.handleUserJoin(message);
        break;
      case 'user_leave':
        await this.handleUserLeave(message);
        break;
      case 'discovery':
        await this.handleDiscovery(message);
        break;
    }
  }

  private async handleHandshake(message: BluetoothMessage): Promise<void> {
    const { nodeId, publicKey, serverName } = message.payload;
    const user = this.users.get(message.from);
    
    if (user) {
      user.publicKey = publicKey;
      user.nickname = serverName || user.nickname;
      
      // Send handshake response
      const response: BluetoothMessage = {
        id: uuidv4(),
        type: 'handshake',
        payload: {
          nodeId: this.meshManager.getNodeId(),
          publicKey: Buffer.from(this.serverKeyPair.publicKey).toString('hex'),
          serverName: this.config.name
        },
        from: this.meshManager.getNodeId(),
        timestamp: new Date(),
        hops: 0
      };

      await this.meshManager.broadcastMessage(response);
    }
  }

  private async handleChatMessage(message: BluetoothMessage): Promise<void> {
    const { roomId, content, mentions = [] } = message.payload;
    const fromUser = this.users.get(message.from);
    
    if (!fromUser) return;

    const room = this.rooms.get(roomId || 'general');
    if (!room || !room.members.includes(fromUser.id)) {
      return;
    }

    const chatMessage: Message = {
      id: uuidv4(),
      from: fromUser.id,
      fromNickname: fromUser.nickname,
      roomId: room.id,
      content,
      encrypted: false,
      timestamp: message.timestamp,
      mentions,
      isDelivered: true,
      isStored: false
    };

    // Add to history
    this.addToHistory(room.id, chatMessage);

    // Broadcast to mesh network
    const broadcastMessage: BluetoothMessage = {
      id: uuidv4(),
      type: 'message',
      payload: {
        message: chatMessage
      },
      from: this.meshManager.getNodeId(),
      timestamp: new Date(),
      hops: message.hops
    };

    await this.meshManager.broadcastMessage(broadcastMessage);
    
    this.emit('messageReceived', chatMessage);
  }

  private async handleUserJoin(message: BluetoothMessage): Promise<void> {
    const { user, roomId } = message.payload;
    const room = this.rooms.get(roomId || 'general');
    
    if (room && !room.members.includes(user.id)) {
      room.members.push(user.id);
      this.users.set(user.id, user);
      
      this.emit('userJoined', { user, roomId: room.id });
    }
  }

  private async handleUserLeave(message: BluetoothMessage): Promise<void> {
    const { userId, roomId } = message.payload;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.members = room.members.filter(id => id !== userId);
      this.emit('userLeft', { userId, roomId });
    }
  }

  private async handleDiscovery(message: BluetoothMessage): Promise<void> {
    const { nodeId, name, timestamp } = message.payload;
    console.log(`Discovery from node: ${name} (${nodeId})`);
    
    // Update our knowledge of this node
    // This could be used for routing table updates
  }

  async sendMessage(roomId: string, content: string, fromUserId: string): Promise<void> {
    const fromUser = this.users.get(fromUserId);
    const room = this.rooms.get(roomId);
    
    if (!fromUser || !room || !room.members.includes(fromUserId)) {
      throw new Error('Invalid message parameters');
    }

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'message',
      payload: {
        roomId,
        content,
        mentions: this.extractMentions(content)
      },
      from: this.meshManager.getNodeId(),
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@(\w+)/g);
    return mentions ? mentions.map(m => m.slice(1)) : [];
  }

  private addToHistory(roomId: string, message: Message) {
    if (!this.messageHistory.has(roomId)) {
      this.messageHistory.set(roomId, []);
    }
    
    const history = this.messageHistory.get(roomId)!;
    history.push(message);
    
    // Limit history size
    const maxMessages = 1000;
    if (history.length > maxMessages) {
      history.splice(0, history.length - maxMessages);
    }
  }

  getConnectedDevices(): BluetoothDevice[] {
    return this.meshManager.getConnectedDevices();
  }

  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getMessageHistory(roomId: string): Message[] {
    return this.messageHistory.get(roomId) || [];
  }

  async stop(): Promise<void> {
    console.log('Stopping Bluetooth Darkline server...');
    await this.meshManager.stop();
    
    // Cleanup
    this.users.clear();
    this.rooms.clear();
    this.messageHistory.clear();
    
    this.emit('stopped');
  }
}