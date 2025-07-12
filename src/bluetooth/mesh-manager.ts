import { EventEmitter } from 'events';
import { BluetoothDevice, BluetoothMessage, MeshNode, BluetoothServerConfig, BluetoothRoute } from './types';
import { CryptoEngine } from '../crypto/encryption';
import { v4 as uuidv4 } from 'uuid';
import { TermuxBluetoothAdapter } from './termux-adapter';

// Check if running on Android/Termux
const isAndroid = process.platform === 'android' || process.env.TERMUX_VERSION !== undefined;

let bluetoothAdapter: any;
if (isAndroid) {
  // Use Termux Bluetooth adapter for Android
  bluetoothAdapter = new TermuxBluetoothAdapter();
} else {
  // Try to use noble for other platforms
  try {
    bluetoothAdapter = require('noble');
  } catch (error) {
    console.log('Noble not available, using Termux adapter as fallback');
    bluetoothAdapter = new TermuxBluetoothAdapter();
  }
}

export class BluetoothMeshManager extends EventEmitter {
  private devices: Map<string, BluetoothDevice> = new Map();
  private meshNodes: Map<string, MeshNode> = new Map();
  private routingTable: Map<string, BluetoothRoute> = new Map();
  private isScanning: boolean = false;
  private discoveryTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private keyPair = CryptoEngine.generateKeyPair();
  private nodeId: string;

  constructor(private config: BluetoothServerConfig) {
    super();
    this.nodeId = uuidv4();
    this.setupNoble();
  }

  private setupNoble() {
    if (isAndroid) {
      // Setup Termux Bluetooth adapter
      bluetoothAdapter.on('ready', () => {
        this.emit('ready');
      });

      bluetoothAdapter.on('deviceDiscovered', (device: any) => {
        this.handleTermuxDeviceDiscovered(device);
      });

      bluetoothAdapter.on('deviceConnected', (device: any) => {
        this.handleTermuxDeviceConnected(device);
      });
    } else {
      // Setup Noble for other platforms
      bluetoothAdapter.on('stateChange', (state: string) => {
        if (state === 'poweredOn') {
          this.emit('ready');
        } else {
          this.stopDiscovery();
        }
      });

      bluetoothAdapter.on('discover', (peripheral: any) => {
        this.handleDeviceDiscovered(peripheral);
      });
    }
  }

  async startMesh(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isAndroid) {
        // Android/Termux flow
        if (bluetoothAdapter.isBluetoothAvailable && bluetoothAdapter.isBluetoothAvailable()) {
          this.startDiscovery();
          this.startHeartbeat();
          resolve();
        } else {
          this.once('ready', () => {
            this.startDiscovery();
            this.startHeartbeat();
            resolve();
          });
        }
      } else {
        // Noble flow for other platforms
        if (bluetoothAdapter.state === 'poweredOn') {
          this.startDiscovery();
          this.startHeartbeat();
          resolve();
        } else {
          this.once('ready', () => {
            this.startDiscovery();
            this.startHeartbeat();
            resolve();
          });
        }
      }

