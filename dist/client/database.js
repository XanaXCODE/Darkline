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
exports.DatabaseManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DatabaseManager {
    constructor(nickname) {
        // Create .darkline directory in user's home
        const homeDir = process.env.HOME || process.env.USERPROFILE || './';
        const darklineDir = path.join(homeDir, '.darkline');
        if (!fs.existsSync(darklineDir)) {
            fs.mkdirSync(darklineDir, { recursive: true });
        }
        this.dbPath = path.join(darklineDir, `${nickname}.db`);
        this.encryptionKey = this.generateEncryptionKey(nickname);
        this.data = this.getDefaultData();
        this.load();
    }
    generateEncryptionKey(nickname) {
        // Generate a deterministic key based on nickname and system info
        const systemInfo = process.platform + process.arch;
        const keyMaterial = nickname + systemInfo + 'darkline-secret-salt';
        // Use a simple hash for the encryption key (in a real app, use PBKDF2 or similar)
        let hash = 0;
        for (let i = 0; i < keyMaterial.length; i++) {
            const char = keyMaterial.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(32, '0');
    }
    getDefaultData() {
        return {
            favorites: [],
            rooms: [],
            messageHistory: {},
            settings: {}
        };
    }
    encrypt(data) {
        try {
            // Simple XOR encryption for demonstration
            // In production, use a proper encryption library like crypto-js
            const key = this.encryptionKey;
            let encrypted = '';
            for (let i = 0; i < data.length; i++) {
                const keyChar = key[i % key.length];
                const encryptedChar = String.fromCharCode(data.charCodeAt(i) ^ keyChar.charCodeAt(0));
                encrypted += encryptedChar;
            }
            // Base64 encode to make it safe to store
            return Buffer.from(encrypted, 'binary').toString('base64');
        }
        catch (error) {
            console.error('Encryption error:', error);
            return data; // Fallback to unencrypted
        }
    }
    decrypt(encryptedData) {
        try {
            // Decode from base64 first
            const encrypted = Buffer.from(encryptedData, 'base64').toString('binary');
            const key = this.encryptionKey;
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                const keyChar = key[i % key.length];
                const decryptedChar = String.fromCharCode(encrypted.charCodeAt(i) ^ keyChar.charCodeAt(0));
                decrypted += decryptedChar;
            }
            return decrypted;
        }
        catch (error) {
            console.error('Decryption error:', error);
            return encryptedData; // Fallback to treating as unencrypted
        }
    }
    load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const encryptedData = fs.readFileSync(this.dbPath, 'utf8');
                const decryptedData = this.decrypt(encryptedData);
                this.data = JSON.parse(decryptedData);
            }
        }
        catch (error) {
            console.error('Failed to load database:', error);
            this.data = this.getDefaultData();
        }
    }
    save() {
        try {
            const jsonData = JSON.stringify(this.data, null, 2);
            const encryptedData = this.encrypt(jsonData);
            fs.writeFileSync(this.dbPath, encryptedData, 'utf8');
        }
        catch (error) {
            console.error('Failed to save database:', error);
        }
    }
    // Favorites management
    addFavorite(nickname) {
        if (!this.data.favorites.includes(nickname)) {
            this.data.favorites.push(nickname);
            this.save();
        }
    }
    removeFavorite(nickname) {
        const index = this.data.favorites.indexOf(nickname);
        if (index > -1) {
            this.data.favorites.splice(index, 1);
            this.save();
        }
    }
    getFavorites() {
        return [...this.data.favorites];
    }
    isFavorite(nickname) {
        return this.data.favorites.includes(nickname);
    }
    // Rooms management
    saveRoom(room) {
        const existingIndex = this.data.rooms.findIndex(r => r.id === room.id);
        if (existingIndex > -1) {
            this.data.rooms[existingIndex] = room;
        }
        else {
            this.data.rooms.push(room);
        }
        this.save();
    }
    removeRoom(roomId) {
        this.data.rooms = this.data.rooms.filter(r => r.id !== roomId);
        this.save();
    }
    getRooms() {
        return [...this.data.rooms];
    }
    // Message history management
    addMessage(roomId, content, fromNickname, timestamp) {
        if (!this.data.messageHistory[roomId]) {
            this.data.messageHistory[roomId] = [];
        }
        const messageData = {
            content,
            fromNickname,
            timestamp: timestamp.toISOString()
        };
        this.data.messageHistory[roomId].push(messageData);
        // Keep only last 100 messages per room to prevent file from growing too large
        if (this.data.messageHistory[roomId].length > 100) {
            this.data.messageHistory[roomId] = this.data.messageHistory[roomId].slice(-100);
        }
        this.save();
    }
    getMessageHistory(roomId) {
        return this.data.messageHistory[roomId] || [];
    }
    clearMessageHistory(roomId) {
        if (roomId) {
            delete this.data.messageHistory[roomId];
        }
        else {
            this.data.messageHistory = {};
        }
        this.save();
    }
    // Settings management
    saveSetting(key, value) {
        this.data.settings[key] = value;
        this.save();
    }
    getSetting(key) {
        return this.data.settings[key];
    }
    // Utility methods
    purge() {
        if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
        }
        this.data = this.getDefaultData();
    }
    getDbPath() {
        return this.dbPath;
    }
    getDbSize() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const stats = fs.statSync(this.dbPath);
                return stats.size;
            }
        }
        catch (error) {
            console.error('Failed to get database size:', error);
        }
        return 0;
    }
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }
    importData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            // Validate structure
            if (importedData.favorites && importedData.rooms && importedData.messageHistory && importedData.settings) {
                this.data = importedData;
                this.save();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database.js.map