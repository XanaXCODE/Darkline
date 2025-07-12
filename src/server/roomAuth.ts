import * as crypto from 'crypto';
import { Room, UserGroup } from '../types';

export class RoomAuthManager {
  
  static hashRoomPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 5000, 32, 'sha256').toString('hex');
    return { hash, salt: actualSalt };
  }

  static verifyRoomPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 5000, 32, 'sha256').toString('hex');
    return hash === verifyHash;
  }

  static canUserJoinRoom(room: Room, userGroup: UserGroup, password?: string): { allowed: boolean; reason?: string } {
    // Check if user group is high enough
    if (room.requiredGroup) {
      const groupLevels = {
        [UserGroup.BANNED]: -1,
        [UserGroup.GUEST]: 0,
        [UserGroup.USER]: 1,
        [UserGroup.MODERATOR]: 2,
        [UserGroup.ADMIN]: 3,
        [UserGroup.OWNER]: 4
      };

      const userLevel = groupLevels[userGroup] || 0;
      const requiredLevel = groupLevels[room.requiredGroup] || 0;

      if (userLevel < requiredLevel) {
        return { 
          allowed: false, 
          reason: `This room requires ${room.requiredGroup} permissions or higher` 
        };
      }
    }

    // Check if room is at capacity
    if (room.maxMembers && room.members.length >= room.maxMembers) {
      return { 
        allowed: false, 
        reason: 'Room is at maximum capacity' 
      };
    }

    // Check password for password-protected rooms
    if (room.type === 'password' && room.passwordHash && room.salt) {
      if (!password) {
        return { 
          allowed: false, 
          reason: 'This room requires a password' 
        };
      }

      if (!this.verifyRoomPassword(password, room.passwordHash, room.salt)) {
        return { 
          allowed: false, 
          reason: 'Incorrect room password' 
        };
      }
    }

    return { allowed: true };
  }

  static canUserPerformRoomAction(
    room: Room, 
    userId: string, 
    userGroup: UserGroup, 
    action: 'kick' | 'ban' | 'promote_moderator' | 'delete_message' | 'change_settings'
  ): { allowed: boolean; reason?: string } {
    
    // Room creator has all permissions
    if (room.createdBy === userId) {
      return { allowed: true };
    }

    // Check if user is room moderator
    const isRoomModerator = room.moderators.includes(userId);
    
    // Check global permissions based on user group
    const groupLevels = {
      [UserGroup.BANNED]: -1,
      [UserGroup.GUEST]: 0,
      [UserGroup.USER]: 1,
      [UserGroup.MODERATOR]: 2,
      [UserGroup.ADMIN]: 3,
      [UserGroup.OWNER]: 4
    };

    const userLevel = groupLevels[userGroup] || 0;

    switch (action) {
      case 'kick':
        if (userLevel >= 2 || isRoomModerator) { // Moderator+ or room mod
          return { allowed: true };
        }
        return { allowed: false, reason: 'Insufficient permissions to kick users' };

      case 'ban':
        if (userLevel >= 2) { // Global moderator+
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only global moderators can ban users' };

      case 'promote_moderator':
        if (userLevel >= 3 || room.createdBy === userId) { // Admin+ or room creator
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only admins can promote room moderators' };

      case 'delete_message':
        if (userLevel >= 2 || isRoomModerator) { // Moderator+ or room mod
          return { allowed: true };
        }
        return { allowed: false, reason: 'Insufficient permissions to delete messages' };

      case 'change_settings':
        if (userLevel >= 3 || room.createdBy === userId) { // Admin+ or room creator
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only admins can change room settings' };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  static isUserBannedFromRoom(room: Room, userId: string): boolean {
    return room.bannedUsers.includes(userId);
  }

  static addRoomModerator(room: Room, userId: string): void {
    if (!room.moderators.includes(userId)) {
      room.moderators.push(userId);
    }
  }

  static removeRoomModerator(room: Room, userId: string): void {
    room.moderators = room.moderators.filter(id => id !== userId);
  }

  static banUserFromRoom(room: Room, userId: string): void {
    // Remove from members and moderators
    room.members = room.members.filter(id => id !== userId);
    room.moderators = room.moderators.filter(id => id !== userId);
    
    // Add to banned list
    if (!room.bannedUsers.includes(userId)) {
      room.bannedUsers.push(userId);
    }
  }

  static unbanUserFromRoom(room: Room, userId: string): void {
    room.bannedUsers = room.bannedUsers.filter(id => id !== userId);
  }

  static validateRoomSettings(settings: Partial<Room>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.name && (settings.name.length < 1 || settings.name.length > 50)) {
      errors.push('Room name must be 1-50 characters');
    }

    if (settings.name && !/^[a-zA-Z0-9_\-\s]+$/.test(settings.name)) {
      errors.push('Room name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    if (settings.maxMembers && (settings.maxMembers < 2 || settings.maxMembers > 1000)) {
      errors.push('Maximum members must be between 2 and 1000');
    }

    if (settings.type && !['public', 'password', 'private', 'p2p'].includes(settings.type)) {
      errors.push('Invalid room type');
    }

    return { valid: errors.length === 0, errors };
  }
}