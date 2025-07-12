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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
class AuthManager {
    constructor(serverName = 'default') {
        this.users = {};
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
        // Create server directory
        const serverDir = path.join(process.cwd(), '.darkline-server');
        if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir, { recursive: true });
        }
        this.dbPath = path.join(serverDir, `users-${serverName}.json`);
        this.loadUsers();
        this.createDefaultAdmin();
    }
    loadUsers() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf8');
                this.users = JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Failed to load user database:', error);
            this.users = {};
        }
    }
    saveUsers() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.users, null, 2));
        }
        catch (error) {
            console.error('Failed to save user database:', error);
        }
    }
    createDefaultAdmin() {
        if (!this.users['admin']) {
            const { hash, salt } = this.hashPassword('admin123');
            this.users['admin'] = {
                passwordHash: hash,
                salt,
                group: types_1.UserGroup.OWNER,
                registrationDate: new Date().toISOString(),
                loginAttempts: 0,
                isLocked: false
            };
            this.saveUsers();
            console.log('🔐 Default admin account created: admin/admin123');
        }
    }
    hashPassword(password, salt) {
        const actualSalt = salt || crypto.randomBytes(32).toString('hex');
        const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
        return { hash, salt: actualSalt };
    }
    verifyPassword(password, hash, salt) {
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
    }
    register(credentials) {
        const { nickname, password } = credentials;
        // Validate input
        if (!nickname || !password) {
            return { success: false, message: 'Nickname and password are required' };
        }
        if (nickname.length < 3 || nickname.length > 20) {
            return { success: false, message: 'Nickname must be 3-20 characters' };
        }
        if (password.length < 3) {
            return { success: false, message: 'Password must be at least 3 characters' };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
            return { success: false, message: 'Nickname can only contain letters, numbers, and underscores' };
        }
        // Check if user already exists
        if (this.users[nickname]) {
            return { success: false, message: 'Nickname already exists' };
        }
        // Create user
        const { hash, salt } = this.hashPassword(password);
        this.users[nickname] = {
            passwordHash: hash,
            salt,
            group: types_1.UserGroup.USER,
            registrationDate: new Date().toISOString(),
            loginAttempts: 0,
            isLocked: false
        };
        this.saveUsers();
        return {
            success: true,
            message: 'Account created successfully',
            group: types_1.UserGroup.USER
        };
    }
    login(credentials) {
        const { nickname, password } = credentials;
        if (!nickname || !password) {
            return { success: false, message: 'Nickname and password are required' };
        }
        const user = this.users[nickname];
        if (!user) {
            return { success: false, message: 'Invalid credentials' };
        }
        // Check if account is locked
        if (user.isLocked) {
            return { success: false, message: 'Account is locked due to too many failed attempts' };
        }
        // Verify password
        if (!this.verifyPassword(password, user.passwordHash, user.salt)) {
            user.loginAttempts++;
            if (user.loginAttempts >= this.maxLoginAttempts) {
                user.isLocked = true;
                this.saveUsers();
                // Unlock after lockout duration
                setTimeout(() => {
                    user.isLocked = false;
                    user.loginAttempts = 0;
                    this.saveUsers();
                }, this.lockoutDuration);
                return { success: false, message: 'Account locked due to too many failed attempts' };
            }
            this.saveUsers();
            const remaining = this.maxLoginAttempts - user.loginAttempts;
            return { success: false, message: `Invalid credentials. ${remaining} attempts remaining.` };
        }
        // Successful login
        user.loginAttempts = 0;
        user.lastLoginDate = new Date().toISOString();
        this.saveUsers();
        return { success: true, message: 'Login successful', user };
    }
    hasPermission(nickname, permission) {
        const user = this.users[nickname];
        if (!user)
            return false;
        const perm = Object.values(types_1.PERMISSIONS).find(p => p.name === permission);
        if (!perm)
            return false;
        return this.getGroupLevel(user.group) >= this.getGroupLevel(perm.requiredGroup);
    }
    getGroupLevel(group) {
        const levels = {
            [types_1.UserGroup.BANNED]: -1,
            [types_1.UserGroup.GUEST]: 0,
            [types_1.UserGroup.USER]: 1,
            [types_1.UserGroup.MODERATOR]: 2,
            [types_1.UserGroup.ADMIN]: 3,
            [types_1.UserGroup.OWNER]: 4
        };
        return levels[group] || 0;
    }
    promoteUser(adminNickname, targetNickname, newGroup) {
        const admin = this.users[adminNickname];
        const target = this.users[targetNickname];
        if (!admin || !target) {
            return { success: false, message: 'User not found' };
        }
        // Check permissions
        if (!this.hasPermission(adminNickname, 'promote_user')) {
            return { success: false, message: 'Insufficient permissions' };
        }
        // Can't promote to same or higher level than yourself
        if (this.getGroupLevel(newGroup) >= this.getGroupLevel(admin.group)) {
            return { success: false, message: 'Cannot promote to same or higher level' };
        }
        // Can't promote someone higher than yourself
        if (this.getGroupLevel(target.group) >= this.getGroupLevel(admin.group)) {
            return { success: false, message: 'Cannot promote someone with same or higher privileges' };
        }
        target.group = newGroup;
        this.saveUsers();
        return { success: true, message: `User ${targetNickname} promoted to ${newGroup}` };
    }
    demoteUser(adminNickname, targetNickname, newGroup) {
        const admin = this.users[adminNickname];
        const target = this.users[targetNickname];
        if (!admin || !target) {
            return { success: false, message: 'User not found' };
        }
        // Check permissions
        if (!this.hasPermission(adminNickname, 'demote_user')) {
            return { success: false, message: 'Insufficient permissions' };
        }
        // Can't demote someone same or higher level than yourself
        if (this.getGroupLevel(target.group) >= this.getGroupLevel(admin.group)) {
            return { success: false, message: 'Cannot demote someone with same or higher privileges' };
        }
        target.group = newGroup;
        this.saveUsers();
        return { success: true, message: `User ${targetNickname} demoted to ${newGroup}` };
    }
    getUserGroup(nickname) {
        const user = this.users[nickname];
        return user ? user.group : null;
    }
    isUserRegistered(nickname) {
        return !!this.users[nickname];
    }
    getAllUsers() {
        return Object.entries(this.users).map(([nickname, user]) => ({
            nickname,
            group: user.group,
            registrationDate: user.registrationDate,
            lastLoginDate: user.lastLoginDate
        }));
    }
    changePassword(nickname, currentPassword, newPassword) {
        const user = this.users[nickname];
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        if (!this.verifyPassword(currentPassword, user.passwordHash, user.salt)) {
            return { success: false, message: 'Current password is incorrect' };
        }
        if (newPassword.length < 6) {
            return { success: false, message: 'New password must be at least 6 characters' };
        }
        const { hash, salt } = this.hashPassword(newPassword);
        user.passwordHash = hash;
        user.salt = salt;
        this.saveUsers();
        return { success: true, message: 'Password changed successfully' };
    }
    deleteUser(adminNickname, targetNickname) {
        const admin = this.users[adminNickname];
        const target = this.users[targetNickname];
        if (!admin || !target) {
            return { success: false, message: 'User not found' };
        }
        // Only owners can delete users
        if (admin.group !== types_1.UserGroup.OWNER) {
            return { success: false, message: 'Only owners can delete users' };
        }
        // Can't delete yourself
        if (adminNickname === targetNickname) {
            return { success: false, message: 'Cannot delete yourself' };
        }
        delete this.users[targetNickname];
        this.saveUsers();
        return { success: true, message: `User ${targetNickname} deleted` };
    }
    getDbPath() {
        return this.dbPath;
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=auth.js.map