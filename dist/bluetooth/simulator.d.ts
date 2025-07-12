import { EventEmitter } from 'events';
export interface SimulatedPeripheral {
    id: string;
    address: string;
    advertisement: {
        localName?: string;
        serviceUuids?: string[];
    };
    rssi: number;
    connect(callback: (error?: any) => void): void;
    disconnect(): void;
}
declare class BluetoothSimulator extends EventEmitter {
    state: string;
    private isScanning;
    private discoveryTimer?;
    private simulatedDevices;
    constructor();
    startScanning(serviceUuids?: string[], allowDuplicates?: boolean): void;
    stopScanning(): void;
    reset(): void;
}
export declare const simulatedNoble: BluetoothSimulator;
export {};
//# sourceMappingURL=simulator.d.ts.map