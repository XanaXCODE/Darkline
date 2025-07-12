import { Room } from '../types';
export interface ClientDatabase {
    favorites: string[];
    rooms: Room[];
    messageHistory: {
        [roomId: string]: {
            content: string;
            fromNickname: string;
            timestamp: string;
        }[];
    };
    settings: {
        nickname?: string;
        lastServer?: string;
        theme?: string;
        [key: string]: any;
    };
}
export declare class DatabaseManager {
    private dbPath;
    private encryptionKey;
    private data;
    constructor(nickname: string);
    private generateEncryptionKey;
    private getDefaultData;
    private encrypt;
    private decrypt;
    load(): void;
    save(): void;
    addFavorite(nickname: string): void;
    removeFavorite(nickname: string): void;
    getFavorites(): string[];
    isFavorite(nickname: string): boolean;
    saveRoom(room: Room): void;
    removeRoom(roomId: string): void;
    getRooms(): Room[];
    addMessage(roomId: string, content: string, fromNickname: string, timestamp: Date): void;
    getMessageHistory(roomId: string): {
        content: string;
        fromNickname: string;
        timestamp: string;
    }[];
    clearMessageHistory(roomId?: string): void;
    saveSetting(key: string, value: any): void;
    getSetting(key: string): any;
    purge(): void;
    getDbPath(): string;
    getDbSize(): number;
    exportData(): string;
    importData(jsonData: string): boolean;
}
//# sourceMappingURL=database.d.ts.map