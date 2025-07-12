import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { CryptoEngine } from '../crypto/encryption';
import { User, Room, Message, ClientMessage, ServerMessage, ServerConfig, UserGroup, PERMISSIONS } from '../types';
import { AuthManager } from './auth';
import { RoomAuthManager } from './roomAuth';

export class DarklineServer {
  private wss: WebSocketServer;
  private users: Map<string, User> = new Map();
  private rooms: Map<string, Room> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private storedMessages: Map<string, Message[]> = new Map();
  private messageHistory: Map<string, Message[]> = new Map();
  private serverKeyPair = CryptoEngine.generateKeyPair();
  private hardIdRegistry: Map<string, string> = new Map();
  private pendingAuthentications: Map<string, { challenge: string; hardId: string }> = new Map();
  private authManager: AuthManager;
  private pendingRegistrations: Map<string, { nickname: string; password: string; email?: string }> = new Map();
  private pendingLogins: Map<string, { nickname: string; password: string }> = new Map();
  
  constructor(private config: ServerConfig) {
    this.wss = new WebSocketServer({ 
      port: config.port,
      host: config.host 
    });
    
    this.authManager = new AuthManager(config.name);
    this.setupDefaultRooms();
    this.loadMessageHistory();
    this.setupWebSocketHandlers();
    
    console.log(`Darkline server started on ${config.host}:${config.port}`);
    console.log(`Auth database: ${this.authManager.getDbPath()}`);
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

  private loadMessageHistory() {
    if (!this.config.messageHistory.enabled || !this.config.messageHistory.persistToDisk) {
      return;
    }

    const historyFile = this.config.messageHistory.historyFile || 'darkline-history.json';
    
    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf8');
        const historyData = JSON.parse(data);
        
        for (const [roomId, messages] of Object.entries(historyData)) {
          this.messageHistory.set(roomId, messages as Message[]);
        }
        
        console.log(`Loaded message history from ${historyFile}`);
      }
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  }

