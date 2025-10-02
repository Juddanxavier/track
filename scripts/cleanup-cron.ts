#!/usr/bin/env tsx
/** @format */

/**
 * Lead Cleanup Cron Job
 * 
 * This script runs the automated lead cleanup process.
 * It can be executed in several ways:
 * 1. Traditional cron job on server environments
 * 2. Manual execution for testing
 * 3. Called by external schedulers
 * 
 * Usage:
 *   npx tsx scripts/cleanup-cron.ts
 *   node -r esbuild-register scripts/cleanup-cron.ts
 */

import 'dotenv/config';
import { leadCleanupService } from '../src/lib/leadCleanupService';

async function runCleanup() {
    console.log('🧹 Starting scheduled lead cleanup...');
    console.log('Timestamp:', new Date().toISOString());

    try {
        // Check if cleanup is enabled
        const config = await leadCleanupService.getCleanupConfig();
        if (!config.isEnabled) {
            console.log('⏸️  Cleanup is disabled in configuration. Skipping...');
            return;
        }

        // Run the cleanup
        const summary = await leadCleanupService.runScheduledCleanup();

        console.log('✅ Cleanup completed successfully!');
        console.log('📊 Summary:');
        console.log(`   - Leads deleted: ${summary.deletedCount}`);
        console.log(`   - Leads archived: ${summary.archivedCount}`);
        console.log(`   - Errors: ${summary.errors.length}`);

        if (summary.errors.length > 0) {
            console.log('❌ Errors encountered:');
            summary.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        // Exit with appropriate code
        process.exit(summary.errors.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('💥 Fatal error during cleanup:', error);

        // Send notification about the failure
        try {
            await leadCleanupService.sendCleanupNotification({
                deletedCount: 0,
                archivedCount: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                runAt: new Date(),
            });
        } catch (notificationError) {
            console.error('Failed to send failure notification:', notificationError);
        }

        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Gracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Gracefully shutting down...');
    process.exit(0);
});

// Run the cleanup
runCleanup();