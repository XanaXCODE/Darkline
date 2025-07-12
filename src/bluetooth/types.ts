import { Message, User } from '../types';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  rssi: number;
  lastSeen: Date;
  isConnected: boolean;
}

export interface BluetoothMessage {
  id: string;
  type: 'message' | 'user_join' | 'user_leave' | 'handshake' | 'discovery' | 'direct_message';
  payload: any;
  from: string;
  timestamp: Date;
  hops: number;
  signature?: string;
}

export interface MeshNode {
  device: BluetoothDevice;
  connections: Set<string>;
  lastHeartbeat: Date;
  routingTable: Map<string, string>; // destination -> next hop
}

export interface BluetoothServerConfig {
  name: string;
  maxConnections: number;
  discoveryInterval: number;
  heartbeatInterval: number;
  maxHops: number;
  enableEncryption: boolean;
}

export interface BluetoothRoute {
  destination: string;
  nextHop: string;
  hops: number;
  timestamp: Date;
}

export const BLUETOOTH_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const BLUETOOTH_CHARACTERISTIC_UUID = '87654321-4321-4321-4321-cba987654321';