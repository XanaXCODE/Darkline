"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulatedNoble = void 0;
const events_1 = require("events");
class BluetoothSimulator extends events_1.EventEmitter {
    constructor() {
        super();
        this.state = 'poweredOn';
        this.isScanning = false;
        this.simulatedDevices = [];
        // Simulate some Darkline devices
        this.simulatedDevices = [
            {
                id: 'device_001',
                address: 'aa:bb:cc:dd:ee:01',
                advertisement: {
                    localName: 'Darkline_Mobile_001',
                    serviceUuids: ['12345678123412341234123456789abc']
                },
                rssi: -45,
                connect: (callback) => {
                    setTimeout(() => callback(), 100);
                },
                disconnect: () => {
                    // Disconnect silently
                }
            },
            {
                id: 'device_002',
                address: 'aa:bb:cc:dd:ee:02',
                advertisement: {
                    localName: 'Darkline_Desktop_002',
                    serviceUuids: ['12345678123412341234123456789abc']
                },
                rssi: -67,
                connect: (callback) => {
                    setTimeout(() => callback(), 150);
                },
                disconnect: () => {
                    // Disconnect silently
                }
            },
            {
                id: 'device_003',
                address: 'aa:bb:cc:dd:ee:03',
                advertisement: {
                    localName: 'Darkline_Laptop_003',
                    serviceUuids: ['12345678123412341234123456789abc']
                },
                rssi: -82,
                connect: (callback) => {
                    setTimeout(() => callback(), 200);
                },
                disconnect: () => {
                    // Disconnect silently
                }
            }
        ];
        // Emit state change after initialization
        setTimeout(() => {
            this.emit('stateChange', this.state);
        }, 100);
    }
    startScanning(serviceUuids, allowDuplicates) {
        if (this.isScanning)
            return;
        this.isScanning = true;
        // Simulate discovering devices gradually
        this.discoveryTimer = setInterval(() => {
            if (this.simulatedDevices.length > 0 && this.isScanning) {
                const randomDevice = this.simulatedDevices[Math.floor(Math.random() * this.simulatedDevices.length)];
                // Add some randomness to RSSI to simulate movement
                const randomizedDevice = {
                    ...randomDevice,
                    rssi: randomDevice.rssi + (Math.random() - 0.5) * 10
                };
                this.emit('discover', randomizedDevice);
            }
        }, 3000 + Math.random() * 2000); // Discover devices every 3-5 seconds
    }
    stopScanning() {
        if (!this.isScanning)
            return;
        this.isScanning = false;
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = undefined;
        }
    }
    reset() {
        this.stopScanning();
        this.state = 'poweredOn';
        this.emit('stateChange', this.state);
    }
}
// Export a singleton instance that mimics the noble API
exports.simulatedNoble = new BluetoothSimulator();
//# sourceMappingURL=simulator.js.map