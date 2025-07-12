export interface User {
  id: string;
  nickname: string;
  publicKey: string;
  lastSeen: Date;
  isOnline: boolean;
  isFavorite?: boolean;
  hardId?: string;
  isAuthenticated?: boolean;
  group: UserGroup;
  passwordHash?: string;
  salt?: string;
  registrationDate?: Date;
  lastLoginDate?: Date;
  loginAttempts?: number;
  isLocked?: boolean;
}

export interface Room {
  id: string;
  name: string;
  type: 'public' | 'password' | 'private' | 'p2p';
  password?: string;
  passwordHash?: string;
  salt?: string;
  members: string[];
  createdAt: Date;
  createdBy: string;
  moderators: string[];
  bannedUsers: string[];
  requiredGroup?: UserGroup;
  maxMembers?: number;
}

export interface Message {
  id: string;
  from: string;
  fromNickname?: string;
  to?: string;
  roomId?: string;
  content: string;
  encrypted: boolean;
  timestamp: Date;
  mentions: string[];
  isDelivered: boolean;
  isStored: boolean;
}

export interface EncryptedMessage {
  id: string;
  from: string;
  to?: string;
  roomId?: string;
  encryptedContent: {
    ciphertext: string;
    nonce: string;
    tag: string;
  };
  timestamp: Date;
  mentions: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  name: string;
  maxConnections: number;
  enableP2P: boolean;
  storeMessages: boolean;
  messageHistory: {
    enabled: boolean;
    maxMessages: number;
    persistToDisk: boolean;
    historyFile?: string;
  };
}

export interface ClientMessage {
  type: 'join' | 'leave' | 'message' | 'dm' | 'create_room' | 'join_room' | 'leave_room' | 'get_users' | 'get_rooms' | 'handshake' | 'get_history' | 'auth_challenge' | 'auth_response' | 'register' | 'login' | 'kick_user' | 'ban_user' | 'promote_user' | 'demote_user' | 'set_password' | 'password_response';
  payload: any;
  timestamp: Date;
}

export interface ServerMessage {
  type: 'user_joined' | 'user_left' | 'message' | 'dm' | 'room_created' | 'users_list' | 'rooms_list' | 'error' | 'handshake_response' | 'message_history' | 'auth_challenge' | 'auth_success' | 'auth_failed' | 'registration_success' | 'registration_failed' | 'login_success' | 'login_failed' | 'permission_denied' | 'user_kicked' | 'user_banned' | 'user_promoted' | 'user_demoted' | 'password_required' | 'create_account';
  payload: any;
  timestamp: Date;
}

export interface P2PConnection {
  peerId: string;
  connection: any;
  publicKey: string;
  isActive: boolean;
}

export enum UserGroup {
  BANNED = 'banned',
  GUEST = 'guest',
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  OWNER = 'owner'
}

export interface Permission {
  name: string;
  description: string;
  requiredGroup: UserGroup;
}

export const PERMISSIONS = {
  SEND_MESSAGE: { name: 'send_message', description: 'Send messages', requiredGroup: UserGroup.USER },
  SEND_DM: { name: 'send_dm', description: 'Send direct messages', requiredGroup: UserGroup.USER },
  CREATE_ROOM: { name: 'create_room', description: 'Create rooms', requiredGroup: UserGroup.USER },
  JOIN_ROOM: { name: 'join_room', description: 'Join rooms', requiredGroup: UserGroup.USER },
  KICK_USER: { name: 'kick_user', description: 'Kick users from rooms', requiredGroup: UserGroup.MODERATOR },
  BAN_USER: { name: 'ban_user', description: 'Ban users from server', requiredGroup: UserGroup.MODERATOR },
  DELETE_MESSAGE: { name: 'delete_message', description: 'Delete messages', requiredGroup: UserGroup.MODERATOR },
  PROMOTE_USER: { name: 'promote_user', description: 'Promote users', requiredGroup: UserGroup.ADMIN },
  DEMOTE_USER: { name: 'demote_user', description: 'Demote users', requiredGroup: UserGroup.ADMIN },
  SERVER_CONFIG: { name: 'server_config', description: 'Configure server settings', requiredGroup: UserGroup.ADMIN },
  MANAGE_GROUPS: { name: 'manage_groups', description: 'Manage user groups', requiredGroup: UserGroup.OWNER }
} as const;

export interface AuthCredentials {
  nickname: string;
  password: string;
  email?: string;
}