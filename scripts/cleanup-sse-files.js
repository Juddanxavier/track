#!/usr/bin/env node

/**
 * Script to clean up SSE-related files after migrating to polling
 * Usage: node scripts/cleanup-sse-files.js
 */

const fs = require('fs');
const path = require('path');

// Files to remove
const filesToRemove = [
    // SSE-specific hooks and utilities
    'src/hooks/useSSE.ts',
    'src/lib/sseConnectionManager.ts',
    'src/lib/sseUtils.ts',
    'src/types/sse.ts',
    
    // SSE-specific API endpoints
    'src/app/api/notifications/sse-test/route.ts',
    'src/app/api/notifications/sse-status/route.ts',
    'src/app/api/notifications/test-sse/route.ts',
    'src/app/api/notifications/connections/route.ts',
    'src/app/api/notifications/connections/[userId]/route.ts',
    'src/app/api/notifications/stats/route.ts',
    'src/app/api/notifications/test-broadcast/route.ts',
    
    // SSE-specific components
    'src/components/debug/SSEDebugPanel.tsx',
    'src/components/notifications/ConnectionStatus.tsx',
    
    // Alternative implementations (keep as backup)
    // 'src/contexts/NotificationContext-Fixed.tsx',
    // 'src/contexts/NotificationContext-Polling.tsx',
    
    // SSE-specific scripts and documentation
    'scripts/test-sse-connection.ts',
    'scripts/debug-notification-system.ts',
    'documentation/SSE_ENDPOINT_IMPLEMENTATION_SUMMARY.md',
    'documentation/SOCKET_IO_IMPLEMENTATION_SUMMARY.md',
    'documentation/DEBUGGING_GUIDE.md',
];

// Directories to remove (if empty after file cleanup)
const directoriesToCheck = [
    'src/app/api/notifications/connections',
    'src/components/debug',
];

function removeFile(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`✅ Removed: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to remove ${filePath}:`, error.message);
            return false;
        }
    } else {
        console.log(`⚠️  File not found: ${filePath}`);
        return false;
    }
}

function removeEmptyDirectory(dirPath) {
    const fullPath = path.join(__dirname, '..', dirPath);
    
    if (fs.existsSync(fullPath)) {
        try {
            const files = fs.readdirSync(fullPath);
            if (files.length === 0) {
                fs.rmdirSync(fullPath);
                console.log(`✅ Removed empty directory: ${dirPath}`);
                return true;
            } else {
                console.log(`⚠️  Directory not empty: ${dirPath} (contains ${files.length} files)`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to remove directory ${dirPath}:`, error.message);
            return false;
        }
    } else {
        console.log(`⚠️  Directory not found: ${dirPath}`);
        return false;
    }
}

function cleanupSSEFiles() {
    console.log('🧹 Starting SSE cleanup...\n');
    
    let removedCount = 0;
    let totalFiles = filesToRemove.length;
    
    // Remove files
    console.log('📁 Removing SSE-related files:');
    filesToRemove.forEach(filePath => {
        if (removeFile(filePath)) {
            removedCount++;
        }
    });
    
    console.log('');
    
    // Remove empty directories
    console.log('📂 Checking for empty directories:');
    directoriesToCheck.forEach(dirPath => {
        removeEmptyDirectory(dirPath);
    });
    
    console.log('');
    
    // Update imports in remaining files (basic cleanup)
    console.log('🔧 Checking for remaining SSE imports...');
    
    // Files that might have SSE imports
    const filesToCheck = [
        'src/app/test-sse/page.tsx',
        'src/app/dashboard/layout.tsx',
        'src/app/admin/layout.tsx',
    ];
    
    filesToCheck.forEach(filePath => {
        const fullPath = path.join(__dirname, '..', filePath);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for SSE-related imports
            const sseImports = [
                'useSSE',
                'SSEDebugPanel',
                'ConnectionStatus',
                'sseConnectionManager',
                'sseUtils',
            ];
            
            const foundImports = sseImports.filter(imp => content.includes(imp));
            if (foundImports.length > 0) {
                console.log(`⚠️  Found SSE imports in ${filePath}: ${foundImports.join(', ')}`);
                console.log(`   Please manually review and update this file.`);
            }
        }
    });
    
    console.log('');
    
    // Summary
    console.log('📊 Cleanup Summary:');
    console.log(`   Files processed: ${totalFiles}`);
    console.log(`   Files removed: ${removedCount}`);
    console.log(`   Files skipped: ${totalFiles - removedCount}`);
    
    if (removedCount > 0) {
        console.log('\n✅ SSE cleanup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Review any remaining SSE imports mentioned above');
        console.log('   2. Test the polling-based notification system');
        console.log('   3. Update any documentation that references SSE');
        console.log('   4. Consider removing the SSE endpoint: src/app/api/notifications/sse/route.ts');
    } else {
        console.log('\n⚠️  No files were removed. SSE files may have already been cleaned up.');
    }
}

// Run the cleanup
cleanupSSEFiles();