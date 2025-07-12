import { EventEmitter } from 'events';
import { BluetoothServerConfig, BluetoothDevice } from './types';
import { User } from '../types';
export declare class BluetoothClient extends EventEmitter {
    private config;
    private meshManager;
    private keyPair;
    private nickname;
    private currentRoom;
    private users;
    private isConnected;
    constructor(config: BluetoothServerConfig);
    private setupMeshHandlers;
    connect(nickname: string): Promise<void>;
    private waitForConnection;
    private announceJoin;
    sendMessage(content: string): Promise<void>;
    sendDirectMessage(targetNickname: string, content: string): Promise<void>;
    private extractMentions;
    joinRoom(roomName: string): void;
    getConnectedDevices(): BluetoothDevice[];
    getUsers(): User[];
    getCurrentRoom(): string;
    getNickname(): string;
    isConnectedToMesh(): boolean;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=bluetooth-client.d.ts.map