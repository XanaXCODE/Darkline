import { EventEmitter } from 'events';
import { BluetoothDevice, BluetoothMessage, BluetoothServerConfig } from './types';
export declare class BluetoothMeshManager extends EventEmitter {
    private config;
    private devices;
    private meshNodes;
    private routingTable;
    private isScanning;
    private discoveryTimer?;
    private heartbeatTimer?;
    private keyPair;
    private nodeId;
    constructor(config: BluetoothServerConfig);
    private setupNoble;
    startMesh(): Promise<void>;
    private startDiscovery;
    private stopDiscovery;
    private startHeartbeat;
    private handleTermuxDeviceDiscovered;
    private handleTermuxDeviceConnected;
    private connectToTermuxDevice;
    private handleDeviceDiscovered;
    private isDarklineDevice;
    private connectToDevice;
    private sendHandshake;
    private sendMessage;
    private signMessage;
    private verifyMessage;
    broadcastMessage(message: BluetoothMessage): Promise<void>;
    private performDiscovery;
    private sendHeartbeat;
    private cleanupStaleNodes;
    getConnectedDevices(): BluetoothDevice[];
    getNodeId(): string;
    stop(): Promise<void>;
}
//# sourceMappingURL=mesh-manager.d.ts.map