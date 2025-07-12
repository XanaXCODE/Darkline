import { EventEmitter } from 'events';
import { BluetoothMeshManager } from './mesh-manager';
import { BluetoothServerConfig, BluetoothMessage, BluetoothDevice } from './types';
import { User, Message } from '../types';
import { CryptoEngine, KeyPair } from '../crypto/encryption';
import { v4 as uuidv4 } from 'uuid';

export class BluetoothClient extends EventEmitter {
  private meshManager: BluetoothMeshManager;
  private keyPair: KeyPair;
  private nickname: string = '';
  private currentRoom: string = 'general';
  private users: Map<string, User> = new Map();
  private isConnected: boolean = false;

  constructor(private config: BluetoothServerConfig) {
    super();
    
    this.keyPair = CryptoEngine.generateKeyPair();
    this.meshManager = new BluetoothMeshManager(config);
    
    this.setupMeshHandlers();
  }

  private setupMeshHandlers() {
    this.meshManager.on('deviceDiscovered', (device: BluetoothDevice) => {
      console.log(`Discovered device: ${device.name}`);
      this.emit('deviceDiscovered', device);
    });

    this.meshManager.on('nodeConnected', (meshNode) => {
      console.log(`Connected to node: ${meshNode.device.name}`);
      this.isConnected = true;
      this.emit('connected');
      
      // Send user join message
      this.announceJoin();
    });

    this.meshManager.on('nodeDisconnected', (meshNode) => {
      console.log(`Disconnected from node: ${meshNode.device.name}`);
      
      // Check if we have any connections left
      const connectedDevices = this.meshManager.getConnectedDevices();
      if (connectedDevices.length === 0) {
        this.isConnected = false;
        this.emit('disconnected');
      }
    });
  }

  async connect(nickname: string): Promise<void> {
    this.nickname = nickname;
    
    console.log(`Connecting Bluetooth client as: ${nickname}`);
    
    try {
      await this.meshManager.startMesh();
      console.log('Bluetooth mesh client started successfully');
      
      // Wait for at least one connection
      if (this.meshManager.getConnectedDevices().length === 0) {
        console.log('Waiting for Bluetooth connections...');
        await this.waitForConnection();
      }
      
    } catch (error) {
      console.error('Failed to start Bluetooth mesh client:', error);
      throw error;
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.isConnected) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  }

  private async announceJoin(): Promise<void> {
    const user: User = {
      id: this.meshManager.getNodeId(),
      nickname: this.nickname,
      publicKey: Buffer.from(this.keyPair.publicKey).toString('hex'),
      lastSeen: new Date(),
      isOnline: true,
      hardId: this.meshManager.getNodeId(),
      isAuthenticated: true,
      group: 'user' as any,
      registrationDate: new Date()
    };

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'user_join',
      payload: {
        user,
        roomId: this.currentRoom
      },
      from: this.meshManager.getNodeId(),
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
    this.emit('userJoined', { user, roomId: this.currentRoom });
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Bluetooth mesh network');
    }

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'message',
      payload: {
        roomId: this.currentRoom,
        content,
        mentions: this.extractMentions(content)
      },
      from: this.meshManager.getNodeId(),
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
    
    // Emit locally for immediate feedback
    const chatMessage: Message = {
      id: message.id,
      from: this.meshManager.getNodeId(),
      fromNickname: this.nickname,
      roomId: this.currentRoom,
      content,
      encrypted: false,
      timestamp: message.timestamp,
      mentions: message.payload.mentions,
      isDelivered: true,
      isStored: false
    };

    this.emit('messageSent', chatMessage);
  }

  async sendDirectMessage(targetNickname: string, content: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Bluetooth mesh network');
    }

    const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
    if (!targetUser) {
      throw new Error(`User ${targetNickname} not found`);
    }

    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'message',
      payload: {
        to: targetUser.id,
        content,
        isDM: true
      },
      from: this.meshManager.getNodeId(),
      timestamp: new Date(),
      hops: 0
    };

    await this.meshManager.broadcastMessage(message);
    
    this.emit('dmSent', {
      to: targetNickname,
      content,
      timestamp: message.timestamp
    });
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@(\w+)/g);
    return mentions ? mentions.map(m => m.slice(1)) : [];
  }

  joinRoom(roomName: string): void {
    const oldRoom = this.currentRoom;
    this.currentRoom = roomName;
    
    this.emit('roomChanged', {
      from: oldRoom,
      to: roomName
    });
    
    console.log(`Switched to room: ${roomName}`);
  }

  getConnectedDevices(): BluetoothDevice[] {
    return this.meshManager.getConnectedDevices();
  }

  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  getCurrentRoom(): string {
    return this.currentRoom;
  }

  getNickname(): string {
    return this.nickname;
  }

  isConnectedToMesh(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      // Announce leaving
      const message: BluetoothMessage = {
        id: uuidv4(),
        type: 'user_leave',
        payload: {
          userId: this.meshManager.getNodeId(),
          roomId: this.currentRoom
        },
        from: this.meshManager.getNodeId(),
        timestamp: new Date(),
        hops: 0
      };

      await this.meshManager.broadcastMessage(message);
    }

    await this.meshManager.stop();
    this.isConnected = false;
    this.users.clear();
    
    this.emit('disconnected');
    console.log('Bluetooth client disconnected');
  }
}