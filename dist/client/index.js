"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DarklineClient = void 0;
const ws_1 = __importDefault(require("ws"));
const readline = __importStar(require("readline"));
const encryption_1 = require("../crypto/encryption");
const readline_1 = require("readline");
const database_1 = require("./database");
class DarklineClient {
    constructor() {
        this.ws = null;
        this.nickname = '';
        this.providedPassword = undefined;
        this.currentRoom = 'general';
        this.userGroup = 'guest';
        this.users = new Map();
        this.rooms = new Map();
        this.favorites = new Set();
        this.serverPublicKey = '';
        this.footerHeight = 1;
        this.terminalHeight = 0;
        this.lastPromptLine = 0;
        this.hardId = '';
        this.inputBuffer = '';
        this.cursorPosition = 0;
        this.messageHistory = [];
        this.maxHistoryMessages = 20;
        this.notifications = [];
        this.maxNotifications = 5;
        this.notificationHeight = 2;
        this.systemLog = [];
        this.maxSystemLog = 20;
        this.systemLogWidth = 0;
        this.chatWidth = 0;
        this.useSplitView = true;
        this.db = null;
        this.keyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.terminalHeight = process.stdout.rows || 24;
        this.hardId = this.generateHardId();
        this.footerHeight = 3; // Initialize footer height for box
        this.notificationHeight = 2; // Height for notification area
        // Ensure terminal dimensions are available before calculating layout
        if (!process.stdout.columns) {
            process.stdout.columns = 80; // fallback
        }
        this.calculateLayout();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.setupReadlineHandlers();
        this.setupTerminalResize();
        this.setupRawMode();
        // Add welcome message to system log
        this.addSystemLog('\x1b[96m🚀 Darkline Client Started\x1b[0m');
    }
    async connect(serverUrl, nickname, password) {
        return new Promise((resolve, reject) => {
            this.nickname = nickname;
            this.providedPassword = password;
            this.ws = new ws_1.default(serverUrl);
            this.ws.on('open', () => {
                console.log(`\x1b[92m✓\x1b[0m Connected to \x1b[96m${serverUrl}\x1b[0m`);
                this.sendHandshake();
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleServerMessage(message);
                }
                catch (error) {
                    console.error('Error parsing server message:', error);
                }
            });
            this.ws.on('close', () => {
                console.log('\x1b[91m✗\x1b[0m Disconnected from server');
                process.exit(0);
            });
            this.ws.on('error', (error) => {
                console.error('\x1b[91m✗ Connection error:\x1b[0m', error);
                reject(error);
            });
        });
    }
    sendHandshake() {
        const message = {
            type: 'handshake',
            payload: {},
            timestamp: new Date()
        };
        this.send(message);
    }
    handleServerMessage(message) {
        console.log(`DEBUG CLIENT: Received server message type '${message.type}'`);
        switch (message.type) {
            case 'handshake_response':
                this.handleHandshakeResponse(message.payload);
                break;
            case 'user_joined':
                this.handleUserJoined(message.payload);
                break;
            case 'user_left':
                this.handleUserLeft(message.payload);
                break;
            case 'message':
                this.handleMessage(message.payload);
                break;
            case 'dm':
                this.handleDirectMessage(message.payload);
                break;
            case 'room_created':
                this.handleRoomCreated(message.payload);
                break;
            case 'users_list':
                this.handleUsersList(message.payload);
                break;
            case 'rooms_list':
                this.handleRoomsList(message.payload);
                break;
            case 'message_history':
                this.handleMessageHistory(message.payload);
                break;
            case 'auth_challenge':
                this.handleAuthChallenge(message.payload);
                break;
            case 'auth_success':
                this.handleAuthSuccess(message.payload);
                break;
            case 'auth_failed':
                this.handleAuthFailed(message.payload);
                break;
            case 'registration_success':
                this.handleRegistrationSuccess(message.payload);
                break;
            case 'registration_failed':
                this.handleRegistrationFailed(message.payload);
                break;
            case 'login_success':
                this.handleLoginSuccess(message.payload);
                break;
            case 'login_failed':
                this.handleLoginFailed(message.payload);
                break;
            case 'permission_denied':
                this.handlePermissionDenied(message.payload);
                break;
            case 'user_kicked':
                this.handleUserKicked(message.payload);
                break;
            case 'user_banned':
                this.handleUserBanned(message.payload);
                break;
            case 'user_promoted':
                this.handleUserPromoted(message.payload);
                break;
            case 'user_demoted':
                this.handleUserDemoted(message.payload);
                break;
            case 'password_required':
                this.handlePasswordRequired(message.payload);
                break;
            case 'create_account':
                this.handleCreateAccount(message.payload);
                break;
            case 'error':
                this.handleError(message.payload);
                break;
        }
    }
    handleHandshakeResponse(payload) {
        this.serverPublicKey = payload.serverPublicKey;
        this.addSystemLog(`\x1b[92m✓\x1b[0m Connected to server \x1b[96m${payload.serverName}\x1b[0m`);
        // Initialize database
        this.initializeDatabase();
        // Join the server
        const joinMessage = {
            type: 'join',
            payload: {
                nickname: this.nickname,
                publicKey: Buffer.from(this.keyPair.signingPublicKey).toString('hex'),
                hardId: this.hardId
            },
            timestamp: new Date()
        };
        this.send(joinMessage);
    }
    initializeDatabase() {
        this.db = new database_1.DatabaseManager(this.nickname);
        // Load favorites from database
        const savedFavorites = this.db.getFavorites();
        savedFavorites.forEach(nickname => {
            this.favorites.add(nickname);
        });
        // Load rooms from database  
        const savedRooms = this.db.getRooms();
        savedRooms.forEach(room => {
            this.rooms.set(room.id, room);
        });
    }
    handleUserJoined(payload) {
        const { user, roomId } = payload;
        this.users.set(user.id, user);
        if (!roomId || roomId === this.currentRoom) {
            const formattedMessage = `\x1b[32m▶\x1b[0m \x1b[33m${user.nickname}\x1b[0m joined the chat`;
            this.addToMessageHistory(formattedMessage);
            this.addSystemLog(`\x1b[32m▶\x1b[0m User \x1b[33m${user.nickname}\x1b[0m joined room`);
            this.redrawScreen();
        }
    }
    handleUserLeft(payload) {
        const { userId, roomId } = payload;
        const user = this.users.get(userId);
        if (user && (!roomId || roomId === this.currentRoom)) {
            const formattedMessage = `\x1b[31m◀\x1b[0m \x1b[33m${user.nickname}\x1b[0m left the chat`;
            this.addToMessageHistory(formattedMessage);
            this.addSystemLog(`\x1b[31m◀\x1b[0m User \x1b[33m${user.nickname}\x1b[0m left room`);
            this.redrawScreen();
        }
    }
    handleMessage(payload) {
        const { message } = payload;
        if (message.roomId === this.currentRoom) {
            const prefix = message.isMention ? '\x1b[93m🔔\x1b[0m ' : '';
            const timestamp = this.formatTimestamp(new Date(message.timestamp));
            const nameColor = message.fromNickname === this.nickname ? '\x1b[92m' : '\x1b[33m';
            const formattedMessage = `${prefix}\x1b[90m[${timestamp}]\x1b[0m ${nameColor}${message.fromNickname}\x1b[0m: ${message.content}`;
            this.addToMessageHistory(formattedMessage);
            // Save to database
            this.db?.addMessage(message.roomId, message.content, message.fromNickname, new Date(message.timestamp));
            this.redrawScreen();
            if (message.mentions?.includes(this.nickname)) {
                const mentionMessage = '\x1b[93m🔔 You were mentioned!\x1b[0m';
                this.addToMessageHistory(mentionMessage);
                this.redrawScreen();
            }
        }
    }
    handleDirectMessage(payload) {
        const { message } = payload;
        const timestamp = this.formatTimestamp(new Date(message.timestamp));
        const formattedMessage = `\x1b[95m💬 DM\x1b[0m from \x1b[33m${message.fromNickname}\x1b[0m \x1b[90m[${timestamp}]\x1b[0m: ${message.content}`;
        this.addToMessageHistory(formattedMessage);
        // Save DM to database with special room ID
        this.db?.addMessage(`dm_${message.fromNickname}`, message.content, message.fromNickname, new Date(message.timestamp));
        this.redrawScreen();
    }
    handleRoomCreated(payload) {
        const { room } = payload;
        this.rooms.set(room.id, room);
        this.db?.saveRoom(room);
        this.addSystemLog(`\x1b[94m🏠\x1b[0m New room created: \x1b[36m${room.name}\x1b[0m`);
    }
    handleUsersList(payload) {
        const { users } = payload;
        users.forEach((user) => {
            this.users.set(user.id, user);
        });
    }
    handleRoomsList(payload) {
        const { rooms } = payload;
        rooms.forEach((room) => {
            this.rooms.set(room.id, room);
            this.db?.saveRoom(room);
        });
    }
    handleError(payload) {
        this.addSystemLog(`\x1b[91m❌ ERROR:\x1b[0m ${payload.message}`);
    }
    handleMessageHistory(payload) {
        const { roomId, messages } = payload;
        if (roomId === this.currentRoom && messages.length > 0) {
            // Sort messages by timestamp (oldest first, newest last)
            const sortedMessages = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // Clear message history for new room
            this.messageHistory = [];
            // Add messages to history
            sortedMessages.forEach((message) => {
                const timestamp = this.formatTimestamp(new Date(message.timestamp));
                const formattedMessage = `\x1b[90m[${timestamp}]\x1b[0m \x1b[33m${message.fromNickname}\x1b[0m: ${message.content}`;
                this.addToMessageHistory(formattedMessage);
            });
            // Redraw the screen with history
            this.redrawScreen();
        }
    }
    setupReadlineHandlers() {
        // Keep readline for compatibility but disable line input since we use raw mode
        this.rl.on('SIGINT', () => {
            console.log('\nGoodbye!');
            this.disconnect();
            process.exit(0);
        });
    }
    handleUserInput(input) {
        if (!input) {
            this.showPrompt();
            return;
        }
        // Commands
        if (input.startsWith('/')) {
            this.handleCommand(input);
            return;
        }
        // Direct message
        if (input.startsWith('@')) {
            this.handleDirectMessageInput(input);
            return;
        }
        // Regular message
        this.sendRoomMessage(input);
    }
    handleCommand(command) {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'users':
                this.showUsers();
                break;
            case 'rooms':
                this.showRooms();
                break;
            case 'join':
                if (args.length > 0) {
                    this.joinRoom(args[0], args[1]);
                }
                else {
                    this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /join <room> [password]');
                }
                break;
            case 'create':
                if (args.length > 0) {
                    this.createRoom(args[0], args[1], args[2]);
                }
                else {
                    this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /create <name> [type] [password]');
                }
                break;
            case 'leave':
                this.leaveRoom();
                break;
            case 'favorite':
                if (args.length > 0) {
                    this.toggleFavorite(args[0]);
                }
                else {
                    this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /favorite <nickname>');
                }
                break;
            case 'db':
                if (this.isAdmin()) {
                    this.handleDatabaseCommand(args);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'history':
                if (this.isAdmin()) {
                    this.showLocalHistory(args[0]);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'login':
                this.handleLoginCommand(args);
                break;
            case 'kick':
                if (this.isAdmin()) {
                    this.handleKickCommand(args);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'ban':
                if (this.isAdmin()) {
                    this.handleBanCommand(args);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'promote':
                if (this.isAdmin()) {
                    this.handlePromoteCommand(args);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'demote':
                if (this.isAdmin()) {
                    this.handleDemoteCommand(args);
                }
                else {
                    this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                }
                break;
            case 'password':
                this.handlePasswordCommand(args);
                break;
            case 'quit':
            case 'exit':
                this.disconnect();
                process.exit(0);
                break;
            default:
                this.addSystemLog(`\x1b[91m❌\x1b[0m Unknown command: \x1b[33m${cmd}\x1b[0m`);
                this.addSystemLog('\x1b[93mℹ\x1b[0m Type /help for available commands');
        }
    }
    handleDirectMessageInput(input) {
        const match = input.match(/^@(\w+)\s+(.+)$/);
        if (match) {
            const [, targetNickname, message] = match;
            this.sendDirectMessage(targetNickname, message);
        }
        else {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: @nickname message');
        }
    }
    sendRoomMessage(content) {
        const mentions = this.extractMentions(content);
        const message = {
            type: 'message',
            payload: {
                roomId: this.currentRoom,
                content,
                mentions
            },
            timestamp: new Date()
        };
        this.send(message);
    }
    sendDirectMessage(targetNickname, content) {
        const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
        if (!targetUser) {
            this.addSystemLog(`\x1b[91m❌\x1b[0m User \x1b[33m${targetNickname}\x1b[0m not found`);
            return;
        }
        const message = {
            type: 'dm',
            payload: {
                to: targetUser.id,
                content
            },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[95m💬\x1b[0m DM sent to \x1b[33m${targetNickname}\x1b[0m`);
    }
    joinRoom(roomName, password) {
        const room = Array.from(this.rooms.values()).find(r => r.name === roomName || r.id === roomName);
        if (!room) {
            this.addSystemLog(`\x1b[91m❌\x1b[0m Room \x1b[36m${roomName}\x1b[0m not found`);
            return;
        }
        const message = {
            type: 'join_room',
            payload: {
                roomId: room.id,
                password
            },
            timestamp: new Date()
        };
        this.send(message);
        this.currentRoom = room.id;
        // Clear message history when switching rooms
        this.messageHistory = [];
        this.addSystemLog(`\x1b[94m🏠\x1b[0m Joined room: \x1b[36m${room.name}\x1b[0m`);
        // Load local history first
        this.loadLocalHistoryForRoom(room.id);
        // Request server message history for the new room
        this.requestMessageHistory(room.id);
    }
    createRoom(name, type = 'public', password) {
        let roomType = type;
        let roomPassword = password;
        // Interactive room creation
        if (!name) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /create <name> [type] [password] [requiredGroup] [maxMembers]');
            this.addSystemLog('\x1b[90mTypes: public, password, private\\x1b[0m');
            this.addSystemLog('\x1b[90mGroups: guest, user, moderator, admin\\x1b[0m');
            return;
        }
        const message = {
            type: 'create_room',
            payload: {
                name,
                type: roomType,
                password: roomPassword,
                requiredGroup: undefined, // Can be extended later
                maxMembers: undefined // Can be extended later
            },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[94m🏠\x1b[0m Creating room: \x1b[36m${name}\x1b[0m (${roomType})`);
    }
    leaveRoom() {
        if (this.currentRoom === 'general') {
            this.addSystemLog('\x1b[91m❌\x1b[0m Cannot leave the general room');
            return;
        }
        const message = {
            type: 'leave_room',
            payload: {
                roomId: this.currentRoom
            },
            timestamp: new Date()
        };
        this.send(message);
        this.currentRoom = 'general';
        // Clear message history when switching rooms
        this.messageHistory = [];
        this.addSystemLog('\x1b[94m🏠\x1b[0m Left room, switched to \x1b[36m#general\x1b[0m');
        // Load local history first
        this.loadLocalHistoryForRoom('general');
        // Request server message history for general room
        this.requestMessageHistory('general');
    }
    toggleFavorite(nickname) {
        if (this.favorites.has(nickname)) {
            this.favorites.delete(nickname);
            this.db?.removeFavorite(nickname);
            this.addSystemLog(`\x1b[93m⭐\x1b[0m Removed \x1b[33m${nickname}\x1b[0m from favorites`);
        }
        else {
            this.favorites.add(nickname);
            this.db?.addFavorite(nickname);
            this.addSystemLog(`\x1b[93m⭐\x1b[0m Added \x1b[33m${nickname}\x1b[0m to favorites`);
        }
    }
    showUsers() {
        this.addSystemLog('\x1b[96m=== \x1b[1mOnline Users\x1b[0m\x1b[96m ===\x1b[0m');
        const onlineUsers = Array.from(this.users.values()).filter(u => u.isOnline);
        onlineUsers.forEach(user => {
            const favoriteIcon = this.favorites.has(user.nickname) ? '\x1b[93m⭐\x1b[0m' : '\x1b[92m●\x1b[0m';
            const nameColor = user.nickname === this.nickname ? '\x1b[92m' : '\x1b[33m';
            this.addSystemLog(`${favoriteIcon} ${nameColor}${user.nickname}\x1b[0m`);
        });
    }
    showRooms() {
        this.addSystemLog('\x1b[96m=== \x1b[1mAvailable Rooms\x1b[0m\x1b[96m ===\x1b[0m');
        this.rooms.forEach(room => {
            const current = room.id === this.currentRoom ? ' \x1b[92m(current)\x1b[0m' : '';
            const lock = room.type === 'password' ? '\x1b[91m🔒\x1b[0m' : '\x1b[94m🏠\x1b[0m';
            this.addSystemLog(`${lock} \x1b[36m${room.name}\x1b[0m${current}`);
        });
    }
    showHelp() {
        this.addSystemLog('\x1b[96m=== \x1b[1mDarkline Commands\x1b[0m\x1b[96m ===\x1b[0m');
        this.addSystemLog('\x1b[33m/help\x1b[0m          - Show this help');
        this.addSystemLog('\x1b[33m/users\x1b[0m         - List online users');
        this.addSystemLog('\x1b[33m/rooms\x1b[0m         - List available rooms');
        this.addSystemLog('\x1b[33m/join <room>\x1b[0m   - Join a room');
        this.addSystemLog('\x1b[33m/create <name>\x1b[0m - Create a new room');
        this.addSystemLog('\x1b[33m/leave\x1b[0m         - Leave current room');
        this.addSystemLog('\x1b[33m/favorite <user>\x1b[0m - Toggle favorite');
        this.addSystemLog('\x1b[33m/login\x1b[0m         - Login to registered account');
        this.addSystemLog('\x1b[33m/password\x1b[0m      - Change password');
        this.addSystemLog('\x1b[33m@user message\x1b[0m  - Send direct message');
        this.addSystemLog('\x1b[33m/quit\x1b[0m          - Exit chat');
        // Show admin commands only for admins
        if (this.isAdmin()) {
            this.addSystemLog('\x1b[96m=== \x1b[1mAdmin Commands\x1b[0m\x1b[96m ===\x1b[0m');
            this.addSystemLog('\x1b[33m/history [room]\x1b[0m - Show local message history');
            this.addSystemLog('\x1b[33m/db <cmd>\x1b[0m      - Database commands (info/purge/export)');
            this.addSystemLog('\x1b[33m/kick <user>\x1b[0m   - Kick user from room');
            this.addSystemLog('\x1b[33m/ban <user>\x1b[0m    - Ban user from server');
            this.addSystemLog('\x1b[33m/promote <user>\x1b[0m - Promote user');
            this.addSystemLog('\x1b[33m/demote <user>\x1b[0m - Demote user');
        }
        this.addSystemLog('\x1b[95mMentions:\x1b[0m Use @nickname to notify');
        this.addSystemLog('\x1b[95mShortcuts:\x1b[0m Press Ctrl+C to quit');
    }
    setupTerminalResize() {
        process.stdout.on('resize', () => {
            this.terminalHeight = process.stdout.rows || 24;
            this.calculateLayout();
            this.redrawScreen();
        });
    }
    drawPersistentFooter(prompt) {
        // Move to bottom of terminal
        (0, readline_1.cursorTo)(process.stdout, 0, this.terminalHeight - this.footerHeight);
        // Clear footer area
        for (let i = 0; i < this.footerHeight; i++) {
            (0, readline_1.clearLine)(process.stdout, 0);
            if (i < this.footerHeight - 1)
                process.stdout.write('\n');
        }
        // Move back to start of footer
        (0, readline_1.cursorTo)(process.stdout, 0, this.terminalHeight - this.footerHeight);
        // Calculate box width based on layout
        let maxWidth, paddingLength;
        if (this.useSplitView) {
            // In split view, use full chat width
            maxWidth = this.chatWidth - 2;
            paddingLength = 1;
        }
        else {
            // In full view, center the box
            maxWidth = process.stdout.columns - 4;
            paddingLength = Math.max(0, Math.floor((process.stdout.columns - Math.min(100, maxWidth)) / 2));
            maxWidth = Math.min(100, maxWidth);
        }
        const boxWidth = maxWidth;
        const padding = ' '.repeat(paddingLength);
        // Top border
        const topBorder = '╭' + '─'.repeat(boxWidth - 2) + '╮';
        process.stdout.write(padding + '\x1b[36m' + topBorder + '\x1b[0m');
        // Add separator in split view
        if (this.useSplitView) {
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth, this.terminalHeight - this.footerHeight);
            process.stdout.write('\x1b[90m│\x1b[0m');
        }
        process.stdout.write('\n');
        // Input line with prompt and better styling
        const roomName = this.rooms.get(this.currentRoom)?.name || this.currentRoom;
        const styledPrompt = `\x1b[96m[\x1b[94m${roomName}\x1b[96m]\x1b[0m \x1b[92m${this.nickname}\x1b[0m: `;
        const inputContent = styledPrompt + this.inputBuffer;
        const maxContentWidth = boxWidth + 24;
        let displayContent = inputContent;
        // Scroll input if it's too long
        if (displayContent.length > maxContentWidth) {
            const scrollOffset = Math.max(0, this.cursorPosition + prompt.length - maxContentWidth + 5);
            displayContent = displayContent.substring(scrollOffset, scrollOffset + maxContentWidth);
        }
        const paddedContent = displayContent.padEnd(maxContentWidth);
        process.stdout.write(padding + '\x1b[36m│\x1b[0m ' + paddedContent.substring(0, maxContentWidth) + ' \x1b[36m│\x1b[0m');
        // Add separator in split view
        if (this.useSplitView) {
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth, this.terminalHeight - this.footerHeight + 1);
            process.stdout.write('\x1b[90m│\x1b[0m');
        }
        process.stdout.write('\n');
        // Bottom border
        const bottomBorder = '╰' + '─'.repeat(boxWidth - 2) + '╯';
        process.stdout.write(padding + '\x1b[36m' + bottomBorder + '\x1b[0m');
        // Add separator in split view
        if (this.useSplitView) {
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth, this.terminalHeight - this.footerHeight + 2);
            process.stdout.write('\x1b[90m│\x1b[0m');
        }
        // Store the prompt line position (middle line of the box)
        this.lastPromptLine = this.terminalHeight - this.footerHeight + 1;
        this.footerHeight = 3; // Box takes 3 lines
    }
    clearFooterAndPrint(message) {
        this.printMessage(message);
        this.showPrompt();
    }
    printMessage(message) {
        // Clear the footer box (3 lines)
        for (let i = 0; i < this.footerHeight; i++) {
            (0, readline_1.cursorTo)(process.stdout, 0, this.terminalHeight - this.footerHeight + i);
            (0, readline_1.clearLine)(process.stdout, 0);
        }
        // Print message in the content area (above the footer)
        (0, readline_1.cursorTo)(process.stdout, 0, this.terminalHeight - this.footerHeight - 1);
        process.stdout.write(message + '\n');
        // Scroll the terminal up to ensure message is visible
        process.stdout.write('\n');
    }
    clearScreen() {
        // Clear the entire screen except for footer
        for (let i = 0; i < this.terminalHeight - this.footerHeight; i++) {
            (0, readline_1.cursorTo)(process.stdout, 0, i);
            (0, readline_1.clearLine)(process.stdout, 0);
        }
        (0, readline_1.cursorTo)(process.stdout, 0, 0);
    }
    addToMessageHistory(message) {
        this.messageHistory.push(message);
        // Maintain maximum history size
        if (this.messageHistory.length > this.maxHistoryMessages) {
            this.messageHistory.shift();
        }
    }
    redrawScreen() {
        this.calculateLayout();
        this.clearScreen();
        if (this.useSplitView) {
            this.drawSplitView();
        }
        else {
            this.drawFullView();
        }
        // Redraw prompt
        this.showPrompt();
    }
    drawSplitView() {
        const availableLines = this.terminalHeight - this.footerHeight - 1;
        // Draw header
        this.drawHeader();
        // Draw chat area (left side)
        this.drawChatArea(availableLines - 1); // -1 for header only
        // Draw system log area (right side)
        this.drawSystemLogArea(availableLines - 1);
    }
    drawFullView() {
        const availableLines = this.terminalHeight - this.footerHeight - this.notificationHeight - 1;
        // Show only the messages that fit on screen (most recent ones)
        const visibleMessages = this.messageHistory.slice(-availableLines);
        // Display message history
        visibleMessages.forEach((message, index) => {
            (0, readline_1.cursorTo)(process.stdout, 0, index);
            process.stdout.write(message);
        });
        // Draw notification area
        this.drawNotificationArea();
    }
    drawHeader() {
        (0, readline_1.cursorTo)(process.stdout, 0, 0);
        // Chat header (simple)
        const chatHeader = `\x1b[1m\x1b[96mCHAT - ${this.rooms.get(this.currentRoom)?.name || this.currentRoom}\x1b[0m`;
        process.stdout.write(chatHeader);
        // Separator
        (0, readline_1.cursorTo)(process.stdout, this.chatWidth, 0);
        process.stdout.write('\x1b[90m│\x1b[0m');
        // System log header (simple)
        (0, readline_1.cursorTo)(process.stdout, this.chatWidth + 1, 0);
        const systemHeader = `\x1b[1m\x1b[93mSYSTEM LOG\x1b[0m`;
        process.stdout.write(systemHeader);
    }
    drawChatArea(availableLines) {
        const visibleMessages = this.messageHistory.slice(-availableLines);
        visibleMessages.forEach((message, index) => {
            (0, readline_1.cursorTo)(process.stdout, 0, index + 1); // +1 for header
            // Truncate message if it's too long for chat area
            const truncatedMessage = this.truncateMessage(message, this.chatWidth - 1);
            process.stdout.write(truncatedMessage);
            // Draw separator
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth, index + 1);
            process.stdout.write('\x1b[90m│\x1b[0m');
        });
        // Fill empty lines with separators
        for (let i = visibleMessages.length; i < availableLines; i++) {
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth, i + 1);
            process.stdout.write('\x1b[90m│\x1b[0m');
        }
    }
    drawSystemLogArea(availableLines) {
        const visibleSystemLog = this.systemLog.slice(-availableLines);
        visibleSystemLog.forEach((logEntry, index) => {
            (0, readline_1.cursorTo)(process.stdout, this.chatWidth + 1, index + 1); // +1 for separator
            // Truncate log entry if it's too long
            const truncatedLog = this.truncateMessage(logEntry, this.systemLogWidth - 1);
            process.stdout.write(truncatedLog);
        });
    }
    truncateMessage(message, maxWidth) {
        // Remove ANSI codes for length calculation
        const plainText = message.replace(/\x1b\[[0-9;]*m/g, '');
        if (plainText.length <= maxWidth) {
            return message;
        }
        // Find a good truncation point preserving ANSI codes
        let truncated = '';
        let plainLength = 0;
        let i = 0;
        while (i < message.length && plainLength < maxWidth - 3) {
            if (message[i] === '\x1b') {
                // Copy ANSI escape sequence
                let j = i;
                while (j < message.length && message[j] !== 'm')
                    j++;
                truncated += message.substring(i, j + 1);
                i = j + 1;
            }
            else {
                truncated += message[i];
                plainLength++;
                i++;
            }
        }
        return truncated + '\x1b[90m...\x1b[0m';
    }
    addNotification(message) {
        this.notifications.push(message);
        // Maintain maximum notification history
        if (this.notifications.length > this.maxNotifications) {
            this.notifications.shift();
        }
        this.redrawScreen();
    }
    addSystemLog(message) {
        const timestamp = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const logEntry = `\x1b[90m[${timestamp}]\x1b[0m ${message}`;
        this.systemLog.push(logEntry);
        // Maintain maximum system log history
        if (this.systemLog.length > this.maxSystemLog) {
            this.systemLog.shift();
        }
        this.redrawScreen();
    }
    calculateLayout() {
        const termWidth = process.stdout.columns || 80;
        if (this.useSplitView && termWidth >= 120) {
            // Split view: chat on left, system log on right
            this.chatWidth = Math.floor(termWidth * 0.65); // 65% for chat
            this.systemLogWidth = termWidth - this.chatWidth - 1; // 1 for separator
        }
        else {
            // Full width for chat, system log disabled or overlay
            this.chatWidth = termWidth;
            this.systemLogWidth = 0;
            this.useSplitView = false;
        }
    }
    drawNotificationArea() {
        const notificationStartY = this.terminalHeight - this.footerHeight - this.notificationHeight;
        // Clear notification area
        for (let i = 0; i < this.notificationHeight; i++) {
            (0, readline_1.cursorTo)(process.stdout, 0, notificationStartY + i);
            (0, readline_1.clearLine)(process.stdout, 0);
        }
        // Draw notifications (most recent ones)
        const visibleNotifications = this.notifications.slice(-this.notificationHeight);
        visibleNotifications.forEach((notification, index) => {
            (0, readline_1.cursorTo)(process.stdout, 0, notificationStartY + index);
            process.stdout.write('\x1b[100m' + notification + '\x1b[0m'); // Gray background for notifications
        });
    }
    extractMentions(content) {
        const mentions = content.match(/@(\w+)/g);
        return mentions ? mentions.map(m => m.slice(1)) : [];
    }
    send(message) {
        console.log(`DEBUG CLIENT: Attempting to send message type '${message.type}'`);
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            console.log(`DEBUG CLIENT: WebSocket is open, sending message`);
            this.ws.send(JSON.stringify(message));
        }
        else {
            console.log(`DEBUG CLIENT: WebSocket not ready - state: ${this.ws?.readyState}`);
        }
    }
    requestMessageHistory(roomId) {
        const message = {
            type: 'get_history',
            payload: {
                roomId: roomId
            },
            timestamp: new Date()
        };
        this.send(message);
    }
    generateHardId() {
        return Buffer.from(this.keyPair.signingPublicKey).toString('hex').substring(0, 16);
    }
    handleAuthChallenge(payload) {
        const { challenge, message, authRequired } = payload;
        if (authRequired) {
            // This is an auth requirement, not a crypto challenge
            this.addSystemLog(`\x1b[93m🔐 ${message}\x1b[0m`);
            this.addSystemLog('\x1b[90mℹ Available commands:\x1b[0m');
            this.addSystemLog('\x1b[33m/login <nickname> <password>\x1b[0m - Login to existing account');
            this.showPrompt();
            return;
        }
        // Handle crypto challenge (existing hardId auth)
        this.addSystemLog(`\x1b[93m🔐 CRYPTO CHALLENGE: ${message}\x1b[0m`);
        try {
            const signature = encryption_1.CryptoEngine.sign(Buffer.from(challenge, 'hex'), this.keyPair.signingPrivateKey);
            const response = {
                type: 'auth_response',
                payload: {
                    challengeResponse: Buffer.from(signature).toString('hex')
                },
                timestamp: new Date()
            };
            this.send(response);
            this.addSystemLog('\x1b[93m🔐 Sending authentication response...\x1b[0m');
        }
        catch (error) {
            this.addSystemLog('\x1b[91m❌ Authentication failed\x1b[0m');
        }
    }
    handleAuthSuccess(payload) {
        // Only show the message if it's not from login/register (those have their own handlers)
        if (!payload.group) {
            this.addSystemLog(`\x1b[92m✅ ${payload.message}\x1b[0m`);
        }
        // Restore the proper chat interface after authentication
        this.restoreChatInput();
        // Load local history and show help after successful auth
        this.loadLocalHistoryForRoom(this.currentRoom);
        this.requestMessageHistory(this.currentRoom);
        this.addSystemLog('\x1b[93m📝\x1b[0m Type \x1b[33m/help\x1b[0m to see available commands');
        this.showPrompt();
    }
    getGroupColor(group) {
        switch (group.toLowerCase()) {
            case 'banned': return '\x1b[91m'; // Red
            case 'guest': return '\x1b[90m'; // Gray
            case 'user': return '\x1b[94m'; // Blue
            case 'moderator': return '\x1b[93m'; // Yellow
            case 'admin': return '\x1b[95m'; // Magenta
            case 'owner': return '\x1b[92m'; // Green
            default: return '\x1b[0m';
        }
    }
    isAdmin() {
        return ['admin', 'owner'].includes(this.userGroup.toLowerCase());
    }
    handleAuthFailed(payload) {
        this.addSystemLog(`\x1b[91m❌ AUTH FAILED: ${payload.message}\x1b[0m`);
    }
    handleRegistrationSuccess(payload) {
        this.addSystemLog(`\x1b[92m✓\x1b[0m ${payload.message}`);
        if (payload.group) {
            this.userGroup = payload.group;
            const groupColor = this.getGroupColor(payload.group);
            this.addSystemLog(`\x1b[90m🏅 Group: ${groupColor}${payload.group.toUpperCase()}\x1b[0m`);
        }
    }
    handleRegistrationFailed(payload) {
        this.addSystemLog(`\x1b[91m❌ REGISTRATION FAILED: ${payload.message}\x1b[0m`);
    }
    handleLoginSuccess(payload) {
        this.addSystemLog(`\x1b[92m✓\x1b[0m ${payload.message}`);
        if (payload.group) {
            this.userGroup = payload.group;
            const groupColor = this.getGroupColor(payload.group);
            this.addSystemLog(`\x1b[90m🏅 Group: ${groupColor}${payload.group.toUpperCase()}\x1b[0m`);
        }
        // Restore chat interface after successful login
        this.restoreChatInput();
    }
    handleLoginFailed(payload) {
        this.addSystemLog(`\x1b[91m❌ LOGIN FAILED: ${payload.message}\x1b[0m`);
        // Restore chat interface even after failed login
        this.restoreChatInput();
    }
    handlePermissionDenied(payload) {
        this.addSystemLog(`\x1b[91m🚫 PERMISSION DENIED: ${payload.message}\x1b[0m`);
    }
    handleUserKicked(payload) {
        this.addSystemLog(`\x1b[91m👢 KICKED from ${payload.roomId}: ${payload.reason}`);
        this.addSystemLog(`\x1b[90mBy: ${payload.by}\x1b[0m`);
    }
    handleUserBanned(payload) {
        this.addSystemLog(`\x1b[91m🚫 BANNED: ${payload.reason}`);
        this.addSystemLog(`\x1b[90mBy: ${payload.by}\x1b[0m`);
        this.addSystemLog(`\x1b[91mConnection will be terminated...\x1b[0m`);
    }
    handleUserPromoted(payload) {
        this.addSystemLog(`\x1b[92m⬆ PROMOTED to ${payload.newGroup}`);
        this.addSystemLog(`\x1b[90mBy: ${payload.by}\x1b[0m`);
    }
    handleUserDemoted(payload) {
        this.addSystemLog(`\x1b[93m⬇ DEMOTED to ${payload.newGroup}`);
        this.addSystemLog(`\x1b[90mBy: ${payload.by}\x1b[0m`);
    }
    setupRawMode() {
        if (process.stdin.isTTY) {
            // Remove any existing listeners to prevent duplicates
            process.stdin.removeAllListeners('data');
            process.stdin.setRawMode(true);
            process.stdin.on('data', (key) => {
                this.handleRawInput(key);
            });
        }
    }
    handleRawInput(key) {
        const keyStr = key.toString();
        const keyCode = key[0];
        // Handle special keys
        if (keyCode === 3) { // Ctrl+C
            console.log('\nGoodbye!');
            this.disconnect();
            process.exit(0);
        }
        else if (keyCode === 13) { // Enter
            this.processInput();
        }
        else if (keyCode === 127) { // Backspace
            this.handleBackspace();
        }
        else if (keyCode === 27) { // Escape sequences (arrow keys, etc.)
            this.handleEscapeSequence(key);
        }
        else if (keyCode >= 32 && keyCode <= 126) { // Printable characters
            // Make sure we only process single character inputs
            if (keyStr.length === 1) {
                this.insertCharacter(keyStr);
            }
        }
    }
    processInput() {
        if (this.inputBuffer.trim()) {
            this.handleUserInput(this.inputBuffer.trim());
        }
        this.inputBuffer = '';
        this.cursorPosition = 0;
        this.showPrompt();
    }
    handleBackspace() {
        if (this.cursorPosition > 0) {
            this.inputBuffer = this.inputBuffer.slice(0, this.cursorPosition - 1) +
                this.inputBuffer.slice(this.cursorPosition);
            this.cursorPosition--;
            this.updateInputDisplay();
        }
    }
    insertCharacter(char) {
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPosition) +
            char +
            this.inputBuffer.slice(this.cursorPosition);
        this.cursorPosition++;
        this.updateInputDisplay();
    }
    handleEscapeSequence(key) {
        if (key.length === 3 && key[1] === 91) { // Arrow keys
            switch (key[2]) {
                case 68: // Left arrow
                    if (this.cursorPosition > 0) {
                        this.cursorPosition--;
                        this.updateInputDisplay();
                    }
                    break;
                case 67: // Right arrow
                    if (this.cursorPosition < this.inputBuffer.length) {
                        this.cursorPosition++;
                        this.updateInputDisplay();
                    }
                    break;
            }
        }
    }
    updateInputDisplay() {
        const roomName = this.rooms.get(this.currentRoom)?.name || this.currentRoom;
        const prompt = `[${roomName}] ${this.nickname}: `;
        // Clear the entire footer box
        for (let i = 0; i < this.footerHeight; i++) {
            (0, readline_1.cursorTo)(process.stdout, 0, this.terminalHeight - this.footerHeight + i);
            (0, readline_1.clearLine)(process.stdout, 0);
        }
        // Redraw the box with updated content
        this.drawPersistentFooter(prompt);
        // Position cursor correctly based on layout
        this.positionCursor();
    }
    positionCursor() {
        const roomName = this.rooms.get(this.currentRoom)?.name || this.currentRoom;
        const plainPromptLength = `[${roomName}] ${this.nickname}: `.length;
        let cursorX;
        const columns = process.stdout.columns || 80;
        if (this.useSplitView) {
            // In split view, cursor is positioned relative to chat area
            cursorX = 2 + plainPromptLength + this.cursorPosition; // 2 for box border + content
        }
        else {
            // In full view, center the box
            const boxWidth = Math.min(100, columns - 4);
            const padding = Math.max(0, Math.floor((columns - boxWidth) / 2));
            cursorX = padding + 2 + plainPromptLength + this.cursorPosition;
        }
        // Ensure cursor position is valid
        if (isNaN(cursorX) || cursorX < 0) {
            cursorX = 0;
        }
        (0, readline_1.cursorTo)(process.stdout, cursorX, this.lastPromptLine);
    }
    showPrompt() {
        const roomName = this.rooms.get(this.currentRoom)?.name || this.currentRoom;
        const prompt = `[${roomName}] ${this.nickname}: `;
        this.drawPersistentFooter(prompt);
        // Position cursor correctly
        this.positionCursor();
    }
    handleDatabaseCommand(args) {
        if (!this.db) {
            this.addSystemLog('\x1b[91m❌\x1b[0m Database not initialized');
            return;
        }
        const subCommand = args[0]?.toLowerCase();
        switch (subCommand) {
            case 'info':
                const dbSize = this.db.getDbSize();
                const favorites = this.db.getFavorites().length;
                const rooms = this.db.getRooms().length;
                this.addSystemLog('\x1b[96m=== \x1b[1mDatabase Info\x1b[0m\x1b[96m ===\x1b[0m');
                this.addSystemLog(`\x1b[90m💾 Path:\x1b[0m ${this.db.getDbPath()}`);
                this.addSystemLog(`\x1b[90m📊 Size:\x1b[0m ${dbSize} bytes`);
                this.addSystemLog(`\x1b[93m⭐ Favorites:\x1b[0m ${favorites}`);
                this.addSystemLog(`\x1b[94m🏠 Rooms:\x1b[0m ${rooms}`);
                break;
            case 'purge':
                this.db.purge();
                this.favorites.clear();
                this.addSystemLog('\x1b[91m🗑\x1b[0m Database purged and reset');
                break;
            case 'export':
                const exportData = this.db.exportData();
                this.addSystemLog('\x1b[96m=== \x1b[1mDatabase Export\x1b[0m\x1b[96m ===\x1b[0m');
                this.addSystemLog('\x1b[90mCopy the following data to backup:\x1b[0m');
                this.addSystemLog(exportData.substring(0, 200) + '...');
                this.addSystemLog('\x1b[90m(truncated - check console for full export)\x1b[0m');
                console.log('=== FULL DATABASE EXPORT ===');
                console.log(exportData);
                console.log('=== END EXPORT ===');
                break;
            default:
                this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /db <info|purge|export>');
        }
    }
    showLocalHistory(roomName) {
        if (!this.db) {
            this.addSystemLog('\x1b[91m❌\x1b[0m Database not initialized');
            return;
        }
        const roomId = roomName || this.currentRoom;
        const history = this.db.getMessageHistory(roomId);
        if (history.length === 0) {
            this.addSystemLog(`\x1b[93mℹ\x1b[0m No local history for room: ${roomId}`);
            return;
        }
        this.addSystemLog(`\x1b[96m=== \x1b[1mLocal History - ${roomId}\x1b[0m\x1b[96m ===\x1b[0m`);
        history.slice(-10).forEach(msg => {
            const timestamp = this.formatTimestamp(new Date(msg.timestamp));
            this.addSystemLog(`\x1b[90m[${timestamp}]\x1b[0m \x1b[33m${msg.fromNickname}\x1b[0m: ${msg.content}`);
        });
        if (history.length > 10) {
            this.addSystemLog(`\x1b[90m... and ${history.length - 10} older messages\x1b[0m`);
        }
    }
    loadLocalHistoryForRoom(roomId) {
        if (!this.db)
            return;
        const history = this.db.getMessageHistory(roomId);
        if (history.length > 0) {
            this.addSystemLog(`\x1b[90m💾 Loaded ${history.length} local messages for ${roomId}\x1b[0m`);
            // Add local history to current display (last 5 messages)
            history.slice(-5).forEach(msg => {
                const timestamp = this.formatTimestamp(new Date(msg.timestamp));
                const nameColor = msg.fromNickname === this.nickname ? '\x1b[92m' : '\x1b[33m';
                const formattedMessage = `\x1b[90m[${timestamp}]\x1b[0m ${nameColor}${msg.fromNickname}\x1b[0m: ${msg.content}`;
                this.addToMessageHistory(formattedMessage);
            });
        }
    }
    handleLoginCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /login <nickname> <password>');
            return;
        }
        const [nickname, password] = args;
        const message = {
            type: 'login',
            payload: { nickname, password },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog('\x1b[93m🔐\x1b[0m Login attempt...');
    }
    handleKickCommand(args) {
        if (args.length < 1) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /kick <nickname> [reason]');
            return;
        }
        const targetNickname = args[0];
        const reason = args.slice(1).join(' ');
        const message = {
            type: 'kick_user',
            payload: { targetNickname, roomId: this.currentRoom, reason },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[91m👢\x1b[0m Kick request sent for ${targetNickname}`);
    }
    handleBanCommand(args) {
        if (args.length < 1) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /ban <nickname> [reason]');
            return;
        }
        const targetNickname = args[0];
        const reason = args.slice(1).join(' ');
        const message = {
            type: 'ban_user',
            payload: { targetNickname, reason },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[91m🚫\x1b[0m Ban request sent for ${targetNickname}`);
    }
    handlePromoteCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /promote <nickname> <group>');
            this.addSystemLog('\x1b[90mGroups: guest, user, moderator, admin\x1b[0m');
            return;
        }
        const [targetNickname, newGroup] = args;
        const message = {
            type: 'promote_user',
            payload: { targetNickname, newGroup },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[92m⬆\x1b[0m Promotion request sent for ${targetNickname} to ${newGroup}`);
    }
    handleDemoteCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /demote <nickname> <group>');
            this.addSystemLog('\x1b[90mGroups: guest, user, moderator, admin\x1b[0m');
            return;
        }
        const [targetNickname, newGroup] = args;
        const message = {
            type: 'demote_user',
            payload: { targetNickname, newGroup },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`\x1b[93m⬇\x1b[0m Demotion request sent for ${targetNickname} to ${newGroup}`);
    }
    handlePasswordCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('\x1b[93mℹ\x1b[0m Usage: /password <current> <new>');
            return;
        }
        const [currentPassword, newPassword] = args;
        const message = {
            type: 'set_password',
            payload: { currentPassword, newPassword },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog('\x1b[93m🔐\x1b[0m Password change request sent...');
    }
    formatTimestamp(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (messageDate.getTime() === today.getTime()) {
            // Today - just show time
            return date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
        else if (messageDate.getTime() === yesterday.getTime()) {
            // Yesterday
            return `Ontem ${date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })}`;
        }
        else {
            // Older - show date and time
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }
    async handlePasswordRequired(payload) {
        const { message, nickname } = payload;
        if (!this.providedPassword) {
            console.error('\x1b[91m❌ Password required. Please use: darkline connect -n <nickname> -p <password>\x1b[0m');
            process.exit(1);
        }
        console.log(`\x1b[93m🔐 Logging in as ${nickname}...\x1b[0m`);
        // Send login request with provided password
        const loginMessage = {
            type: 'login',
            payload: { nickname, password: this.providedPassword },
            timestamp: new Date()
        };
        this.send(loginMessage);
    }
    async handleCreateAccount(payload) {
        const { message, nickname } = payload;
        if (!this.providedPassword) {
            console.error('\x1b[91m❌ Password required. Please use: darkline connect -n <nickname> -p <password>\x1b[0m');
            process.exit(1);
        }
        if (this.providedPassword.length < 3) {
            console.error('\x1b[91m❌ Password must be at least 3 characters\x1b[0m');
            process.exit(1);
        }
        console.log(`\x1b[93m📝 Creating account for ${nickname}...\x1b[0m`);
        // Send registration request with provided password
        const registerMessage = {
            type: 'register',
            payload: { nickname, password: this.providedPassword },
            timestamp: new Date()
        };
        this.send(registerMessage);
    }
    restoreChatInput() {
        // Close existing readline interface if it exists
        if (this.rl) {
            this.rl.close();
        }
        // Recreate the readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        // Restore raw mode and setup input handlers (this will remove duplicates)
        this.setupRawMode();
        this.setupReadlineHandlers();
        // Clear screen and redraw the interface
        console.clear();
        this.redrawScreen();
    }
    disconnect() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        if (this.ws) {
            this.ws.close();
        }
        this.rl.close();
    }
}
exports.DarklineClient = DarklineClient;
//# sourceMappingURL=index.js.map