      setTimeout(() => {
        reject(new Error('Bluetooth initialization timeout'));
      }, 10000);
    });
  }

  private startDiscovery() {
    if (this.isScanning) return;

    this.isScanning = true;

    if (isAndroid) {
      // Start Termux Bluetooth scanning
      bluetoothAdapter.startScanning();
    } else {
      // Start Noble scanning for other platforms
      bluetoothAdapter.startScanning([], true);
    }

    // Periodic discovery
    this.discoveryTimer = setInterval(() => {
      this.performDiscovery();
    }, this.config.discoveryInterval);
  }

  private stopDiscovery() {
    if (!this.isScanning) return;

    this.isScanning = false;
    
    if (isAndroid) {
      bluetoothAdapter.stopScanning();
    } else {
      bluetoothAdapter.stopScanning();
    }

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.cleanupStaleNodes();
    }, this.config.heartbeatInterval);
  }

  private handleTermuxDeviceDiscovered(termuxDevice: any) {
    const device: BluetoothDevice = {
      id: termuxDevice.id,
      name: termuxDevice.name || 'Unknown Termux Device',
      address: termuxDevice.address,
      rssi: termuxDevice.rssi,
      lastSeen: new Date(),
      isConnected: false
    };

    // Check if this is a Darkline device by name pattern
    if (this.isDarklineDevice(device)) {
      this.devices.set(device.id, device);
      this.emit('deviceDiscovered', device);

      // Try to connect if we have room
      if (this.meshNodes.size < this.config.maxConnections) {
        this.connectToTermuxDevice(termuxDevice);
      }
    }
  }

  private handleTermuxDeviceConnected(termuxDevice: any) {
    const device = this.devices.get(termuxDevice.id);
    if (device) {
      device.isConnected = true;
      
      // Create mesh node
      const meshNode: MeshNode = {
        device,
        connections: new Set(),
        lastHeartbeat: new Date(),
        routingTable: new Map()
      };

      this.meshNodes.set(device.id, meshNode);
      this.emit('nodeConnected', meshNode);

      // Send handshake
      this.sendHandshake(device.id);
    }
  }

  private async connectToTermuxDevice(termuxDevice: any): Promise<void> {
    try {
      await bluetoothAdapter.connectToDevice(termuxDevice.id);
    } catch (error) {
      console.log('Failed to connect to Termux device:', error);
    }
  }

  private async handleDeviceDiscovered(peripheral: any) {
    const device: BluetoothDevice = {
      id: peripheral.id,
      name: peripheral.advertisement?.localName || 'Unknown',
      address: peripheral.address,
      rssi: peripheral.rssi,
      lastSeen: new Date(),
      isConnected: false
    };

    // Check if this is a Darkline device
    if (!this.isDarklineDevice(peripheral)) {
      return;
    }

    this.devices.set(device.id, device);
    this.emit('deviceDiscovered', device);

    // Try to connect if we have room
    if (this.meshNodes.size < this.config.maxConnections) {
      await this.connectToDevice(peripheral);
    }
  }

  private isDarklineDevice(device: any): boolean {
    // Check by name pattern for Darkline devices
    const name = device.name || device.advertisement?.localName || '';
    return name.toLowerCase().includes('darkline') || 
           name.toLowerCase().includes('termux') ||
           // Check service UUID for Noble devices
           (device.advertisement?.serviceUuids || []).includes('12345678123412341234123456789abc');
  }

  private async connectToDevice(peripheral: any): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        peripheral.connect((error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      const device = this.devices.get(peripheral.id);
      if (device) {
        device.isConnected = true;
        
        // Create mesh node
        const meshNode: MeshNode = {
          device,
          connections: new Set(),
          lastHeartbeat: new Date(),
          routingTable: new Map()
        };

        this.meshNodes.set(device.id, meshNode);
        this.emit('nodeConnected', meshNode);

        // Send handshake
        await this.sendHandshake(device.id);
      }

    } catch (error) {
      // Connection failed silently
    }
  }

  private async sendHandshake(deviceId: string): Promise<void> {
    const message: BluetoothMessage = {
      id: uuidv4(),
      type: 'handshake',
      payload: {
        nodeId: this.nodeId,
        publicKey: Buffer.from(this.keyPair.publicKey).toString('hex'),
        serverName: this.config.name
      },
      from: this.nodeId,
      timestamp: new Date(),
      hops: 0
    };

    await this.sendMessage(deviceId, message);
  }

  private async sendMessage(deviceId: string, message: BluetoothMessage): Promise<void> {
    const meshNode = this.meshNodes.get(deviceId);
    if (!meshNode || !meshNode.device.isConnected) {
      return;
    }

    try {
      // Encrypt message if enabled
      let payload = JSON.stringify(message);
      if (this.config.enableEncryption) {
        // Implement encryption here
        message.signature = this.signMessage(message);
      }

      // Send via Bluetooth characteristic
      // This is a simplified implementation - actual implementation would
      // require proper BLE characteristic writing
      
    } catch (error) {
      // Send failed silently
    }
  }

  private signMessage(message: BluetoothMessage): string {
    const messageString = JSON.stringify({
      id: message.id,
      type: message.type,
      payload: message.payload,
      from: message.from,
      timestamp: message.timestamp,
      hops: message.hops
    });
    
    const signature = CryptoEngine.sign(
      Buffer.from(messageString),
      this.keyPair.signingPrivateKey
    );
    
    return Buffer.from(signature).toString('hex');
  }

  private verifyMessage(message: BluetoothMessage, publicKey: string): boolean {
    if (!message.signature) return false;

    const messageString = JSON.stringify({
      id: message.id,
      type: message.type,
      payload: message.payload,
      from: message.from,
      timestamp: message.timestamp,
      hops: message.hops
    });

    try {
      return CryptoEngine.verifySignature(
        Buffer.from(messageString),
        Buffer.from(message.signature, 'hex'),
        Buffer.from(publicKey, 'hex')
      );
    } catch {
      return false;
    }
  }

  async broadcastMessage(message: BluetoothMessage): Promise<void> {
    // Increment hops and check limit
    message.hops++;
    if (message.hops > this.config.maxHops) {
      return;
    }

    // Send to all connected nodes
    for (const [deviceId, meshNode] of this.meshNodes) {
      if (meshNode.device.isConnected && deviceId !== message.from) {
        await this.sendMessage(deviceId, message);
      }
    }
  }

  private performDiscovery(): void {
    // Send discovery message to announce our presence
    const discoveryMessage: BluetoothMessage = {
      id: uuidv4(),
      type: 'discovery',
      payload: {
        nodeId: this.nodeId,
        name: this.config.name,
        timestamp: new Date()
      },
      from: this.nodeId,
      timestamp: new Date(),
      hops: 0
    };

    this.broadcastMessage(discoveryMessage);
  }

  private sendHeartbeat(): void {
    for (const [deviceId, meshNode] of this.meshNodes) {
      if (meshNode.device.isConnected) {
        meshNode.lastHeartbeat = new Date();
      }
    }
  }

  private cleanupStaleNodes(): void {
    const now = new Date();
    const timeout = this.config.heartbeatInterval * 3; // 3x heartbeat interval

    for (const [deviceId, meshNode] of this.meshNodes) {
      if (now.getTime() - meshNode.lastHeartbeat.getTime() > timeout) {
        this.meshNodes.delete(deviceId);
        this.devices.delete(deviceId);
        this.emit('nodeDisconnected', meshNode);
      }
    }
  }

  getConnectedDevices(): BluetoothDevice[] {
    return Array.from(this.devices.values()).filter(device => device.isConnected);
  }

  getNodeId(): string {
    return this.nodeId;
  }

  async stop(): Promise<void> {
    this.stopDiscovery();
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Disconnect all devices
    for (const meshNode of this.meshNodes.values()) {
      // Implement disconnect logic here
    }

    this.meshNodes.clear();
    this.devices.clear();
    this.routingTable.clear();
  }
}