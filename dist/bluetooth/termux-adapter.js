"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermuxBluetoothAdapter = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class TermuxBluetoothAdapter extends events_1.EventEmitter {
    constructor() {
        super();
        this.isScanning = false;
        this.discoveredDevices = new Map();
        this.isTermuxAvailable = false;
        this.checkTermuxAPI();
    }
    async checkTermuxAPI() {
        try {
            // Check if termux-api is available
            await execAsync('which termux-bluetooth-scaninfo');
            this.isTermuxAvailable = true;
            this.emit('ready');
        }
        catch (error) {
            console.log('Termux:API Bluetooth not available - using fallback');
            this.isTermuxAvailable = false;
            // Fallback: simulate readiness after a delay
            setTimeout(() => this.emit('ready'), 1000);
        }
    }
    async startScanning() {
        if (this.isScanning)
            return;
        this.isScanning = true;
        if (this.isTermuxAvailable) {
            await this.startRealBluetoothScan();
        }
        else {
            await this.startFallbackScan();
        }
    }
    async startRealBluetoothScan() {
        try {
            // Start Bluetooth discovery using Termux:API
            await execAsync('termux-bluetooth-scaninfo');
            // Poll for discovered devices
            this.scanTimer = setInterval(async () => {
                try {
                    const { stdout } = await execAsync('termux-bluetooth-scaninfo');
                    this.parseBluetoothScanResults(stdout);
                }
                catch (error) {
                    console.log('Bluetooth scan error:', error);
                }
            }, 3000);
        }
        catch (error) {
            console.log('Failed to start Bluetooth scan:', error);
            this.startFallbackScan();
        }
    }
    parseBluetoothScanResults(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                // Parse Termux Bluetooth output format
                // Expected format: "Device: NAME [ADDRESS] RSSI: -XX"
                const match = line.match(/Device:\s*(.+?)\s*\[([^\]]+)\]\s*RSSI:\s*(-?\d+)/);
                if (match) {
                    const [, name, address, rssiStr] = match;
                    const rssi = parseInt(rssiStr);
                    const device = {
                        id: address.replace(/:/g, ''),
                        name: name.trim(),
                        address: address.trim(),
                        rssi,
                        lastSeen: new Date(),
                        isConnected: false
                    };
                    if (!this.discoveredDevices.has(device.id)) {
                        this.discoveredDevices.set(device.id, device);
                        this.emit('deviceDiscovered', device);
                    }
                }
            }
        }
        catch (error) {
            console.log('Error parsing Bluetooth results:', error);
        }
    }
    async startFallbackScan() {
        console.log('🎭 Starting simulation mode (no real Bluetooth hardware detected)');
        // Enhanced fallback: Create realistic cross-platform devices
        const fallbackDevices = [
            {
                id: 'windows001',
                name: 'Darkline_Windows_001',
                address: 'aa:bb:cc:dd:ee:01',
                rssi: -45,
                lastSeen: new Date(),
                isConnected: false
            },
            {
                id: 'android002',
                name: 'Darkline_Android_002',
                address: 'aa:bb:cc:dd:ee:02',
                rssi: -35,
                lastSeen: new Date(),
                isConnected: false
            },
            {
                id: 'laptop003',
                name: 'Darkline_Laptop_003',
                address: 'aa:bb:cc:dd:ee:03',
                rssi: -65,
                lastSeen: new Date(),
                isConnected: false
            }
        ];
        console.log('📱 Simulating nearby Darkline devices...');
        this.scanTimer = setInterval(() => {
            if (fallbackDevices.length > 0) {
                const device = fallbackDevices.shift();
                device.rssi += (Math.random() - 0.5) * 10; // Simulate signal variation
                device.lastSeen = new Date();
                this.discoveredDevices.set(device.id, device);
                this.emit('deviceDiscovered', device);
                console.log(`📡 Discovered: ${device.name} (${device.rssi}dBm)`);
            }
        }, 3000);
    }
    async stopScanning() {
        if (!this.isScanning)
            return;
        this.isScanning = false;
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = undefined;
        }
        if (this.isTermuxAvailable) {
            try {
                // Stop Bluetooth discovery
                await execAsync('pkill -f termux-bluetooth');
            }
            catch (error) {
                // Ignore errors when stopping
            }
        }
    }
    async connectToDevice(deviceId) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device)
            return false;
        if (this.isTermuxAvailable) {
            try {
                // Use Termux Bluetooth connect
                await execAsync(`termux-bluetooth-connect ${device.address}`);
                device.isConnected = true;
                this.emit('deviceConnected', device);
                return true;
            }
            catch (error) {
                console.log('Failed to connect to device:', error);
                return false;
            }
        }
        else {
            // Simulate connection for fallback
            setTimeout(() => {
                device.isConnected = true;
                this.emit('deviceConnected', device);
            }, 1000);
            return true;
        }
    }
    async sendData(deviceId, data) {
        const device = this.discoveredDevices.get(deviceId);
        if (!device || !device.isConnected)
            return false;
        if (this.isTermuxAvailable) {
            try {
                // Send data via Termux Bluetooth
                // Note: This might need custom implementation in Termux:API
                await execAsync(`echo "${data}" | termux-bluetooth-send ${device.address}`);
                return true;
            }
            catch (error) {
                console.log('Failed to send data:', error);
                return false;
            }
        }
        else {
            // Simulate data sending
            this.emit('dataReceived', deviceId, `Echo: ${data}`);
            return true;
        }
    }
    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }
    getConnectedDevices() {
        return Array.from(this.discoveredDevices.values()).filter(d => d.isConnected);
    }
    isBluetoothAvailable() {
        return this.isTermuxAvailable;
    }
    async checkBluetoothPermissions() {
        if (!this.isTermuxAvailable)
            return false;
        try {
            // Check if Bluetooth permissions are granted
            const { stdout } = await execAsync('termux-bluetooth-scaninfo --help');
            return stdout.includes('bluetooth') || stdout.includes('scan');
        }
        catch (error) {
            return false;
        }
    }
}
exports.TermuxBluetoothAdapter = TermuxBluetoothAdapter;
//# sourceMappingURL=termux-adapter.js.map