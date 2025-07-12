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
export declare enum UserGroup {
    BANNED = "banned",
    GUEST = "guest",
    USER = "user",
    MODERATOR = "moderator",
    ADMIN = "admin",
    OWNER = "owner"
}
export interface Permission {
    name: string;
    description: string;
    requiredGroup: UserGroup;
}
export declare const PERMISSIONS: {
    readonly SEND_MESSAGE: {
        readonly name: "send_message";
        readonly description: "Send messages";
        readonly requiredGroup: UserGroup.USER;
    };
    readonly SEND_DM: {
        readonly name: "send_dm";
        readonly description: "Send direct messages";
        readonly requiredGroup: UserGroup.USER;
    };
    readonly CREATE_ROOM: {
        readonly name: "create_room";
        readonly description: "Create rooms";
        readonly requiredGroup: UserGroup.USER;
    };
    readonly JOIN_ROOM: {
        readonly name: "join_room";
        readonly description: "Join rooms";
        readonly requiredGroup: UserGroup.USER;
    };
    readonly KICK_USER: {
        readonly name: "kick_user";
        readonly description: "Kick users from rooms";
        readonly requiredGroup: UserGroup.MODERATOR;
    };
    readonly BAN_USER: {
        readonly name: "ban_user";
        readonly description: "Ban users from server";
        readonly requiredGroup: UserGroup.MODERATOR;
    };
    readonly DELETE_MESSAGE: {
        readonly name: "delete_message";
        readonly description: "Delete messages";
        readonly requiredGroup: UserGroup.MODERATOR;
    };
    readonly PROMOTE_USER: {
        readonly name: "promote_user";
        readonly description: "Promote users";
        readonly requiredGroup: UserGroup.ADMIN;
    };
    readonly DEMOTE_USER: {
        readonly name: "demote_user";
        readonly description: "Demote users";
        readonly requiredGroup: UserGroup.ADMIN;
    };
    readonly SERVER_CONFIG: {
        readonly name: "server_config";
        readonly description: "Configure server settings";
        readonly requiredGroup: UserGroup.ADMIN;
    };
    readonly MANAGE_GROUPS: {
        readonly name: "manage_groups";
        readonly description: "Manage user groups";
        readonly requiredGroup: UserGroup.OWNER;
    };
};
export interface AuthCredentials {
    nickname: string;
    password: string;
    email?: string;
}
//# sourceMappingURL=index.d.ts.map