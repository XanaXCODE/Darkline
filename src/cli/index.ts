#!/usr/bin/env node

import { Command } from 'commander';
import { DarklineServer } from '../server';
import { DarklineClient } from '../client';
import { BluetoothP2PClient } from '../bluetooth';
import { BluetoothUI } from '../bluetooth/ui';
import { ServerConfig } from '../types';
import * as readline from 'readline';

const program = new Command();

program
  .name('darkline')
  .description('Decentralized chat system with end-to-end encryption')
  .version('1.0.0');

program
  .command('server')
  .description('Start a Darkline server')
  .option('-p, --port <port>', 'Server port', '8080')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('--name <name>', 'Server name', 'Darkline Server')
  .option('--max-connections <max>', 'Maximum connections', '100')
  .option('--no-p2p', 'Disable P2P connections')
  .option('--no-store', 'Disable message storing')
  .option('--no-history', 'Disable message history')
  .option('--history-limit <limit>', 'Maximum messages in history', '1000')
  .option('--history-file <file>', 'History file path', 'darkline-history.json')
  .action((options) => {
    const config: ServerConfig = {
      port: parseInt(options.port),
      host: options.host,
      name: options.name,
      maxConnections: parseInt(options.maxConnections),
      enableP2P: options.p2p !== false,
      storeMessages: options.store !== false,
      messageHistory: {
        enabled: options.history !== false,
        maxMessages: parseInt(options.historyLimit),
        persistToDisk: true,
        historyFile: options.historyFile
      }
    };

    console.log('Starting Darkline server...');
    console.log(`Config: ${JSON.stringify(config, null, 2)}`);
    
    new DarklineServer(config);
  });

program
  .command('connect')
  .description('Connect to a Darkline server')
  .option('-s, --server <url>', 'Server URL', 'ws://localhost:8080')
  .requiredOption('-n, --nickname <nickname>', 'Your nickname (required)')
  .requiredOption('-p, --password <password>', 'Your password (required)')
  .action(async (options) => {
    const { nickname, password, server } = options;

    console.log(`Connecting to ${server} as ${nickname}...`);
    
    const client = new DarklineClient();
    await client.connect(server, nickname, password);
  });

program
  .command('bluetooth')
  .description('Join Darkline Bluetooth mesh network (P2P offline chat)')
  .requiredOption('-n, --nickname <nickname>', 'Your nickname (required)')
  .option('--discovery-interval <ms>', 'Discovery interval in ms', '30000')
  .option('--heartbeat-interval <ms>', 'Heartbeat interval in ms', '10000')
  .option('--max-hops <hops>', 'Maximum message hops', '5')
  .option('--no-encryption', 'Disable message encryption')
  .action(async (options) => {
    const { nickname } = options;
    
    const config = {
      name: `${nickname}'s Device`,
      maxConnections: 15,
      discoveryInterval: parseInt(options.discoveryInterval),
      heartbeatInterval: parseInt(options.heartbeatInterval),
      maxHops: parseInt(options.maxHops),
      enableEncryption: options.encryption !== false
    };

    // Clear screen and show loading
    console.clear();
    console.log('🌐 Darkline Bluetooth Mesh');
    console.log(`🚀 Initializing as ${nickname}...`);
    console.log('📡 Starting Bluetooth mesh network...');
    
    const bluetoothP2P = new BluetoothP2PClient(config);

    try {
      await bluetoothP2P.join(nickname);
      
      // Clear console output and start UI
      console.clear();
      
      // Create and start the beautiful UI
      const ui = new BluetoothUI(bluetoothP2P, nickname);
      ui.start();
      
    } catch (error: any) {
      console.clear();
      console.error('❌ Failed to start Bluetooth mesh:');
      console.error(error.message);
      console.log('\n💡 Tips:');
      console.log('• Make sure Bluetooth is enabled');
      console.log('• Try running with sudo if needed');
      console.log('• On Termux, install bluetooth packages');
      process.exit(1);
    }
  });

