import { Room, UserGroup } from '../types';
export declare class RoomAuthManager {
    static hashRoomPassword(password: string, salt?: string): {
        hash: string;
        salt: string;
    };
    static verifyRoomPassword(password: string, hash: string, salt: string): boolean;
    static canUserJoinRoom(room: Room, userGroup: UserGroup, password?: string): {
        allowed: boolean;
        reason?: string;
    };
    static canUserPerformRoomAction(room: Room, userId: string, userGroup: UserGroup, action: 'kick' | 'ban' | 'promote_moderator' | 'delete_message' | 'change_settings'): {
        allowed: boolean;
        reason?: string;
    };
    static isUserBannedFromRoom(room: Room, userId: string): boolean;
    static addRoomModerator(room: Room, userId: string): void;
    static removeRoomModerator(room: Room, userId: string): void;
    static banUserFromRoom(room: Room, userId: string): void;
    static unbanUserFromRoom(room: Room, userId: string): void;
    static validateRoomSettings(settings: Partial<Room>): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=roomAuth.d.ts.map