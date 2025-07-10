#!/usr/bin/env node

const DarkLine = require('./core/DarkLine');
const config = require('./config/config');

async function main() {
  console.log('🌑 DarkLine - Decentralized Terminal Chat');
  console.log('=========================================');
  
  try {
    const darkline = new DarkLine(config);
    await darkline.start();
  } catch (error) {
    console.error('❌ Failed to start DarkLine:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

main();