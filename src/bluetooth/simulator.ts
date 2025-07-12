import { EventEmitter } from 'events';

// Enhanced simulator for Android/Termux
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

class BluetoothSimulator extends EventEmitter {
  public state: string = 'poweredOn';
  private isScanning: boolean = false;
  private discoveryTimer?: NodeJS.Timeout;
  private simulatedDevices: SimulatedPeripheral[] = [];

  constructor() {
    super();
    
    // Enhanced simulation for Termux/Android
    this.simulatedDevices = [
      {
        id: 'termux_001',
        address: 'aa:bb:cc:dd:ee:01',
        advertisement: {
          localName: 'Darkline_Android_001',
          serviceUuids: ['12345678123412341234123456789abc']
        },
        rssi: -35, // Stronger signal for mobile
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

  startScanning(serviceUuids?: string[], allowDuplicates?: boolean): void {
    if (this.isScanning) return;
    
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

  stopScanning(): void {
    if (!this.isScanning) return;
    
    this.isScanning = false;
    
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
  }

  reset(): void {
    this.stopScanning();
    this.state = 'poweredOn';
    this.emit('stateChange', this.state);
  }
}

// Export a singleton instance that mimics the noble API
export const simulatedNoble = new BluetoothSimulator();