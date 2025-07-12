import { UserGroup, AuthCredentials } from '../types';
export interface UserDatabase {
    [nickname: string]: {
        passwordHash: string;
        salt: string;
        group: UserGroup;
        email?: string;
        registrationDate: string;
        lastLoginDate?: string;
        loginAttempts: number;
        isLocked: boolean;
    };
}
export declare class AuthManager {
    private dbPath;
    private users;
    private maxLoginAttempts;
    private lockoutDuration;
    constructor(serverName?: string);
    private loadUsers;
    private saveUsers;
    private createDefaultAdmin;
    private hashPassword;
    private verifyPassword;
    register(credentials: AuthCredentials): {
        success: boolean;
        message: string;
        group?: UserGroup;
    };
    login(credentials: AuthCredentials): {
        success: boolean;
        message: string;
        user?: UserDatabase[string];
    };
    hasPermission(nickname: string, permission: string): boolean;
    private getGroupLevel;
    promoteUser(adminNickname: string, targetNickname: string, newGroup: UserGroup): {
        success: boolean;
        message: string;
    };
    demoteUser(adminNickname: string, targetNickname: string, newGroup: UserGroup): {
        success: boolean;
        message: string;
    };
    getUserGroup(nickname: string): UserGroup | null;
    isUserRegistered(nickname: string): boolean;
    getAllUsers(): {
        nickname: string;
        group: UserGroup;
        registrationDate: string;
        lastLoginDate?: string;
    }[];
    changePassword(nickname: string, currentPassword: string, newPassword: string): {
        success: boolean;
        message: string;
    };
    deleteUser(adminNickname: string, targetNickname: string): {
        success: boolean;
        message: string;
    };
    getDbPath(): string;
}
//# sourceMappingURL=auth.d.ts.map