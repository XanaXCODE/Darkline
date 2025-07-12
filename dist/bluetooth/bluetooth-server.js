"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BluetoothServer = void 0;
const events_1 = require("events");
const mesh_manager_1 = require("./mesh-manager");
const types_1 = require("../types");
const auth_1 = require("../server/auth");
const uuid_1 = require("uuid");
const encryption_1 = require("../crypto/encryption");
class BluetoothServer extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.users = new Map();
        this.rooms = new Map();
        this.messageHistory = new Map();
        this.serverKeyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.meshManager = new mesh_manager_1.BluetoothMeshManager(config);
        this.authManager = new auth_1.AuthManager(config.name + ' (Bluetooth)');
        this.setupMeshHandlers();
        this.setupDefaultRooms();
    }
    setupMeshHandlers() {
        this.meshManager.on('deviceDiscovered', (device) => {
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
    setupDefaultRooms() {
        const generalRoom = {
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
    async start() {
        console.log(`Starting Bluetooth Darkline server: ${this.config.name}`);
        console.log(`Auth database: ${this.authManager.getDbPath()}`);
        try {
            await this.meshManager.startMesh();
            console.log('Bluetooth mesh network started successfully');
        }
        catch (error) {
            console.error('Failed to start Bluetooth mesh:', error);
            throw error;
        }
    }
    handleNodeConnected(meshNode) {
        // Create a temporary user for the connected device
        const user = {
            id: meshNode.device.id,
            nickname: meshNode.device.name || `BTDevice_${meshNode.device.id.slice(-4)}`,
            publicKey: '', // Will be updated during handshake
            lastSeen: new Date(),
            isOnline: true,
            hardId: meshNode.device.address,
            isAuthenticated: false,
            group: types_1.UserGroup.GUEST,
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
    handleNodeDisconnected(meshNode) {
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
    async handleBluetoothMessage(message) {
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
    async handleHandshake(message) {
        const { nodeId, publicKey, serverName } = message.payload;
        const user = this.users.get(message.from);
        if (user) {
            user.publicKey = publicKey;
            user.nickname = serverName || user.nickname;
            // Send handshake response
            const response = {
                id: (0, uuid_1.v4)(),
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
    async handleChatMessage(message) {
        const { roomId, content, mentions = [] } = message.payload;
        const fromUser = this.users.get(message.from);
        if (!fromUser)
            return;
        const room = this.rooms.get(roomId || 'general');
        if (!room || !room.members.includes(fromUser.id)) {
            return;
        }
        const chatMessage = {
            id: (0, uuid_1.v4)(),
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
        const broadcastMessage = {
            id: (0, uuid_1.v4)(),
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
    async handleUserJoin(message) {
        const { user, roomId } = message.payload;
        const room = this.rooms.get(roomId || 'general');
        if (room && !room.members.includes(user.id)) {
            room.members.push(user.id);
            this.users.set(user.id, user);
            this.emit('userJoined', { user, roomId: room.id });
        }
    }
    async handleUserLeave(message) {
        const { userId, roomId } = message.payload;
        const room = this.rooms.get(roomId);
        if (room) {
            room.members = room.members.filter(id => id !== userId);
            this.emit('userLeft', { userId, roomId });
        }
    }
    async handleDiscovery(message) {
        const { nodeId, name, timestamp } = message.payload;
        console.log(`Discovery from node: ${name} (${nodeId})`);
        // Update our knowledge of this node
        // This could be used for routing table updates
    }
    async sendMessage(roomId, content, fromUserId) {
        const fromUser = this.users.get(fromUserId);
        const room = this.rooms.get(roomId);
        if (!fromUser || !room || !room.members.includes(fromUserId)) {
            throw new Error('Invalid message parameters');
        }
        const message = {
            id: (0, uuid_1.v4)(),
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
    extractMentions(content) {
        const mentions = content.match(/@(\w+)/g);
        return mentions ? mentions.map(m => m.slice(1)) : [];
    }
    addToHistory(roomId, message) {
        if (!this.messageHistory.has(roomId)) {
            this.messageHistory.set(roomId, []);
        }
        const history = this.messageHistory.get(roomId);
        history.push(message);
        // Limit history size
        const maxMessages = 1000;
        if (history.length > maxMessages) {
            history.splice(0, history.length - maxMessages);
        }
    }
    getConnectedDevices() {
        return this.meshManager.getConnectedDevices();
    }
    getUsers() {
        return Array.from(this.users.values());
    }
    getRooms() {
        return Array.from(this.rooms.values());
    }
    getMessageHistory(roomId) {
        return this.messageHistory.get(roomId) || [];
    }
    async stop() {
        console.log('Stopping Bluetooth Darkline server...');
        await this.meshManager.stop();
        // Cleanup
        this.users.clear();
        this.rooms.clear();
        this.messageHistory.clear();
        this.emit('stopped');
    }
}
exports.BluetoothServer = BluetoothServer;
//# sourceMappingURL=bluetooth-server.js.map