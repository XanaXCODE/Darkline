import { EventEmitter } from 'events';
import { BluetoothServerConfig, BluetoothDevice } from './types';
import { User, Message } from '../types';
export declare class BluetoothP2PClient extends EventEmitter {
    private config;
    private meshManager;
    private keyPair;
    private nickname;
    private nodeId;
    private currentRoom;
    private connectedPeers;
    private messageHistory;
    private isActive;
    constructor(config: BluetoothServerConfig);
    private setupMeshHandlers;
    join(nickname: string): Promise<void>;
    private startPresenceAnnouncement;
    private announcePresence;
    private handleIncomingMessage;
    private handlePeerJoin;
    private handlePeerLeave;
    private handleChatMessage;
    private handleDirectMessage;
    private handleDiscovery;
    sendMessage(content: string): Promise<void>;
    sendDirectMessage(targetNickname: string, content: string): Promise<void>;
    private extractMentions;
    private addToHistory;
    getConnectedDevices(): BluetoothDevice[];
    getConnectedPeers(): User[];
    getMessageHistory(): Message[];
    getNickname(): string;
    getNodeId(): string;
    isActiveInMesh(): boolean;
    leave(): Promise<void>;
}
//# sourceMappingURL=peer-to-peer-client.d.ts.map