program
  .command('create-server')
  .description('Create and start a new Darkline server with guided setup')
  .action(async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('Welcome to Darkline Server Setup');
    console.log('================================');

    const serverName = await question(rl, 'Server name [Darkline Server]: ') || 'Darkline Server';
    const port = await question(rl, 'Port [8080]: ') || '8080';
    const host = await question(rl, 'Host [localhost]: ') || 'localhost';
    const enableP2P = await question(rl, 'Enable P2P connections? [y/N]: ');
    const storeMessages = await question(rl, 'Store messages for offline users? [Y/n]: ');
    const enableHistory = await question(rl, 'Enable message history? [Y/n]: ');
    const historyLimit = await question(rl, 'Maximum messages in history [1000]: ') || '1000';

    rl.close();

    const config: ServerConfig = {
      port: parseInt(port),
      host,
      name: serverName,
      maxConnections: 100,
      enableP2P: enableP2P.toLowerCase().startsWith('y'),
      storeMessages: !storeMessages.toLowerCase().startsWith('n'),
      messageHistory: {
        enabled: !enableHistory.toLowerCase().startsWith('n'),
        maxMessages: parseInt(historyLimit),
        persistToDisk: true,
        historyFile: 'darkline-history.json'
      }
    };

    console.log('\nStarting server with configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('\nServer will be accessible at:', `ws://${host}:${port}`);
    
    new DarklineServer(config);
  });

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function setupBluetoothP2PChatInterface(bluetoothP2P: BluetoothP2PClient): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Handle incoming messages (already handled by event listeners, no need to duplicate)
  bluetoothP2P.on('messageReceived', (message) => {
    // Message already shown by the client, just prompt again
    rl.prompt();
  });

  bluetoothP2P.on('directMessageReceived', (dm) => {
    console.log(`\n📩 DM from ${dm.from}: ${dm.content}`);
    rl.prompt();
  });

  bluetoothP2P.on('userJoined', () => {
    rl.prompt();
  });

  bluetoothP2P.on('userLeft', () => {
    rl.prompt();
  });

  bluetoothP2P.on('left', () => {
    console.log('\n📡 Left Bluetooth mesh network');
    rl.close();
    process.exit(0);
  });

  // Handle user input
  const handleInput = (input: string) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput === 'quit' || trimmedInput === 'exit') {
      console.log('Leaving Bluetooth mesh network...');
      bluetoothP2P.leave().then(() => {
        rl.close();
        process.exit(0);
      });
      return;
    }

    if (trimmedInput === '/devices') {
      const devices = bluetoothP2P.getConnectedDevices();
      console.log(`\n📱 Connected Bluetooth devices (${devices.length}):`);
      devices.forEach(device => {
        console.log(`  - ${device.name} (${device.address}) RSSI: ${device.rssi}`);
      });
      rl.prompt();
      return;
    }

    if (trimmedInput === '/peers') {
      const peers = bluetoothP2P.getConnectedPeers();
      console.log(`\n👥 Connected peers (${peers.length}):`);
      peers.forEach(peer => {
        console.log(`  - ${peer.nickname} (${peer.id.slice(0, 8)}...)`);
      });
      rl.prompt();
      return;
    }

    if (trimmedInput === '/status') {
      const devices = bluetoothP2P.getConnectedDevices();
      const peers = bluetoothP2P.getConnectedPeers();
      const isActive = bluetoothP2P.isActiveInMesh();
      
      console.log(`\n📊 Mesh Status:`);
      console.log(`  Active in mesh: ${isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`  Bluetooth devices: ${devices.length}`);
      console.log(`  Connected peers: ${peers.length}`);
      console.log(`  Your Node ID: ${bluetoothP2P.getNodeId().slice(0, 8)}...`);
      rl.prompt();
      return;
    }

    if (trimmedInput.startsWith('/dm ')) {
      const parts = trimmedInput.slice(4).split(' ');
      const targetNickname = parts[0];
      const message = parts.slice(1).join(' ');
      
      if (targetNickname && message) {
        bluetoothP2P.sendDirectMessage(targetNickname, message)
          .then(() => {
            console.log(`📤 DM sent to ${targetNickname}: ${message}`);
          })
          .catch((error) => {
            console.log(`❌ Failed to send DM: ${error.message}`);
          });
      } else {
        console.log('Usage: /dm <nickname> <message>');
      }
      rl.prompt();
      return;
    }

    if (trimmedInput === '/help') {
      console.log('\n📋 Bluetooth P2P Mesh Commands:');
      console.log('  /devices   - Show connected Bluetooth devices');
      console.log('  /peers     - Show connected Darkline peers');
      console.log('  /status    - Show mesh network status');
      console.log('  /dm <nick> <msg> - Send direct message to peer');
      console.log('  /help      - Show this help');
      console.log('  quit       - Leave Bluetooth mesh network');
      console.log('\n💬 Just type a message and press Enter to broadcast to all peers');
      rl.prompt();
      return;
    }

    if (trimmedInput) {
      if (bluetoothP2P.isActiveInMesh()) {
        bluetoothP2P.sendMessage(trimmedInput)
          .catch((error) => {
            console.log(`❌ Failed to send message: ${error.message}`);
          });
      } else {
        console.log('⚠️  No peers connected - message not sent');
      }
    }
    
    rl.prompt();
  };

  rl.on('line', handleInput);
  rl.on('SIGINT', () => {
    console.log('\nLeaving mesh network...');
    bluetoothP2P.leave().then(() => {
      process.exit(0);
    });
  });

  // Start with prompt
  console.log('\n💬 Bluetooth P2P Chat ready! Type /help for commands');
  rl.prompt();
}

program.parse();