"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BluetoothClient = void 0;
const events_1 = require("events");
const mesh_manager_1 = require("./mesh-manager");
const encryption_1 = require("../crypto/encryption");
const uuid_1 = require("uuid");
class BluetoothClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.nickname = '';
        this.currentRoom = 'general';
        this.users = new Map();
        this.isConnected = false;
        this.keyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.meshManager = new mesh_manager_1.BluetoothMeshManager(config);
        this.setupMeshHandlers();
    }
    setupMeshHandlers() {
        this.meshManager.on('deviceDiscovered', (device) => {
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
    async connect(nickname) {
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
        }
        catch (error) {
            console.error('Failed to start Bluetooth mesh client:', error);
            throw error;
        }
    }
    waitForConnection() {
        return new Promise((resolve) => {
            const checkConnection = () => {
                if (this.isConnected) {
                    resolve();
                }
                else {
                    setTimeout(checkConnection, 1000);
                }
            };
            checkConnection();
        });
    }
    async announceJoin() {
        const user = {
            id: this.meshManager.getNodeId(),
            nickname: this.nickname,
            publicKey: Buffer.from(this.keyPair.publicKey).toString('hex'),
            lastSeen: new Date(),
            isOnline: true,
            hardId: this.meshManager.getNodeId(),
            isAuthenticated: true,
            group: 'user',
            registrationDate: new Date()
        };
        const message = {
            id: (0, uuid_1.v4)(),
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
    async sendMessage(content) {
        if (!this.isConnected) {
            throw new Error('Not connected to Bluetooth mesh network');
        }
        const message = {
            id: (0, uuid_1.v4)(),
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
        const chatMessage = {
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
    async sendDirectMessage(targetNickname, content) {
        if (!this.isConnected) {
            throw new Error('Not connected to Bluetooth mesh network');
        }
        const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
        if (!targetUser) {
            throw new Error(`User ${targetNickname} not found`);
        }
        const message = {
            id: (0, uuid_1.v4)(),
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
    extractMentions(content) {
        const mentions = content.match(/@(\w+)/g);
        return mentions ? mentions.map(m => m.slice(1)) : [];
    }
    joinRoom(roomName) {
        const oldRoom = this.currentRoom;
        this.currentRoom = roomName;
        this.emit('roomChanged', {
            from: oldRoom,
            to: roomName
        });
        console.log(`Switched to room: ${roomName}`);
    }
    getConnectedDevices() {
        return this.meshManager.getConnectedDevices();
    }
    getUsers() {
        return Array.from(this.users.values());
    }
    getCurrentRoom() {
        return this.currentRoom;
    }
    getNickname() {
        return this.nickname;
    }
    isConnectedToMesh() {
        return this.isConnected;
    }
    async disconnect() {
        if (this.isConnected) {
            // Announce leaving
            const message = {
                id: (0, uuid_1.v4)(),
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
exports.BluetoothClient = BluetoothClient;
//# sourceMappingURL=bluetooth-client.js.map