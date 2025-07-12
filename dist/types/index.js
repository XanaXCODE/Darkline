"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.UserGroup = void 0;
var UserGroup;
(function (UserGroup) {
    UserGroup["BANNED"] = "banned";
    UserGroup["GUEST"] = "guest";
    UserGroup["USER"] = "user";
    UserGroup["MODERATOR"] = "moderator";
    UserGroup["ADMIN"] = "admin";
    UserGroup["OWNER"] = "owner";
})(UserGroup || (exports.UserGroup = UserGroup = {}));
exports.PERMISSIONS = {
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
};
//# sourceMappingURL=index.js.map