  private saveMessageHistory() {
    if (!this.config.messageHistory.enabled || !this.config.messageHistory.persistToDisk) {
      return;
    }

    const historyFile = this.config.messageHistory.historyFile || 'darkline-history.json';
    
    try {
      const historyData: Record<string, Message[]> = {};
      for (const [roomId, messages] of this.messageHistory.entries()) {
        historyData[roomId] = messages;
      }
      
      fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.error('Error saving message history:', error);
    }
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      const userId = uuidv4();
      
      ws.on('message', (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleClientMessage(ws, userId, message);
        } catch (error) {
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleUserDisconnect(userId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleUserDisconnect(userId);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, userId: string, message: ClientMessage) {
    const user = this.users.get(userId);
    console.log(`DEBUG: Received message type '${message.type}' from user ${user?.nickname || 'unknown'} (${userId})`);
    
    // Check if user needs authentication
    if (user && user.group === UserGroup.GUEST && !user.isAuthenticated) {
      // Allow basic commands for guests, but require auth for sensitive actions
      const allowedCommands = ['login', 'register', 'handshake', 'join', 'message', 'get_users', 'get_rooms', 'get_history'];
      if (!allowedCommands.includes(message.type)) {
        console.log(`DEBUG: Blocking message type '${message.type}' for unauthenticated user ${user.nickname}`);
        this.sendError(ws, 'You must login to use this command');
        return;
      }
    }
    
    switch (message.type) {
      case 'handshake':
        this.handleHandshake(ws, userId, message.payload);
        break;
      case 'join':
        this.handleUserJoin(ws, userId, message.payload);
        break;
      case 'auth_challenge':
        this.handleAuthChallenge(ws, userId, message.payload);
        break;
      case 'auth_response':
        this.handleAuthResponse(ws, userId, message.payload);
        break;
      case 'register':
        this.handleRegister(ws, userId, message.payload);
        break;
      case 'login':
        this.handleLogin(ws, userId, message.payload);
        break;
      case 'kick_user':
        this.handleKickUser(ws, userId, message.payload);
        break;
      case 'ban_user':
        this.handleBanUser(ws, userId, message.payload);
        break;
      case 'promote_user':
        this.handlePromoteUser(ws, userId, message.payload);
        break;
      case 'demote_user':
        this.handleDemoteUser(ws, userId, message.payload);
        break;
      case 'set_password':
        this.handleSetPassword(ws, userId, message.payload);
        break;
      case 'password_response':
        this.handlePasswordResponse(ws, userId, message.payload);
        break;
      case 'message':
        this.handleRoomMessage(userId, message.payload);
        break;
      case 'dm':
        this.handleDirectMessage(userId, message.payload);
        break;
      case 'create_room':
        this.handleCreateRoom(userId, message.payload);
        break;
      case 'join_room':
        this.handleJoinRoom(userId, message.payload);
        break;
      case 'leave_room':
        this.handleLeaveRoom(userId, message.payload);
        break;
      case 'get_users':
        this.handleGetUsers(ws);
        break;
      case 'get_rooms':
        this.handleGetRooms(ws);
        break;
      case 'get_history':
        this.handleGetHistory(ws, userId, message.payload);
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleHandshake(ws: WebSocket, userId: string, payload: any) {
    const response: ServerMessage = {
      type: 'handshake_response',
      payload: {
        userId,
        serverPublicKey: Buffer.from(this.serverKeyPair.publicKey).toString('hex'),
        serverName: this.config.name
      },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleUserJoin(ws: WebSocket, userId: string, payload: any) {
    const { nickname, publicKey, hardId } = payload;
    
    // Check if nickname is already taken by ANY online user
    const existingUser = Array.from(this.users.values()).find(u => 
      u.nickname === nickname && u.isOnline && u.id !== userId
    );
    
    if (existingUser) {
      this.sendError(ws, `Nickname '${nickname}' is already in use. Please choose another one.`);
      return;
    }

    // Check if nickname is registered first
    if (this.authManager.isUserRegistered(nickname)) {
      // For registered nicknames, start as GUEST and require authentication
      const user: User = {
        id: userId,
        nickname,
        publicKey,
        lastSeen: new Date(),
        isOnline: true,
        hardId,
        isAuthenticated: false,
        group: UserGroup.GUEST,
        registrationDate: new Date()
      };

      this.users.set(userId, user);
      this.connections.set(userId, ws);

      // Ask for password immediately
      const response: ServerMessage = {
        type: 'password_required',
        payload: { 
          message: `Welcome back, ${nickname}! Please enter your password:`,
          nickname 
        },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
    } else {
      // For new nicknames, start as GUEST and ask to create account
      const user: User = {
        id: userId,
        nickname,
        publicKey,
        lastSeen: new Date(),
        isOnline: true,
        hardId,
        isAuthenticated: false,
        group: UserGroup.GUEST,
        registrationDate: new Date()
      };

      this.users.set(userId, user);
      this.connections.set(userId, ws);

      // Ask to create account immediately
      const response: ServerMessage = {
        type: 'create_account',
        payload: { 
          message: `${nickname} is available! Create a password for your new account:`,
          nickname 
        },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
    }
  }

  private sendAuthRequired(ws: WebSocket, message: string) {
    const response: ServerMessage = {
      type: 'auth_challenge',
      payload: { message, authRequired: true },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private sendAuthInfo(ws: WebSocket, user: User, isAfterLogin: boolean = false) {
    let message: string;
    
    if (isAfterLogin) {
      message = `Welcome back, ${user.nickname}! You are now authenticated as ${user.group.toUpperCase()}.`;
    } else if (user.group === UserGroup.GUEST) {
      message = `Connected as ${user.group.toUpperCase()}. Use /register to create an account or /login if you have one.`;
    } else {
      message = `Connected as ${user.group.toUpperCase()}. You are authenticated and ready to chat!`;
    }
    
    const response: ServerMessage = {
      type: 'auth_success',
      payload: { 
        message,
        group: user.group,
        isGuest: user.group === UserGroup.GUEST
      },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleRoomMessage(fromUserId: string, payload: any) {
    const { roomId, content, mentions = [] } = payload;
    const room = this.rooms.get(roomId);
    const fromUser = this.users.get(fromUserId);

    if (!room || !fromUser || !room.members.includes(fromUserId)) {
      return;
    }

    // Check if user has permission to send messages
    if (!this.authManager.hasPermission(fromUser.nickname, 'send_message')) {
      this.sendPermissionDenied(this.connections.get(fromUserId)!, 'You do not have permission to send messages');
      return;
    }

    // Check if user is banned from the room
    if (RoomAuthManager.isUserBannedFromRoom(room, fromUserId)) {
      this.sendPermissionDenied(this.connections.get(fromUserId)!, 'You are banned from this room');
      return;
    }

    const message: Message = {
      id: uuidv4(),
      from: fromUserId,
      fromNickname: fromUser.nickname,
      roomId,
      content,
      encrypted: false,
      timestamp: new Date(),
      mentions,
      isDelivered: true,
      isStored: false
    };

    // Store message if enabled
    if (this.config.storeMessages) {
      if (!this.storedMessages.has(roomId)) {
        this.storedMessages.set(roomId, []);
      }
      this.storedMessages.get(roomId)!.push(message);
    }

    // Add to history if enabled
    if (this.config.messageHistory.enabled) {
      this.addToHistory(roomId, message);
    }

    // Broadcast to room members
    this.broadcastToRoom(roomId, {
      type: 'message',
      payload: {
        message: {
          ...message,
          fromNickname: fromUser.nickname
        }
      },
      timestamp: new Date()
    });

    // Handle mentions
    this.handleMentions(mentions, message, fromUser);
  }

  private handleDirectMessage(fromUserId: string, payload: any) {
    const { to, content } = payload;
    const fromUser = this.users.get(fromUserId);
    const toUser = this.users.get(to);

    if (!fromUser || !toUser) {
      return;
    }

    // Check if user has permission to send DMs
    if (!this.authManager.hasPermission(fromUser.nickname, 'send_dm')) {
      this.sendPermissionDenied(this.connections.get(fromUserId)!, 'You do not have permission to send direct messages');
      return;
    }

    const message: Message = {
      id: uuidv4(),
      from: fromUserId,
      fromNickname: fromUser.nickname,
      to,
      content,
      encrypted: true,
      timestamp: new Date(),
      mentions: [],
      isDelivered: toUser.isOnline,
      isStored: !toUser.isOnline
    };

    // Store message for offline user
    if (!toUser.isOnline && this.config.storeMessages) {
      if (!this.storedMessages.has(to)) {
        this.storedMessages.set(to, []);
      }
      this.storedMessages.get(to)!.push(message);
    }

    // Send to recipient if online
    if (toUser.isOnline) {
      const connection = this.connections.get(to);
      if (connection) {
        const response: ServerMessage = {
          type: 'dm',
          payload: {
            message: {
              ...message,
              fromNickname: fromUser.nickname
            }
          },
          timestamp: new Date()
        };
        connection.send(JSON.stringify(response));
      }
    }
  }

  private handleCreateRoom(userId: string, payload: any) {
    const { name, type, password, requiredGroup, maxMembers } = payload;
    const user = this.users.get(userId);

    if (!user) return;

    // Check if user has permission to create rooms
    if (!this.authManager.hasPermission(user.nickname, 'create_room')) {
      this.sendPermissionDenied(this.connections.get(userId)!, 'You do not have permission to create rooms');
      return;
    }

    // Validate room settings
    const settings = { name, type, maxMembers };
    const validation = RoomAuthManager.validateRoomSettings(settings);
    if (!validation.valid) {
      this.sendError(this.connections.get(userId)!, validation.errors.join(', '));
      return;
    }

    let roomPasswordHash, roomSalt;
    if (type === 'password' && password) {
      const hashResult = RoomAuthManager.hashRoomPassword(password);
      roomPasswordHash = hashResult.hash;
      roomSalt = hashResult.salt;
    }

    const room: Room = {
      id: uuidv4(),
      name: name.startsWith('#') ? name : `#${name}`,
      type,
      passwordHash: roomPasswordHash,
      salt: roomSalt,
      members: [userId],
      createdAt: new Date(),
      createdBy: userId,
      moderators: [userId], // Creator is automatically a moderator
      bannedUsers: [],
      requiredGroup,
      maxMembers
    };

    this.rooms.set(room.id, room);

    const response: ServerMessage = {
      type: 'room_created',
      payload: { room: { ...room, passwordHash: undefined, salt: undefined } }, // Don't send hash to client
      timestamp: new Date()
    };

    // Notify creator
    const connection = this.connections.get(userId);
    if (connection) {
      connection.send(JSON.stringify(response));
    }

    // Broadcast new room to all users for public rooms
    if (type === 'public') {
      this.broadcast(response, userId);
    }
  }

  private handleJoinRoom(userId: string, payload: any) {
    const { roomId, password } = payload;
    const room = this.rooms.get(roomId);
    const user = this.users.get(userId);

    if (!room || !user) return;

    // Check if user has permission to join rooms
    if (!this.authManager.hasPermission(user.nickname, 'join_room')) {
      this.sendPermissionDenied(this.connections.get(userId)!, 'You do not have permission to join rooms');
      return;
    }

    // Check room access permissions
    const accessCheck = RoomAuthManager.canUserJoinRoom(room, user.group, password);
    if (!accessCheck.allowed) {
      const connection = this.connections.get(userId);
      if (connection) {
        this.sendError(connection, accessCheck.reason || 'Cannot join room');
      }
      return;
    }

    // Add user to room
    if (!room.members.includes(userId)) {
      room.members.push(userId);
    }

    // Notify room members
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      payload: { user, roomId },
      timestamp: new Date()
    }, userId);
  }

  private handleLeaveRoom(userId: string, payload: any) {
    const { roomId } = payload;
    const room = this.rooms.get(roomId);

    if (!room) return;

    // Remove user from room
    room.members = room.members.filter(id => id !== userId);

    // Notify remaining members
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      payload: { userId, roomId },
      timestamp: new Date()
    });
  }

  private handleGetUsers(ws: WebSocket) {
    const users = Array.from(this.users.values()).filter(user => user.isOnline);
    const response: ServerMessage = {
      type: 'users_list',
      payload: { users },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleGetRooms(ws: WebSocket) {
    const publicRooms = Array.from(this.rooms.values()).filter(room => room.type === 'public');
    const response: ServerMessage = {
      type: 'rooms_list',
      payload: { rooms: publicRooms },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleGetHistory(ws: WebSocket, userId: string, payload: any) {
    if (!this.config.messageHistory.enabled) {
      this.sendError(ws, 'Message history is disabled on this server');
      return;
    }

    const { roomId, limit = 50 } = payload;
    const user = this.users.get(userId);
    const room = this.rooms.get(roomId);

    if (!user || !room || !room.members.includes(userId)) {
      this.sendError(ws, 'Access denied or room not found');
      return;
    }

    this.sendRoomHistory(ws, roomId, limit);
  }

  private addToHistory(roomId: string, message: Message) {
    if (!this.messageHistory.has(roomId)) {
      this.messageHistory.set(roomId, []);
    }

    const history = this.messageHistory.get(roomId)!;
    history.push(message);

    // Limit history size
    const maxMessages = this.config.messageHistory.maxMessages;
    if (history.length > maxMessages) {
      history.splice(0, history.length - maxMessages);
    }

    // Save to disk periodically
    if (this.config.messageHistory.persistToDisk) {
      this.saveMessageHistory();
    }
  }

  private sendRoomHistory(ws: WebSocket, roomId: string, limit: number = 50) {
    const history = this.messageHistory.get(roomId) || [];
    const recentMessages = history.slice(-limit);

    const response: ServerMessage = {
      type: 'message_history',
      payload: {
        roomId,
        messages: recentMessages.map(msg => ({
          ...msg,
          fromNickname: msg.fromNickname || this.users.get(msg.from)?.nickname || 'Unknown'
        }))
      },
      timestamp: new Date()
    };

    ws.send(JSON.stringify(response));
  }

  private handleMentions(mentions: string[], message: Message, fromUser: User) {
    mentions.forEach(nickname => {
      const mentionedUser = Array.from(this.users.values()).find(u => u.nickname === nickname);
      if (mentionedUser && mentionedUser.isOnline) {
        const connection = this.connections.get(mentionedUser.id);
        if (connection) {
          const notification: ServerMessage = {
            type: 'message',
            payload: {
              message: {
                ...message,
                fromNickname: fromUser.nickname,
                isMention: true
              }
            },
            timestamp: new Date()
          };
          connection.send(JSON.stringify(notification));
        }
      }
    });
  }

  private deliverStoredMessages(userId: string) {
    const messages = this.storedMessages.get(userId);
    if (messages && messages.length > 0) {
      const connection = this.connections.get(userId);
      if (connection) {
        messages.forEach(message => {
          const response: ServerMessage = {
            type: message.roomId ? 'message' : 'dm',
            payload: { message },
            timestamp: new Date()
          };
          connection.send(JSON.stringify(response));
        });
        // Clear delivered messages
        this.storedMessages.delete(userId);
      }
    }
  }

  private broadcastToRoom(roomId: string, message: ServerMessage, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.members.forEach(memberId => {
      if (memberId !== excludeUserId) {
        const connection = this.connections.get(memberId);
        if (connection) {
          connection.send(JSON.stringify(message));
        }
      }
    });
  }

  private broadcast(message: ServerMessage, excludeUserId?: string) {
    this.connections.forEach((connection, userId) => {
      if (userId !== excludeUserId) {
        connection.send(JSON.stringify(message));
      }
    });
  }

  private sendError(ws: WebSocket, errorMessage: string) {
    const error: ServerMessage = {
      type: 'error',
      payload: { message: errorMessage },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(error));
  }

  private startAuthentication(ws: WebSocket, userId: string, hardId: string, nickname?: string) {
    const challenge = this.generateChallenge();
    this.pendingAuthentications.set(userId, { challenge, hardId });
    
    const message = nickname 
      ? `This nickname '${nickname}' is protected. Please authenticate to use it.`
      : 'This Hard ID is already registered. Please provide authentication.';
    
    const response: ServerMessage = {
      type: 'auth_challenge',
      payload: { challenge, message },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleAuthChallenge(ws: WebSocket, userId: string, payload: any) {
    const { hardId, nickname, checkOnly } = payload;
    
    // Handle nickname check for initial auth flow
    if (checkOnly && nickname) {
      this.handleNicknameCheck(ws, userId, nickname);
      return;
    }
    
    // Handle legacy hardId authentication
    if (hardId) {
      const registeredUserId = this.hardIdRegistry.get(hardId);
      if (registeredUserId) {
        this.startAuthentication(ws, userId, hardId);
      } else {
        this.sendError(ws, 'Hard ID not found');
      }
    }
  }

  private handleNicknameCheck(ws: WebSocket, userId: string, nickname: string) {
    console.log(`DEBUG: Checking nickname '${nickname}' for user ${userId}`);
    // Check if nickname is registered
    if (this.authManager.isUserRegistered(nickname)) {
      console.log(`DEBUG: Nickname '${nickname}' is registered, asking for password`);
      // Ask for password
      const response: ServerMessage = {
        type: 'password_required',
        payload: { 
          message: `Welcome back, ${nickname}! Please enter your password:`,
          nickname 
        },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
    } else {
      console.log(`DEBUG: Nickname '${nickname}' is available, asking to create account`);
      // Ask to create account
      const response: ServerMessage = {
        type: 'create_account',
        payload: { 
          message: `${nickname} is available! Create a password for your new account:`,
          nickname 
        },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
    }
  }

  private handleAuthResponse(ws: WebSocket, userId: string, payload: any) {
    const { challengeResponse } = payload;
    const pendingAuth = this.pendingAuthentications.get(userId);
    
    if (!pendingAuth) {
      this.sendError(ws, 'No pending authentication');
      return;
    }
    
    // Verify the challenge response using cryptographic signature
    const user = this.users.get(userId);
    if (!user) {
      this.sendError(ws, 'User not found');
      return;
    }
    
    try {
      const isValid = CryptoEngine.verifySignature(
        Buffer.from(pendingAuth.challenge, 'hex'),
        Buffer.from(challengeResponse, 'hex'),
        Buffer.from(user.publicKey, 'hex')
      );
      
      if (isValid) {
        // Authentication successful
        user.isAuthenticated = true;
        user.hardId = pendingAuth.hardId;
        this.hardIdRegistry.set(pendingAuth.hardId, userId);
        this.pendingAuthentications.delete(userId);
        
        const response: ServerMessage = {
          type: 'auth_success',
          payload: { message: 'Authentication successful! You now own this nickname.' },
          timestamp: new Date()
        };
        ws.send(JSON.stringify(response));
        
        // Continue with normal join process
        this.completeUserJoin(ws, userId);
      } else {
        this.sendError(ws, 'Authentication failed');
        this.pendingAuthentications.delete(userId);
      }
    } catch (error) {
      this.sendError(ws, 'Authentication error');
      this.pendingAuthentications.delete(userId);
    }
  }

  private generateChallenge(): string {
    return Buffer.from(CryptoEngine.generateKeyPair().publicKey).toString('hex').substring(0, 32);
  }

  private completeUserJoin(ws: WebSocket, userId: string, isAfterLogin: boolean = false) {
    const user = this.users.get(userId);
    if (!user) return;
    
    // Join general room by default
    const generalRoom = this.rooms.get('general')!;
    if (!generalRoom.members.includes(userId)) {
      generalRoom.members.push(userId);
    }

    // Send welcome message with authentication info
    this.sendAuthInfo(ws, user, isAfterLogin);

    // Deliver stored messages if any
    this.deliverStoredMessages(userId);

    // Send recent history for general room if enabled
    if (this.config.messageHistory.enabled) {
      this.sendRoomHistory(ws, 'general');
    }

    // Notify other users
    this.broadcastToRoom('general', {
      type: 'user_joined',
      payload: { user: { ...user, passwordHash: undefined, salt: undefined } },
      timestamp: new Date()
    }, userId);

    // Send current room state to new user
    const response: ServerMessage = {
      type: 'users_list',
      payload: {
        room: 'general',
        users: generalRoom.members.map(id => this.users.get(id)).filter(Boolean).map(u => ({ ...u, passwordHash: undefined, salt: undefined }))
      },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handleRegister(ws: WebSocket, userId: string, payload: any) {
    const { nickname, password } = payload;
    const user = this.users.get(userId);
    
    // Check if user is trying to register a different nickname than the one they connected with
    if (!user || user.nickname !== nickname) {
      this.sendError(ws, 'Invalid registration attempt');
      return;
    }
    
    // Check if user is already authenticated
    if (user.isAuthenticated) {
      this.sendError(ws, 'You are already logged in');
      return;
    }
    
    const result = this.authManager.register({ nickname, password });
    
    if (result.success) {
      // Update user status for newly registered user
      user.isAuthenticated = true;
      user.group = result.group!;
      user.registrationDate = new Date();
      
      const response: ServerMessage = {
        type: 'registration_success',
        payload: { message: `Account created successfully! Welcome to the chat, ${nickname}!`, group: result.group },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
      
      // Complete the join process for newly registered user
      this.completeUserJoin(ws, userId, true);
    } else {
      const response: ServerMessage = {
        type: 'registration_failed',
        payload: { message: result.message },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
      
      // Ask to create account again after failed registration
      setTimeout(() => {
        const retryResponse: ServerMessage = {
          type: 'create_account',
          payload: { 
            message: `Please try again. Create a password for your account:`,
            nickname 
          },
          timestamp: new Date()
        };
        ws.send(JSON.stringify(retryResponse));
      }, 1000);
    }
  }

  private handleLogin(ws: WebSocket, userId: string, payload: any) {
    const { nickname, password } = payload;
    const user = this.users.get(userId);
    
    console.log(`DEBUG: Login attempt for ${nickname}`);
    
    // Verify the user is trying to login with their own nickname
    if (!user || user.nickname !== nickname) {
      console.log(`DEBUG: Invalid login attempt - user exists: ${!!user}, nickname match: ${user?.nickname === nickname}`);
      this.sendError(ws, 'Invalid login attempt');
      return;
    }
    
    const result = this.authManager.login({ nickname, password });
    console.log(`DEBUG: Login result for ${nickname}: success=${result.success}`);
    
    if (result.success && result.user) {
      // Update user object with logged in status
      user.isAuthenticated = true;
      user.group = result.user.group;
      user.registrationDate = new Date(result.user.registrationDate);
      user.lastLoginDate = new Date();
      
      console.log(`DEBUG: User ${nickname} logged in successfully - group: ${user.group}, authenticated: ${user.isAuthenticated}`);
      
      // Send login success message
      const response: ServerMessage = {
        type: 'login_success',
        payload: { message: `Login successful! Welcome back, ${nickname}!`, group: result.user.group },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
      
      // Complete the join process now that they're authenticated
      this.completeUserJoin(ws, userId, true);
    } else {
      const response: ServerMessage = {
        type: 'login_failed',
        payload: { message: result.message },
        timestamp: new Date()
      };
      ws.send(JSON.stringify(response));
      
      // Ask for password again after failed login
      setTimeout(() => {
        const retryResponse: ServerMessage = {
          type: 'password_required',
          payload: { 
            message: `Please try again. Enter your password:`,
            nickname 
          },
          timestamp: new Date()
        };
        ws.send(JSON.stringify(retryResponse));
      }, 1000);
    }
  }

  private handleKickUser(ws: WebSocket, userId: string, payload: any) {
    const { targetNickname, roomId, reason } = payload;
    const adminUser = this.users.get(userId);
    const room = this.rooms.get(roomId);
    
    if (!adminUser || !room) {
      this.sendError(ws, 'Invalid request');
      return;
    }

    // Check permissions
    const permissionCheck = RoomAuthManager.canUserPerformRoomAction(room, userId, adminUser.group, 'kick');
    if (!permissionCheck.allowed) {
      this.sendPermissionDenied(ws, permissionCheck.reason || 'Insufficient permissions');
      return;
    }

    // Find target user
    const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
    if (!targetUser) {
      this.sendError(ws, 'User not found');
      return;
    }

    // Remove from room
    room.members = room.members.filter(id => id !== targetUser.id);
    
    // Notify target user
    const targetConnection = this.connections.get(targetUser.id);
    if (targetConnection) {
      const kickResponse: ServerMessage = {
        type: 'user_kicked',
        payload: { roomId, reason: reason || 'No reason provided', by: adminUser.nickname },
        timestamp: new Date()
      };
      targetConnection.send(JSON.stringify(kickResponse));
    }

    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      payload: { userId: targetUser.id, roomId, reason: `Kicked by ${adminUser.nickname}` },
      timestamp: new Date()
    });
  }

  private handleBanUser(ws: WebSocket, userId: string, payload: any) {
    const { targetNickname, reason } = payload;
    const adminUser = this.users.get(userId);
    
    if (!adminUser) {
      this.sendError(ws, 'Invalid request');
      return;
    }

    // Check if admin has ban permissions
    if (!this.authManager.hasPermission(adminUser.nickname, 'ban_user')) {
      this.sendPermissionDenied(ws, 'You do not have permission to ban users');
      return;
    }

    // Promote/demote user in auth system
    const result = this.authManager.demoteUser(adminUser.nickname, targetNickname, UserGroup.BANNED);
    
    if (result.success) {
      // Find and disconnect target user
      const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
      if (targetUser) {
        targetUser.group = UserGroup.BANNED;
        
        // Remove from all rooms
        this.rooms.forEach(room => {
          if (room.members.includes(targetUser.id)) {
            room.members = room.members.filter(id => id !== targetUser.id);
            this.broadcastToRoom(room.id, {
              type: 'user_left',
              payload: { userId: targetUser.id, roomId: room.id, reason: `Banned by ${adminUser.nickname}` },
              timestamp: new Date()
            });
          }
        });

        // Notify target user
        const targetConnection = this.connections.get(targetUser.id);
        if (targetConnection) {
          const banResponse: ServerMessage = {
            type: 'user_banned',
            payload: { reason: reason || 'No reason provided', by: adminUser.nickname },
            timestamp: new Date()
          };
          targetConnection.send(JSON.stringify(banResponse));
          targetConnection.close();
        }
      }
      
      this.sendSuccess(ws, `User ${targetNickname} has been banned`);
    } else {
      this.sendError(ws, result.message);
    }
  }

  private handlePromoteUser(ws: WebSocket, userId: string, payload: any) {
    const { targetNickname, newGroup } = payload;
    const adminUser = this.users.get(userId);
    
    if (!adminUser) {
      this.sendError(ws, 'Invalid request');
      return;
    }

    const result = this.authManager.promoteUser(adminUser.nickname, targetNickname, newGroup);
    
    if (result.success) {
      // Update user object if online
      const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
      if (targetUser) {
        targetUser.group = newGroup;
        
        // Notify target user
        const targetConnection = this.connections.get(targetUser.id);
        if (targetConnection) {
          const promoteResponse: ServerMessage = {
            type: 'user_promoted',
            payload: { newGroup, by: adminUser.nickname },
            timestamp: new Date()
          };
          targetConnection.send(JSON.stringify(promoteResponse));
        }
      }
      
      this.sendSuccess(ws, result.message);
    } else {
      this.sendError(ws, result.message);
    }
  }

  private handleDemoteUser(ws: WebSocket, userId: string, payload: any) {
    const { targetNickname, newGroup } = payload;
    const adminUser = this.users.get(userId);
    
    if (!adminUser) {
      this.sendError(ws, 'Invalid request');
      return;
    }

    const result = this.authManager.demoteUser(adminUser.nickname, targetNickname, newGroup);
    
    if (result.success) {
      // Update user object if online
      const targetUser = Array.from(this.users.values()).find(u => u.nickname === targetNickname);
      if (targetUser) {
        targetUser.group = newGroup;
        
        // Notify target user
        const targetConnection = this.connections.get(targetUser.id);
        if (targetConnection) {
          const demoteResponse: ServerMessage = {
            type: 'user_demoted',
            payload: { newGroup, by: adminUser.nickname },
            timestamp: new Date()
          };
          targetConnection.send(JSON.stringify(demoteResponse));
        }
      }
      
      this.sendSuccess(ws, result.message);
    } else {
      this.sendError(ws, result.message);
    }
  }

  private handleSetPassword(ws: WebSocket, userId: string, payload: any) {
    const { currentPassword, newPassword } = payload;
    const user = this.users.get(userId);
    
    if (!user) {
      this.sendError(ws, 'Invalid request');
      return;
    }

    const result = this.authManager.changePassword(user.nickname, currentPassword, newPassword);
    
    if (result.success) {
      this.sendSuccess(ws, result.message);
    } else {
      this.sendError(ws, result.message);
    }
  }

  private sendPermissionDenied(ws: WebSocket, message: string) {
    const response: ServerMessage = {
      type: 'permission_denied',
      payload: { message },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private sendSuccess(ws: WebSocket, message: string) {
    const response: ServerMessage = {
      type: 'auth_success',
      payload: { message },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(response));
  }

  private handlePasswordResponse(ws: WebSocket, userId: string, payload: any) {
    const { nickname, password, isLogin } = payload;
    
    if (isLogin) {
      this.handleLogin(ws, userId, { nickname, password });
    } else {
      this.handleRegister(ws, userId, { nickname, password });
    }
  }

  private handleUserDisconnect(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      
      // Remove from all rooms
      this.rooms.forEach(room => {
        if (room.members.includes(userId)) {
          room.members = room.members.filter(id => id !== userId);
          this.broadcastToRoom(room.id, {
            type: 'user_left',
            payload: { userId, roomId: room.id },
            timestamp: new Date()
          });
        }
      });
    }
    
    this.connections.delete(userId);
    this.pendingAuthentications.delete(userId);
    this.pendingRegistrations.delete(userId);
    this.pendingLogins.delete(userId);
  }
}