import { EventEmitter } from 'events';
import { BluetoothServerConfig, BluetoothMessage, BluetoothDevice } from './types';
import { User, Message, Room } from '../types';
export declare class BluetoothServer extends EventEmitter {
    private config;
    private meshManager;
    private authManager;
    private users;
    private rooms;
    private messageHistory;
    private serverKeyPair;
    constructor(config: BluetoothServerConfig);
    private setupMeshHandlers;
    private setupDefaultRooms;
    start(): Promise<void>;
    private handleNodeConnected;
    private handleNodeDisconnected;
    handleBluetoothMessage(message: BluetoothMessage): Promise<void>;
    private handleHandshake;
    private handleChatMessage;
    private handleUserJoin;
    private handleUserLeave;
    private handleDiscovery;
    sendMessage(roomId: string, content: string, fromUserId: string): Promise<void>;
    private extractMentions;
    private addToHistory;
    getConnectedDevices(): BluetoothDevice[];
    getUsers(): User[];
    getRooms(): Room[];
    getMessageHistory(roomId: string): Message[];
    stop(): Promise<void>;
}
//# sourceMappingURL=bluetooth-server.d.ts.map