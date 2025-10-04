#!/usr/bin/env node

/**
 * Script to switch between SSE and Polling notification systems
 * Usage: node scripts/switch-notification-system.js [sse|polling]
 */

const fs = require('fs');
const path = require('path');

const CONTEXT_PATH = path.join(__dirname, '../src/contexts/NotificationContext.tsx');
const SSE_FIXED_PATH = path.join(__dirname, '../src/contexts/NotificationContext-Fixed.tsx');
const POLLING_PATH = path.join(__dirname, '../src/contexts/NotificationContext-Polling.tsx');

function switchTo(system) {
    let sourcePath;
    
    switch (system) {
        case 'sse':
            sourcePath = SSE_FIXED_PATH;
            console.log('🔄 Switching to fixed SSE implementation...');
            break;
        case 'polling':
            sourcePath = POLLING_PATH;
            console.log('🔄 Switching to polling implementation...');
            break;
        default:
            console.error('❌ Invalid system. Use "sse" or "polling"');
            process.exit(1);
    }

    if (!fs.existsSync(sourcePath)) {
        console.error(`❌ Source file not found: ${sourcePath}`);
        process.exit(1);
    }

    // Backup current implementation
    const backupPath = `${CONTEXT_PATH}.backup.${Date.now()}`;
    if (fs.existsSync(CONTEXT_PATH)) {
        fs.copyFileSync(CONTEXT_PATH, backupPath);
        console.log(`📦 Backed up current implementation to: ${backupPath}`);
    }

    // Copy new implementation
    fs.copyFileSync(sourcePath, CONTEXT_PATH);
    console.log(`✅ Switched to ${system} implementation`);
    
    if (system === 'polling') {
        console.log(`
📋 Polling Implementation Benefits:
   • More reliable connection
   • No connection storms
   • Works with all browsers
   • Simpler debugging
   • 15-second update interval
   
🔧 To switch back to SSE: node scripts/switch-notification-system.js sse
        `);
    } else {
        console.log(`
📋 Fixed SSE Implementation:
   • Real-time updates
   • Fixed connection management
   • Proper cleanup
   • Exponential backoff
   
🔧 To switch to polling: node scripts/switch-notification-system.js polling
        `);
    }
}

const system = process.argv[2];
if (!system) {
    console.log(`
🔧 Notification System Switcher

Usage: node scripts/switch-notification-system.js [system]

Available systems:
  sse      - Fixed Server-Sent Events (real-time)
  polling  - Simple polling (15s intervals, more reliable)

Current implementations available:
  • SSE Fixed: ${fs.existsSync(SSE_FIXED_PATH) ? '✅' : '❌'}
  • Polling:   ${fs.existsSync(POLLING_PATH) ? '✅' : '❌'}
    `);
    process.exit(0);
}

switchTo(system);