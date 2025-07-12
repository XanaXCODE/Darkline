import { EventEmitter } from 'events';
export interface TermuxBluetoothDevice {
    id: string;
    name: string;
    address: string;
    rssi: number;
    lastSeen: Date;
    isConnected: boolean;
}
export declare class TermuxBluetoothAdapter extends EventEmitter {
    private isScanning;
    private discoveredDevices;
    private scanTimer?;
    private isTermuxAvailable;
    constructor();
    private checkTermuxAPI;
    startScanning(): Promise<void>;
    private startRealBluetoothScan;
    private parseBluetoothScanResults;
    private startFallbackScan;
    stopScanning(): Promise<void>;
    connectToDevice(deviceId: string): Promise<boolean>;
    sendData(deviceId: string, data: string): Promise<boolean>;
    getDiscoveredDevices(): TermuxBluetoothDevice[];
    getConnectedDevices(): TermuxBluetoothDevice[];
    isBluetoothAvailable(): boolean;
    checkBluetoothPermissions(): Promise<boolean>;
}
//# sourceMappingURL=termux-adapter.d.ts.map