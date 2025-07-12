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
exports.BlessedDarklineClient = void 0;
const blessed = __importStar(require("blessed"));
const ws_1 = __importDefault(require("ws"));
const encryption_1 = require("../crypto/encryption");
const database_1 = require("./database");
class BlessedDarklineClient {
    constructor() {
        this.ws = null;
        this.nickname = '';
        this.currentRoom = 'general';
        this.users = new Map();
        this.rooms = new Map();
        this.favorites = new Set();
        this.serverPublicKey = '';
        this.hardId = '';
        this.db = null;
        this.keyPair = encryption_1.CryptoEngine.generateKeyPair();
        this.hardId = this.generateHardId();
        this.setupUI();
    }
    setupUI() {
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Darkline Chat Client',
            cursor: {
                artificial: true,
                shape: 'line',
                blink: true,
                color: 'cyan'
            }
        });
        // Main container
        this.mainContainer = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '75%',
            height: '100%',
            border: {
                type: 'line',
                fg: 'cyan'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'cyan'
                }
            }
        });
        // Right panel for users and rooms
        this.rightPanel = blessed.box({
            parent: this.screen,
            top: 0,
            right: 0,
            width: '25%',
            height: '100%',
            border: {
                type: 'line',
                fg: 'cyan'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'cyan'
                }
            }
        });
        // Chat box (main message area)
        this.chatBox = blessed.log({
            parent: this.mainContainer,
            top: 0,
            left: 0,
            width: '100%',
            height: '70%',
            tags: true,
            mouse: false, // Disable mouse to prevent interference
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'yellow'
                },
                style: {
                    inverse: true
                }
            },
            border: {
                type: 'line',
                fg: 'blue'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'blue'
                }
            },
            label: ' {cyan-fg}💬 Chat{/cyan-fg} '
        });
        // System log box
        this.systemBox = blessed.log({
            parent: this.mainContainer,
            top: '70%',
            left: 0,
            width: '100%',
            height: '20%',
            tags: true,
            mouse: false, // Disable mouse to prevent interference
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'yellow'
                },
                style: {
                    inverse: true
                }
            },
            border: {
                type: 'line',
                fg: 'yellow'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'yellow'
                }
            },
            label: ' {yellow-fg}⚙️  System Log{/yellow-fg} '
        });
        // Input box
        this.inputBox = blessed.textarea({
            parent: this.mainContainer,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 3,
            inputOnFocus: true,
            keys: true,
            vi: false,
            mouse: true,
            border: {
                type: 'line',
                fg: 'green'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'green'
                },
                focus: {
                    border: {
                        fg: 'bright-green'
                    }
                }
            },
            label: ' {green-fg}📝 Type message (Ctrl+S to send, Tab to switch focus){/green-fg} '
        });
        // Users list
        this.usersList = blessed.list({
            parent: this.rightPanel,
            top: 0,
            left: 0,
            width: '100%',
            height: '50%',
            tags: true,
            mouse: true,
            keys: true,
            vi: true,
            scrollable: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'yellow'
                },
                style: {
                    inverse: true
                }
            },
            border: {
                type: 'line',
                fg: 'magenta'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'magenta'
                },
                selected: {
                    bg: 'blue',
                    fg: 'white'
                }
            },
            label: ' {magenta-fg}👥 Users{/magenta-fg} '
        });
        // Rooms list
        this.roomsList = blessed.list({
            parent: this.rightPanel,
            top: '50%',
            left: 0,
            width: '100%',
            height: '50%',
            tags: true,
            mouse: true,
            keys: true,
            vi: true,
            scrollable: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'yellow'
                },
                style: {
                    inverse: true
                }
            },
            border: {
                type: 'line',
                fg: 'cyan'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'cyan'
                },
                selected: {
                    bg: 'blue',
                    fg: 'white'
                }
            },
            label: ' {cyan-fg}🏠 Rooms{/cyan-fg} '
        });
        // Status bar
        this.statusBar = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: '{cyan-fg}Disconnected{/cyan-fg} | {yellow-fg}Press F1 for help, Ctrl+Q to quit{/yellow-fg}',
            tags: true,
            style: {
                fg: 'white',
                bg: 'blue'
            }
        });
        this.setupEventHandlers();
        this.screen.render();
    }
    setupEventHandlers() {
        // Global key bindings
        this.screen.key(['C-q'], () => {
            this.disconnect();
            process.exit(0);
        });
        this.screen.key(['f1'], () => {
            this.showHelp();
        });
        this.screen.key(['tab'], () => {
            this.screen.focusNext();
        });
        this.screen.key(['S-tab'], () => {
            this.screen.focusPrevious();
        });
        // Input box handlers with improved deduplication protection
        let isProcessing = false;
        const handleSubmit = () => {
            if (isProcessing)
                return;
            isProcessing = true;
            const content = this.inputBox.value;
            if (content && content.trim()) {
                this.handleUserInput(content.trim());
                this.inputBox.clearValue();
                this.screen.render();
            }
            setTimeout(() => {
                isProcessing = false;
            }, 300);
        };
        // Only use Ctrl+S to avoid duplicate events
        this.inputBox.key(['C-s'], handleSubmit);
        // Users list handlers
        this.usersList.on('select', (item) => {
            if (item && item.content) {
                const username = item.content.replace(/.*}([^{]+){.*/, '$1');
                this.inputBox.setValue(`@${username} `);
                this.inputBox.focus();
                this.screen.render();
            }
        });
        // Rooms list handlers
        this.roomsList.on('select', (item) => {
            if (item && item.content) {
                const roomName = item.content.replace(/.*}([^{]+){.*/, '$1');
                this.joinRoom(roomName);
            }
        });
        // Focus input by default
        this.inputBox.focus();
    }
    async connect(serverUrl, nickname) {
        return new Promise((resolve, reject) => {
            this.nickname = nickname;
            this.ws = new ws_1.default(serverUrl);
            this.ws.on('open', () => {
                this.updateStatus(`{green-fg}Connected to ${serverUrl}{/green-fg}`);
                this.addSystemLog(`{green-fg}✓{/green-fg} Connected to {cyan-fg}${serverUrl}{/cyan-fg}`);
                this.sendHandshake();
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleServerMessage(message);
                }
                catch (error) {
                    this.addSystemLog(`{red-fg}Error parsing server message: ${error}{/red-fg}`);
                }
            });
            this.ws.on('close', () => {
                this.updateStatus('{red-fg}Disconnected{/red-fg}');
                this.addSystemLog('{red-fg}✗ Disconnected from server{/red-fg}');
            });
            this.ws.on('error', (error) => {
                this.addSystemLog(`{red-fg}✗ Connection error: ${error}{/red-fg}`);
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
        this.addSystemLog(`{green-fg}✓{/green-fg} Connected to server {cyan-fg}${payload.serverName}{/cyan-fg}`);
        this.initializeDatabase();
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
        const savedFavorites = this.db.getFavorites();
        savedFavorites.forEach(nickname => {
            this.favorites.add(nickname);
        });
        const savedRooms = this.db.getRooms();
        savedRooms.forEach(room => {
            this.rooms.set(room.id, room);
        });
    }
    handleUserJoined(payload) {
        const { user, roomId } = payload;
        this.users.set(user.id, user);
        if (!roomId || roomId === this.currentRoom) {
            this.addChatMessage(`{green-fg}▶{/green-fg} {yellow-fg}${user.nickname}{/yellow-fg} joined the chat`);
            this.addSystemLog(`{green-fg}▶{/green-fg} User {yellow-fg}${user.nickname}{/yellow-fg} joined room`);
            this.updateUsersList();
        }
    }
    handleUserLeft(payload) {
        const { userId, roomId } = payload;
        const user = this.users.get(userId);
        if (user && (!roomId || roomId === this.currentRoom)) {
            this.addChatMessage(`{red-fg}◀{/red-fg} {yellow-fg}${user.nickname}{/yellow-fg} left the chat`);
            this.addSystemLog(`{red-fg}◀{/red-fg} User {yellow-fg}${user.nickname}{/yellow-fg} left room`);
            this.updateUsersList();
        }
    }
    handleMessage(payload) {
        const { message } = payload;
        if (message.roomId === this.currentRoom) {
            const prefix = message.isMention ? '{yellow-fg}🔔{/yellow-fg} ' : '';
            const timestamp = this.formatTimestamp(new Date(message.timestamp));
            const nameColor = message.fromNickname === this.nickname ? '{green-fg}' : '{yellow-fg}';
            const formattedMessage = `${prefix}{gray-fg}[${timestamp}]{/gray-fg} ${nameColor}${message.fromNickname}{/}: ${message.content}`;
            this.addChatMessage(formattedMessage);
            this.db?.addMessage(message.roomId, message.content, message.fromNickname, new Date(message.timestamp));
            if (message.mentions?.includes(this.nickname)) {
                this.addChatMessage('{yellow-fg}🔔 You were mentioned!{/yellow-fg}');
            }
        }
    }
    handleDirectMessage(payload) {
        const { message } = payload;
        const timestamp = this.formatTimestamp(new Date(message.timestamp));
        const formattedMessage = `{magenta-fg}💬 DM{/magenta-fg} from {yellow-fg}${message.fromNickname}{/yellow-fg} {gray-fg}[${timestamp}]{/gray-fg}: ${message.content}`;
        this.addChatMessage(formattedMessage);
        this.db?.addMessage(`dm_${message.fromNickname}`, message.content, message.fromNickname, new Date(message.timestamp));
    }
    handleRoomCreated(payload) {
        const { room } = payload;
        this.rooms.set(room.id, room);
        this.db?.saveRoom(room);
        this.addSystemLog(`{blue-fg}🏠{/blue-fg} New room created: {cyan-fg}${room.name}{/cyan-fg}`);
        this.updateRoomsList();
    }
    handleUsersList(payload) {
        const { users } = payload;
        users.forEach((user) => {
            this.users.set(user.id, user);
        });
        this.updateUsersList();
    }
    handleRoomsList(payload) {
        const { rooms } = payload;
        rooms.forEach((room) => {
            this.rooms.set(room.id, room);
            this.db?.saveRoom(room);
        });
        this.updateRoomsList();
    }
    handleMessageHistory(payload) {
        const { roomId, messages } = payload;
        if (roomId === this.currentRoom && messages.length > 0) {
            const sortedMessages = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            this.chatBox.setContent('');
            sortedMessages.forEach((message) => {
                const timestamp = this.formatTimestamp(new Date(message.timestamp));
                const formattedMessage = `{gray-fg}[${timestamp}]{/gray-fg} {yellow-fg}${message.fromNickname}{/}: ${message.content}`;
                this.addChatMessage(formattedMessage);
            });
        }
    }
    handleError(payload) {
        this.addSystemLog(`{red-fg}❌ ERROR:{/red-fg} ${payload.message}`);
    }
    handleUserInput(input) {
        if (input.startsWith('/')) {
            this.handleCommand(input);
        }
        else if (input.startsWith('@')) {
            this.handleDirectMessageInput(input);
        }
        else {
            this.sendRoomMessage(input);
        }
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
                    this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /join <room> [password]');
                }
                break;
            case 'create':
                if (args.length > 0) {
                    this.createRoom(args[0], args[1], args[2]);
                }
                else {
                    this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /create <name> [type] [password]');
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
                    this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /favorite <nickname>');
                }
                break;
            case 'clear':
                this.chatBox.setContent('');
                this.screen.render();
                break;
            case 'db':
                this.handleDatabaseCommand(args);
                break;
            case 'history':
                this.showLocalHistory(args[0]);
                break;
            case 'login':
                this.handleLoginCommand(args);
                break;
            case 'kick':
                this.handleKickCommand(args);
                break;
            case 'ban':
                this.handleBanCommand(args);
                break;
            case 'promote':
                this.handlePromoteCommand(args);
                break;
            case 'demote':
                this.handleDemoteCommand(args);
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
                this.addSystemLog(`{red-fg}❌{/red-fg} Unknown command: {yellow-fg}${cmd}{/yellow-fg}`);
                this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Type /help for available commands');
        }
    }
    handleDirectMessageInput(input) {
        const match = input.match(/^@(\w+)\s+(.+)$/);
        if (match) {
            const [, targetNickname, message] = match;
            this.sendDirectMessage(targetNickname, message);
        }
        else {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: @nickname message');
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
            this.addSystemLog(`{red-fg}❌{/red-fg} User {yellow-fg}${targetNickname}{/yellow-fg} not found`);
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
        this.addSystemLog(`{magenta-fg}💬{/magenta-fg} DM sent to {yellow-fg}${targetNickname}{/yellow-fg}`);
    }
    joinRoom(roomName, password) {
        const room = Array.from(this.rooms.values()).find(r => r.name === roomName || r.id === roomName);
        if (!room) {
            this.addSystemLog(`{red-fg}❌{/red-fg} Room {cyan-fg}${roomName}{/cyan-fg} not found`);
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
        this.chatBox.setContent('');
        this.addSystemLog(`{blue-fg}🏠{/blue-fg} Joined room: {cyan-fg}${room.name}{/cyan-fg}`);
        this.updateStatus(`{green-fg}Connected{/green-fg} | Room: {cyan-fg}${room.name}{/cyan-fg}`);
        this.loadLocalHistoryForRoom(room.id);
        this.requestMessageHistory(room.id);
        this.updateRoomsList();
    }
    createRoom(name, type = 'public', password) {
        const message = {
            type: 'create_room',
            payload: {
                name,
                type,
                password,
                requiredGroup: undefined,
                maxMembers: undefined
            },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`{blue-fg}🏠{/blue-fg} Creating room: {cyan-fg}${name}{/cyan-fg} (${type})`);
    }
    leaveRoom() {
        if (this.currentRoom === 'general') {
            this.addSystemLog('{red-fg}❌{/red-fg} Cannot leave the general room');
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
        this.chatBox.setContent('');
        this.addSystemLog('{blue-fg}🏠{/blue-fg} Left room, switched to {cyan-fg}#general{/cyan-fg}');
        this.updateStatus(`{green-fg}Connected{/green-fg} | Room: {cyan-fg}general{/cyan-fg}`);
        this.loadLocalHistoryForRoom('general');
        this.requestMessageHistory('general');
        this.updateRoomsList();
    }
    toggleFavorite(nickname) {
        if (this.favorites.has(nickname)) {
            this.favorites.delete(nickname);
            this.db?.removeFavorite(nickname);
            this.addSystemLog(`{yellow-fg}⭐{/yellow-fg} Removed {yellow-fg}${nickname}{/yellow-fg} from favorites`);
        }
        else {
            this.favorites.add(nickname);
            this.db?.addFavorite(nickname);
            this.addSystemLog(`{yellow-fg}⭐{/yellow-fg} Added {yellow-fg}${nickname}{/yellow-fg} to favorites`);
        }
        this.updateUsersList();
    }
    showHelp() {
        const helpDialog = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 80,
            height: 20,
            border: {
                type: 'line',
                fg: 'cyan'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'cyan'
                }
            },
            tags: true,
            content: `{center}{cyan-fg}=== Darkline Commands ==={/cyan-fg}{/center}

{yellow-fg}/help{/yellow-fg}              - Show this help
{yellow-fg}/users{/yellow-fg}             - List online users  
{yellow-fg}/rooms{/yellow-fg}             - List available rooms
{yellow-fg}/join <room>{/yellow-fg}       - Join a room
{yellow-fg}/create <name>{/yellow-fg}     - Create a new room
{yellow-fg}/leave{/yellow-fg}             - Leave current room
{yellow-fg}/favorite <user>{/yellow-fg}   - Toggle favorite
{yellow-fg}/clear{/yellow-fg}             - Clear chat history
{yellow-fg}/history [room]{/yellow-fg}    - Show local message history
{yellow-fg}/db <cmd>{/yellow-fg}          - Database commands (info/purge/export)
{yellow-fg}/login <nick> <pass>{/yellow-fg} - Login to registered account
{yellow-fg}/kick <user>{/yellow-fg}       - Kick user from room (MOD+)
{yellow-fg}/ban <user>{/yellow-fg}        - Ban user from server (MOD+)
{yellow-fg}/promote <user>{/yellow-fg}    - Promote user (ADMIN+)
{yellow-fg}/password{/yellow-fg}          - Change password
{yellow-fg}@user message{/yellow-fg}      - Send direct message
{yellow-fg}/quit{/yellow-fg}              - Exit chat

{magenta-fg}Shortcuts:{/magenta-fg}
- {green-fg}Ctrl+S{/green-fg}: Send message
- {green-fg}Tab{/green-fg}: Switch focus between panels
- {green-fg}F1{/green-fg}: Show this help
- {green-fg}Ctrl+Q{/green-fg}: Quit application
- {green-fg}Click{/green-fg}: Interact with users/rooms

{center}Press any key to close{/center}`,
            scrollable: true
        });
        helpDialog.key(['escape', 'enter', 'q'], () => {
            this.screen.remove(helpDialog);
            this.screen.render();
        });
        this.screen.append(helpDialog);
        helpDialog.focus();
        this.screen.render();
    }
    showUsers() {
        this.addSystemLog('{cyan-fg}=== {bold}Online Users{/bold} ==={/cyan-fg}');
        const onlineUsers = Array.from(this.users.values()).filter(u => u.isOnline);
        onlineUsers.forEach(user => {
            const favoriteIcon = this.favorites.has(user.nickname) ? '{yellow-fg}⭐{/yellow-fg}' : '{green-fg}●{/green-fg}';
            const nameColor = user.nickname === this.nickname ? '{green-fg}' : '{yellow-fg}';
            this.addSystemLog(`${favoriteIcon} ${nameColor}${user.nickname}{/}`);
        });
    }
    showRooms() {
        this.addSystemLog('{cyan-fg}=== {bold}Available Rooms{/bold} ==={/cyan-fg}');
        this.rooms.forEach(room => {
            const current = room.id === this.currentRoom ? ' {green-fg}(current){/green-fg}' : '';
            const lock = room.type === 'password' ? '{red-fg}🔒{/red-fg}' : '{blue-fg}🏠{/blue-fg}';
            this.addSystemLog(`${lock} {cyan-fg}${room.name}{/cyan-fg}${current}`);
        });
    }
    updateUsersList() {
        const items = [];
        const onlineUsers = Array.from(this.users.values()).filter(u => u.isOnline);
        onlineUsers.forEach(user => {
            const favoriteIcon = this.favorites.has(user.nickname) ? '⭐' : '●';
            const nameColor = user.nickname === this.nickname ? '{green-fg}' : '{yellow-fg}';
            items.push(`${favoriteIcon} ${nameColor}${user.nickname}{/}`);
        });
        this.usersList.setItems(items);
        this.screen.render();
    }
    updateRoomsList() {
        const items = [];
        this.rooms.forEach(room => {
            const current = room.id === this.currentRoom ? ' {green-fg}(current){/green-fg}' : '';
            const lock = room.type === 'password' ? '🔒' : '🏠';
            items.push(`${lock} {cyan-fg}${room.name}{/cyan-fg}${current}`);
        });
        this.roomsList.setItems(items);
        this.screen.render();
    }
    addChatMessage(message) {
        this.chatBox.log(message);
        this.screen.render();
    }
    addSystemLog(message) {
        const timestamp = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const logEntry = `{gray-fg}[${timestamp}]{/gray-fg} ${message}`;
        this.systemBox.log(logEntry);
        this.screen.render();
    }
    updateStatus(status) {
        this.statusBar.setContent(`${status} | {yellow-fg}Press F1 for help, Ctrl+Q to quit{/yellow-fg}`);
        this.screen.render();
    }
    extractMentions(content) {
        const mentions = content.match(/@(\w+)/g);
        return mentions ? mentions.map(m => m.slice(1)) : [];
    }
    send(message) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
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
    loadLocalHistoryForRoom(roomId) {
        if (!this.db)
            return;
        const history = this.db.getMessageHistory(roomId);
        if (history.length > 0) {
            this.addSystemLog(`{gray-fg}💾 Loaded ${history.length} local messages for ${roomId}{/gray-fg}`);
            history.slice(-5).forEach(msg => {
                const timestamp = this.formatTimestamp(new Date(msg.timestamp));
                const nameColor = msg.fromNickname === this.nickname ? '{green-fg}' : '{yellow-fg}';
                const formattedMessage = `{gray-fg}[${timestamp}]{/gray-fg} ${nameColor}${msg.fromNickname}{/}: ${msg.content}`;
                this.addChatMessage(formattedMessage);
            });
        }
    }
    formatTimestamp(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (messageDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
        else if (messageDate.getTime() === yesterday.getTime()) {
            return `Ontem ${date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })}`;
        }
        else {
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
    handleAuthChallenge(payload) {
        const { challenge, message, authRequired } = payload;
        if (authRequired) {
            this.addSystemLog(`{yellow-fg}🔐 ${message}{/yellow-fg}`);
            this.addSystemLog('{gray-fg}ℹ Available commands:{/gray-fg}');
            this.addSystemLog('{yellow-fg}/login <nickname> <password>{/yellow-fg} - Login to existing account');
            return;
        }
        this.addSystemLog(`{yellow-fg}🔐 CRYPTO CHALLENGE: ${message}{/yellow-fg}`);
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
            this.addSystemLog('{yellow-fg}🔐 Sending authentication response...{/yellow-fg}');
        }
        catch (error) {
            this.addSystemLog('{red-fg}❌ Authentication failed{/red-fg}');
        }
    }
    handleAuthSuccess(payload) {
        if (!payload.group) {
            this.addSystemLog(`{green-fg}✅ ${payload.message}{/green-fg}`);
        }
        this.loadLocalHistoryForRoom(this.currentRoom);
        this.requestMessageHistory(this.currentRoom);
        this.addSystemLog('{yellow-fg}📝{/yellow-fg} Type {yellow-fg}/help{/yellow-fg} to see available commands');
    }
    getGroupColor(group) {
        switch (group.toLowerCase()) {
            case 'banned': return '{red-fg}';
            case 'guest': return '{gray-fg}';
            case 'user': return '{blue-fg}';
            case 'moderator': return '{yellow-fg}';
            case 'admin': return '{magenta-fg}';
            case 'owner': return '{green-fg}';
            default: return '';
        }
    }
    handleAuthFailed(payload) {
        this.addSystemLog(`{red-fg}❌ AUTH FAILED: ${payload.message}{/red-fg}`);
    }
    handleRegistrationSuccess(payload) {
        this.addSystemLog(`{green-fg}✓{/green-fg} ${payload.message}`);
        if (payload.group) {
            const groupColor = this.getGroupColor(payload.group);
            this.addSystemLog(`{gray-fg}🏅 Group: ${groupColor}${payload.group.toUpperCase()}{/gray-fg}`);
        }
    }
    handleRegistrationFailed(payload) {
        this.addSystemLog(`{red-fg}❌ REGISTRATION FAILED: ${payload.message}{/red-fg}`);
    }
    handleLoginSuccess(payload) {
        this.addSystemLog(`{green-fg}✓{/green-fg} ${payload.message}`);
        if (payload.group) {
            const groupColor = this.getGroupColor(payload.group);
            this.addSystemLog(`{gray-fg}🏅 Group: ${groupColor}${payload.group.toUpperCase()}{/gray-fg}`);
        }
    }
    handleLoginFailed(payload) {
        this.addSystemLog(`{red-fg}❌ LOGIN FAILED: ${payload.message}{/red-fg}`);
    }
    handlePermissionDenied(payload) {
        this.addSystemLog(`{red-fg}🚫 PERMISSION DENIED: ${payload.message}{/red-fg}`);
    }
    handleUserKicked(payload) {
        this.addSystemLog(`{red-fg}👢 KICKED from ${payload.roomId}: ${payload.reason}{/red-fg}`);
        this.addSystemLog(`{gray-fg}By: ${payload.by}{/gray-fg}`);
    }
    handleUserBanned(payload) {
        this.addSystemLog(`{red-fg}🚫 BANNED: ${payload.reason}{/red-fg}`);
        this.addSystemLog(`{gray-fg}By: ${payload.by}{/gray-fg}`);
        this.addSystemLog('{red-fg}Connection will be terminated...{/red-fg}');
    }
    handleUserPromoted(payload) {
        this.addSystemLog(`{green-fg}⬆ PROMOTED to ${payload.newGroup}{/green-fg}`);
        this.addSystemLog(`{gray-fg}By: ${payload.by}{/gray-fg}`);
    }
    handleUserDemoted(payload) {
        this.addSystemLog(`{yellow-fg}⬇ DEMOTED to ${payload.newGroup}{/yellow-fg}`);
        this.addSystemLog(`{gray-fg}By: ${payload.by}{/gray-fg}`);
    }
    async handlePasswordRequired(payload) {
        const { message, nickname } = payload;
        this.showPasswordDialog(message, (password) => {
            if (!password) {
                this.addSystemLog('{red-fg}Password is required{/red-fg}');
                return;
            }
            const loginMessage = {
                type: 'login',
                payload: { nickname, password },
                timestamp: new Date()
            };
            this.send(loginMessage);
        });
    }
    async handleCreateAccount(payload) {
        const { message, nickname } = payload;
        this.showPasswordDialog(message, (password) => {
            if (!password) {
                this.addSystemLog('{red-fg}Password is required{/red-fg}');
                return;
            }
            if (password.length < 3) {
                this.addSystemLog('{red-fg}Password must be at least 3 characters{/red-fg}');
                return;
            }
            const registerMessage = {
                type: 'register',
                payload: { nickname, password },
                timestamp: new Date()
            };
            this.send(registerMessage);
        });
    }
    showPasswordDialog(message, onSubmit) {
        const passwordDialog = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 60,
            height: 10,
            border: {
                type: 'line',
                fg: 'yellow'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'yellow'
                }
            },
            tags: true,
            content: `{center}{yellow-fg}${message}{/yellow-fg}{/center}\n\n{center}Enter password below:{/center}`
        });
        const passwordInput = blessed.textbox({
            parent: passwordDialog,
            bottom: 2,
            left: 2,
            right: 2,
            height: 1,
            inputOnFocus: true,
            keys: true,
            mouse: true,
            censor: true, // Hide password input
            border: {
                type: 'line',
                fg: 'green'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'green'
                },
                focus: {
                    border: {
                        fg: 'bright-green'
                    }
                }
            }
        });
        passwordInput.on('submit', () => {
            const password = passwordInput.value;
            this.screen.remove(passwordDialog);
            this.screen.render();
            onSubmit(password);
        });
        passwordInput.key(['escape'], () => {
            this.screen.remove(passwordDialog);
            this.screen.render();
        });
        this.screen.append(passwordDialog);
        passwordInput.focus();
        this.screen.render();
    }
    handleDatabaseCommand(args) {
        if (!this.db) {
            this.addSystemLog('{red-fg}❌{/red-fg} Database not initialized');
            return;
        }
        const subCommand = args[0]?.toLowerCase();
        switch (subCommand) {
            case 'info':
                const dbSize = this.db.getDbSize();
                const favorites = this.db.getFavorites().length;
                const rooms = this.db.getRooms().length;
                this.addSystemLog('{cyan-fg}=== {bold}Database Info{/bold} ==={/cyan-fg}');
                this.addSystemLog(`{gray-fg}💾 Path:{/gray-fg} ${this.db.getDbPath()}`);
                this.addSystemLog(`{gray-fg}📊 Size:{/gray-fg} ${dbSize} bytes`);
                this.addSystemLog(`{yellow-fg}⭐ Favorites:{/yellow-fg} ${favorites}`);
                this.addSystemLog(`{blue-fg}🏠 Rooms:{/blue-fg} ${rooms}`);
                break;
            case 'purge':
                this.db.purge();
                this.favorites.clear();
                this.addSystemLog('{red-fg}🗑{/red-fg} Database purged and reset');
                break;
            case 'export':
                const exportData = this.db.exportData();
                this.addSystemLog('{cyan-fg}=== {bold}Database Export{/bold} ==={/cyan-fg}');
                this.addSystemLog('{gray-fg}Copy the following data to backup:{/gray-fg}');
                this.addSystemLog(exportData.substring(0, 200) + '...');
                this.addSystemLog('{gray-fg}(truncated - check console for full export){/gray-fg}');
                console.log('=== FULL DATABASE EXPORT ===');
                console.log(exportData);
                console.log('=== END EXPORT ===');
                break;
            default:
                this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /db <info|purge|export>');
        }
    }
    showLocalHistory(roomName) {
        if (!this.db) {
            this.addSystemLog('{red-fg}❌{/red-fg} Database not initialized');
            return;
        }
        const roomId = roomName || this.currentRoom;
        const history = this.db.getMessageHistory(roomId);
        if (history.length === 0) {
            this.addSystemLog(`{yellow-fg}ℹ{/yellow-fg} No local history for room: ${roomId}`);
            return;
        }
        this.addSystemLog(`{cyan-fg}=== {bold}Local History - ${roomId}{/bold} ==={/cyan-fg}`);
        history.slice(-10).forEach(msg => {
            const timestamp = this.formatTimestamp(new Date(msg.timestamp));
            this.addSystemLog(`{gray-fg}[${timestamp}]{/gray-fg} {yellow-fg}${msg.fromNickname}{/yellow-fg}: ${msg.content}`);
        });
        if (history.length > 10) {
            this.addSystemLog(`{gray-fg}... and ${history.length - 10} older messages{/gray-fg}`);
        }
    }
    handleLoginCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /login <nickname> <password>');
            return;
        }
        const [nickname, password] = args;
        const message = {
            type: 'login',
            payload: { nickname, password },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog('{yellow-fg}🔐{/yellow-fg} Login attempt...');
    }
    handleKickCommand(args) {
        if (args.length < 1) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /kick <nickname> [reason]');
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
        this.addSystemLog(`{red-fg}👢{/red-fg} Kick request sent for ${targetNickname}`);
    }
    handleBanCommand(args) {
        if (args.length < 1) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /ban <nickname> [reason]');
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
        this.addSystemLog(`{red-fg}🚫{/red-fg} Ban request sent for ${targetNickname}`);
    }
    handlePromoteCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /promote <nickname> <group>');
            this.addSystemLog('{gray-fg}Groups: guest, user, moderator, admin{/gray-fg}');
            return;
        }
        const [targetNickname, newGroup] = args;
        const message = {
            type: 'promote_user',
            payload: { targetNickname, newGroup },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`{green-fg}⬆{/green-fg} Promotion request sent for ${targetNickname} to ${newGroup}`);
    }
    handleDemoteCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /demote <nickname> <group>');
            this.addSystemLog('{gray-fg}Groups: guest, user, moderator, admin{/gray-fg}');
            return;
        }
        const [targetNickname, newGroup] = args;
        const message = {
            type: 'demote_user',
            payload: { targetNickname, newGroup },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog(`{yellow-fg}⬇{/yellow-fg} Demotion request sent for ${targetNickname} to ${newGroup}`);
    }
    handlePasswordCommand(args) {
        if (args.length < 2) {
            this.addSystemLog('{yellow-fg}ℹ{/yellow-fg} Usage: /password <current> <new>');
            return;
        }
        const [currentPassword, newPassword] = args;
        const message = {
            type: 'set_password',
            payload: { currentPassword, newPassword },
            timestamp: new Date()
        };
        this.send(message);
        this.addSystemLog('{yellow-fg}🔐{/yellow-fg} Password change request sent...');
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
exports.BlessedDarklineClient = BlessedDarklineClient;
//# sourceMappingURL=blessed-client.js.map