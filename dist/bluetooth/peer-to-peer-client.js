"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BluetoothP2PClient = void 0;
const events_1 = require("events");
const mesh_manager_1 = require("./mesh-manager");
const encryption_1 = require("../crypto/encryption");
const uuid_1 = require("uuid");
class BluetoothP2PClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.nickname = '';
        this.currentRoom = 'general';
        this.connectedPeers = new Map();
        this.messageHistory = new Map();
        this.isActive = false;
        this.keyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.nodeId = (0, uuid_1.v4)();
        this.meshManager = new mesh_manager_1.BluetoothMeshManager(config);
        this.setupMeshHandlers();
    }
    setupMeshHandlers() {
        this.meshManager.on('deviceDiscovered', (device) => {
            this.emit('peerDiscovered', device);
        });
        this.meshManager.on('nodeConnected', (meshNode) => {
            this.isActive = true;
            this.emit('peerConnected', meshNode.device);
            // Send our user info to the new peer
            this.announcePresence();
        });
        this.meshManager.on('messageReceived', (message) => {
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
    async join(nickname) {
        this.nickname = nickname;
        try {
            await this.meshManager.startMesh();
            // Announce our presence periodically
            this.startPresenceAnnouncement();
        }
        catch (error) {
            throw error;
        }
    }
    startPresenceAnnouncement() {
        // Announce presence every 30 seconds
        setInterval(() => {
            if (this.isActive || this.meshManager.getConnectedDevices().length > 0) {
                this.announcePresence();
            }
        }, 30000);
    }
    async announcePresence() {
        const presenceMessage = {
            id: (0, uuid_1.v4)(),
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
    async handleIncomingMessage(message) {
        // Ignore our own messages
        if (message.from === this.nodeId)
            return;
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
    handlePeerJoin(message) {
        const { user } = message.payload;
        if (user && user.id !== this.nodeId) {
            this.connectedPeers.set(user.id, user);
            this.emit('userJoined', user);
        }
    }
    handlePeerLeave(message) {
        const { userId } = message.payload;
        const user = this.connectedPeers.get(userId);
        if (user) {
            this.connectedPeers.delete(userId);
            this.emit('userLeft', user);
        }
    }
    handleChatMessage(message) {
        const { content, fromNickname, mentions = [] } = message.payload;
        const chatMessage = {
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
    handleDirectMessage(message) {
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
    handleDiscovery(message) {
        // Discovery handled silently
    }
    async sendMessage(content) {
        if (!this.isActiveInMesh()) {
            throw new Error('Not connected to any peers in mesh network');
        }
        const message = {
            id: (0, uuid_1.v4)(),
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
        const chatMessage = {
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
    async sendDirectMessage(targetNickname, content) {
        const targetUser = Array.from(this.connectedPeers.values()).find(u => u.nickname === targetNickname);
        if (!targetUser) {
            throw new Error(`User ${targetNickname} not found in mesh network`);
        }
        const message = {
            id: (0, uuid_1.v4)(),
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
        const maxMessages = 100;
        if (history.length > maxMessages) {
            history.shift();
        }
    }
    // Public getters
    getConnectedDevices() {
        return this.meshManager.getConnectedDevices();
    }
    getConnectedPeers() {
        return Array.from(this.connectedPeers.values());
    }
    getMessageHistory() {
        return this.messageHistory.get(this.currentRoom) || [];
    }
    getNickname() {
        return this.nickname;
    }
    getNodeId() {
        return this.nodeId;
    }
    isActiveInMesh() {
        return this.isActive || this.meshManager.getConnectedDevices().length > 0;
    }
    async leave() {
        if (this.isActive) {
            // Announce leaving
            const leaveMessage = {
                id: (0, uuid_1.v4)(),
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
exports.BluetoothP2PClient = BluetoothP2PClient;
//# sourceMappingURL=peer-to-peer-client.js.map