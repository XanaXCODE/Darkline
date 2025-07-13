"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BluetoothMeshManager = void 0;
const events_1 = require("events");
const encryption_1 = require("../crypto/encryption");
const uuid_1 = require("uuid");
const termux_adapter_1 = require("./termux-adapter");
// Enhanced platform detection
const isAndroid = process.platform === 'android' || process.env.TERMUX_VERSION !== undefined;
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';
let bluetoothAdapter;
// Always use TermuxBluetoothAdapter (which includes simulation) for cross-platform compatibility
// This avoids the Windows HCI socket error and works everywhere
console.log(`🔧 Platform detected: ${process.platform}`);
if (isAndroid) {
    console.log('📱 Using Termux Bluetooth adapter for Android');
    bluetoothAdapter = new termux_adapter_1.TermuxBluetoothAdapter();
}
else if (isWindows) {
    console.log('🪟 Using fallback adapter for Windows (noble HCI not supported)');
    bluetoothAdapter = new termux_adapter_1.TermuxBluetoothAdapter();
}
else {
    // For Linux/macOS, try noble but fall back gracefully
    console.log('🐧 Attempting to use noble for Linux/macOS...');
    try {
        const noble = require('noble');
        // Test if noble can initialize without throwing
        bluetoothAdapter = noble;
        console.log('✅ Noble loaded successfully');
    }
    catch (error) {
        console.log('⚠️  Noble not available, using simulation adapter');
        bluetoothAdapter = new termux_adapter_1.TermuxBluetoothAdapter();
    }
}
class BluetoothMeshManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.devices = new Map();
        this.meshNodes = new Map();
        this.routingTable = new Map();
        this.isScanning = false;
        this.keyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.nodeId = (0, uuid_1.v4)();
        this.setupNoble();
    }
    setupNoble() {
        // Check if we're using TermuxBluetoothAdapter (for Android, Windows, or fallback)
        const isUsingTermuxAdapter = bluetoothAdapter instanceof termux_adapter_1.TermuxBluetoothAdapter;
        if (isUsingTermuxAdapter) {
            // Setup Termux/Simulation Bluetooth adapter
            console.log('🔧 Setting up TermuxBluetoothAdapter events');
            bluetoothAdapter.on('ready', () => {
                console.log('📡 Bluetooth adapter ready');
                this.emit('ready');
            });
            bluetoothAdapter.on('deviceDiscovered', (device) => {
                this.handleTermuxDeviceDiscovered(device);
            });
            bluetoothAdapter.on('deviceConnected', (device) => {
                this.handleTermuxDeviceConnected(device);
            });
        }
        else {
            // Setup Noble for Linux/macOS (if available)
            console.log('🔧 Setting up Noble events');
            bluetoothAdapter.on('stateChange', (state) => {
                console.log(`📡 Bluetooth state: ${state}`);
                if (state === 'poweredOn') {
                    this.emit('ready');
                }
                else {
                    this.stopDiscovery();
                }
            });
            bluetoothAdapter.on('discover', (peripheral) => {
                this.handleDeviceDiscovered(peripheral);
            });
        }
    }
    async startMesh() {
        return new Promise((resolve, reject) => {
            const isUsingTermuxAdapter = bluetoothAdapter instanceof termux_adapter_1.TermuxBluetoothAdapter;
            if (isUsingTermuxAdapter) {
                // TermuxBluetoothAdapter flow (Android, Windows, or fallback)
                console.log('🚀 Starting mesh with TermuxBluetoothAdapter');
                if (bluetoothAdapter.isBluetoothAvailable && bluetoothAdapter.isBluetoothAvailable()) {
                    this.startDiscovery();
                    this.startHeartbeat();
                    resolve();
                }
                else {
                    this.once('ready', () => {
                        this.startDiscovery();
                        this.startHeartbeat();
                        resolve();
                    });
                }
            }
            else {
                // Noble flow for Linux/macOS
                console.log('🚀 Starting mesh with Noble');
                if (bluetoothAdapter.state === 'poweredOn') {
                    this.startDiscovery();
                    this.startHeartbeat();
                    resolve();
                }
                else {
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
    startDiscovery() {
        if (this.isScanning)
            return;
        this.isScanning = true;
        const isUsingTermuxAdapter = bluetoothAdapter instanceof termux_adapter_1.TermuxBluetoothAdapter;
        console.log('🔍 Starting device discovery...');
        if (isUsingTermuxAdapter) {
            // Start Termux/Simulation Bluetooth scanning
            bluetoothAdapter.startScanning();
        }
        else {
            // Start Noble scanning for Linux/macOS
            bluetoothAdapter.startScanning([], true);
        }
        // Periodic discovery
        this.discoveryTimer = setInterval(() => {
            this.performDiscovery();
        }, this.config.discoveryInterval);
    }
    stopDiscovery() {
        if (!this.isScanning)
            return;
        this.isScanning = false;
        console.log('🛑 Stopping device discovery...');
        // Both adapters have the same stopScanning method
        bluetoothAdapter.stopScanning();
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = undefined;
        }
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
            this.cleanupStaleNodes();
        }, this.config.heartbeatInterval);
    }
    handleTermuxDeviceDiscovered(termuxDevice) {
        const device = {
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
    handleTermuxDeviceConnected(termuxDevice) {
        const device = this.devices.get(termuxDevice.id);
        if (device) {
            device.isConnected = true;
            // Create mesh node
            const meshNode = {
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
    async connectToTermuxDevice(termuxDevice) {
        try {
            await bluetoothAdapter.connectToDevice(termuxDevice.id);
        }
        catch (error) {
            console.log('Failed to connect to Termux device:', error);
        }
    }
    async handleDeviceDiscovered(peripheral) {
        const device = {
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
    isDarklineDevice(device) {
        // Check by name pattern for Darkline devices
        const name = device.name || device.advertisement?.localName || '';
        return name.toLowerCase().includes('darkline') ||
            name.toLowerCase().includes('termux') ||
            // Check service UUID for Noble devices
            (device.advertisement?.serviceUuids || []).includes('12345678123412341234123456789abc');
    }
    async connectToDevice(peripheral) {
        try {
            await new Promise((resolve, reject) => {
                peripheral.connect((error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
            const device = this.devices.get(peripheral.id);
            if (device) {
                device.isConnected = true;
                // Create mesh node
                const meshNode = {
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
        }
        catch (error) {
            // Connection failed silently
        }
    }
    async sendHandshake(deviceId) {
        const message = {
            id: (0, uuid_1.v4)(),
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
    async sendMessage(deviceId, message) {
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
        }
        catch (error) {
            // Send failed silently
        }
    }
    signMessage(message) {
        const messageString = JSON.stringify({
            id: message.id,
            type: message.type,
            payload: message.payload,
            from: message.from,
            timestamp: message.timestamp,
            hops: message.hops
        });
        const signature = encryption_1.CryptoEngine.sign(Buffer.from(messageString), this.keyPair.signingPrivateKey);
        return Buffer.from(signature).toString('hex');
    }
    verifyMessage(message, publicKey) {
        if (!message.signature)
            return false;
        const messageString = JSON.stringify({
            id: message.id,
            type: message.type,
            payload: message.payload,
            from: message.from,
            timestamp: message.timestamp,
            hops: message.hops
        });
        try {
            return encryption_1.CryptoEngine.verifySignature(Buffer.from(messageString), Buffer.from(message.signature, 'hex'), Buffer.from(publicKey, 'hex'));
        }
        catch {
            return false;
        }
    }
    async broadcastMessage(message) {
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
    performDiscovery() {
        // Send discovery message to announce our presence
        const discoveryMessage = {
            id: (0, uuid_1.v4)(),
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
    sendHeartbeat() {
        for (const [deviceId, meshNode] of this.meshNodes) {
            if (meshNode.device.isConnected) {
                meshNode.lastHeartbeat = new Date();
            }
        }
    }
    cleanupStaleNodes() {
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
    getConnectedDevices() {
        return Array.from(this.devices.values()).filter(device => device.isConnected);
    }
    getNodeId() {
        return this.nodeId;
    }
    async stop() {
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
exports.BluetoothMeshManager = BluetoothMeshManager;
//# sourceMappingURL=mesh-manager.js.map