#!/usr/bin/env tsx
/** @format */

/**
 * Background job for periodic shipment tracking synchronization
 * 
 * This script can be run as a cron job or scheduled task to periodically
 * sync tracking data from third-party APIs for active shipments.
 * 
 * Usage:
 *   npm run sync-tracking
 *   tsx scripts/sync-shipment-tracking.ts
 *   tsx scripts/sync-shipment-tracking.ts --shipments=id1,id2,id3
 *   tsx scripts/sync-shipment-tracking.ts --force
 *   tsx scripts/sync-shipment-tracking.ts --dry-run
 */

import { trackingService } from '../src/lib/trackingService';
import { shipmentService } from '../src/lib/shipmentService';
import { db } from '../src/database/db';
import { shipments } from '../src/database/schema';
import { and, inArray, isNotNull, lt, or, eq, isNull } from 'drizzle-orm';
import { ShipmentStatusType } from '../src/types/shipment';

interface SyncOptions {
    shipmentIds?: string[];
    force?: boolean;
    dryRun?: boolean;
    maxConcurrent?: number;
    verbose?: boolean;
}

interface SyncResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{ shipmentId: string; error: string }>;
    duration: number;
}

/**
 * Main sync function
 */
async function syncShipmentTracking(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    console.log('🚀 Starting shipment tracking synchronization...');

    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Check if tracking service is available
    if (!trackingService.isApiAvailable()) {
        console.error('❌ Tracking API is not configured or available');
        process.exit(1);
    }

    console.log(`📡 Using tracking provider: ${trackingService.getProviderName()}`);

    let shipmentsToSync: Array<{
        id: string;
        trackingCode: string;
        status: string;
        lastApiSync: Date | null;
        apiTrackingId: string | null;
        courierTrackingNumber: string | null;
    }> = [];

    try {
        if (options.shipmentIds && options.shipmentIds.length > 0) {
            // Sync specific shipments
            console.log(`🎯 Syncing specific shipments: ${options.shipmentIds.join(', ')}`);

            const shipmentResults = await db
                .select({
                    id: shipments.id,
                    trackingCode: shipments.trackingCode,
                    status: shipments.status,
                    lastApiSync: shipments.lastApiSync,
                    apiTrackingId: shipments.apiTrackingId,
                    courierTrackingNumber: shipments.courierTrackingNumber,
                })
                .from(shipments)
                .where(inArray(shipments.id, options.shipmentIds));

            shipmentsToSync = shipmentResults;
        } else {
            // Sync shipments that need updating
            const syncThreshold = options.force
                ? new Date(0) // Force sync all if --force flag is used
                : new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

            const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery'];

            console.log(`🔍 Finding shipments that need sync (last synced before ${syncThreshold.toISOString()})`);

            const shipmentResults = await db
                .select({
                    id: shipments.id,
                    trackingCode: shipments.trackingCode,
                    status: shipments.status,
                    lastApiSync: shipments.lastApiSync,
                    apiTrackingId: shipments.apiTrackingId,
                    courierTrackingNumber: shipments.courierTrackingNumber,
                })
                .from(shipments)
                .where(
                    and(
                        inArray(shipments.status, activeStatuses),
                        or(
                            isNotNull(shipments.apiTrackingId),
                            isNotNull(shipments.courierTrackingNumber)
                        ),
                        or(
                            lt(shipments.lastApiSync, syncThreshold),
                            isNull(shipments.lastApiSync)
                        )
                    )
                )
                .limit(500); // Limit to prevent overwhelming the API

            shipmentsToSync = shipmentResults;
        }

        console.log(`📦 Found ${shipmentsToSync.length} shipments to sync`);

        if (shipmentsToSync.length === 0) {
            console.log('✅ No shipments need synchronization');
            return {
                totalProcessed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                errors: [],
                duration: Date.now() - startTime,
            };
        }

        if (options.verbose) {
            console.log('📋 Shipments to sync:');
            shipmentsToSync.forEach(s => {
                console.log(`  - ${s.trackingCode} (${s.id}) - Status: ${s.status}, Last sync: ${s.lastApiSync || 'Never'}`);
            });
        }

        if (options.dryRun) {
            console.log('🔍 DRY RUN: Would sync the above shipments');
            return {
                totalProcessed: shipmentsToSync.length,
                successful: 0,
                failed: 0,
                skipped: shipmentsToSync.length,
                errors: [],
                duration: Date.now() - startTime,
            };
        }

        // Perform batch synchronization
        console.log('🔄 Starting batch synchronization...');

        const batchResult = await trackingService.batchSync(
            shipmentsToSync.map(s => s.id),
            options.maxConcurrent || 5
        );

        const result: SyncResult = {
            totalProcessed: shipmentsToSync.length,
            successful: batchResult.successful.length,
            failed: batchResult.failed.length,
            skipped: 0,
            errors: batchResult.failed,
            duration: Date.now() - startTime,
        };

        // Log results
        console.log('\n📊 Synchronization Results:');
        console.log(`  ✅ Successful: ${result.successful}`);
        console.log(`  ❌ Failed: ${result.failed}`);
        console.log(`  📦 Total processed: ${result.totalProcessed}`);
        console.log(`  ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);

        if (result.errors.length > 0) {
            console.log('\n❌ Errors:');
            result.errors.forEach(error => {
                console.log(`  - ${error.shipmentId}: ${error.error}`);
            });
        }

        if (options.verbose && batchResult.successful.length > 0) {
            console.log('\n✅ Successfully synced shipments:');
            batchResult.successful.forEach(id => {
                const shipment = shipmentsToSync.find(s => s.id === id);
                console.log(`  - ${shipment?.trackingCode} (${id})`);
            });
        }

        return result;

    } catch (error) {
        console.error('💥 Fatal error during synchronization:', error);
        throw error;
    }
}

/**
 * Get sync statistics
 */
async function getSyncStats(): Promise<void> {
    console.log('📊 Getting synchronization statistics...\n');

    try {
        const stats = await trackingService.getSyncStats();

        console.log('📈 Tracking Synchronization Statistics:');
        console.log(`  🏢 Provider: ${stats.providerName || 'Not configured'}`);
        console.log(`  📦 Total shipments: ${stats.totalShipments}`);
        console.log(`  🔗 With API tracking: ${stats.shipmentsWithApiTracking}`);
        console.log(`  ✅ Recently synced (last hour): ${stats.lastSyncedCount}`);
        console.log(`  ⏳ Need sync: ${stats.needsSyncCount}`);

        const syncPercentage = stats.totalShipments > 0
            ? ((stats.shipmentsWithApiTracking / stats.totalShipments) * 100).toFixed(1)
            : '0';
        console.log(`  📊 API integration coverage: ${syncPercentage}%`);

    } catch (error) {
        console.error('❌ Failed to get sync statistics:', error);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(): SyncOptions {
    const args = process.argv.slice(2);
    const options: SyncOptions = {};

    for (const arg of args) {
        if (arg === '--force') {
            options.force = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg.startsWith('--shipments=')) {
            const shipmentIds = arg.split('=')[1].split(',').map(id => id.trim());
            options.shipmentIds = shipmentIds;
        } else if (arg.startsWith('--concurrent=')) {
            const concurrent = parseInt(arg.split('=')[1]);
            if (!isNaN(concurrent) && concurrent > 0) {
                options.maxConcurrent = concurrent;
            }
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        } else if (arg === '--stats') {
            getSyncStats().then(() => process.exit(0));
            return options;
        }
    }

    return options;
}

/**
 * Show help information
 */
function showHelp(): void {
    console.log(`
🚚 Shipment Tracking Synchronization Tool

Usage:
  tsx scripts/sync-shipment-tracking.ts [options]

Options:
  --help, -h              Show this help message
  --stats                 Show synchronization statistics and exit
  --shipments=id1,id2     Sync specific shipments by ID
  --force                 Force sync all shipments (ignore last sync time)
  --dry-run               Show what would be synced without making changes
  --verbose, -v           Show detailed output
  --concurrent=N          Max concurrent API requests (default: 5)

Examples:
  # Sync all shipments that need updating
  tsx scripts/sync-shipment-tracking.ts

  # Sync specific shipments
  tsx scripts/sync-shipment-tracking.ts --shipments=ship_123,ship_456

  # Force sync all active shipments
  tsx scripts/sync-shipment-tracking.ts --force

  # Dry run to see what would be synced
  tsx scripts/sync-shipment-tracking.ts --dry-run --verbose

  # Show statistics
  tsx scripts/sync-shipment-tracking.ts --stats

Cron Job Example:
  # Run every 30 minutes
  */30 * * * * cd /path/to/app && npm run sync-tracking

Environment Variables:
  TRACKING_API_PROVIDER    - API provider (e.g., 'shipengine')
  SHIPENGINE_API_KEY      - ShipEngine API key
  SHIPENGINE_BASE_URL     - ShipEngine API base URL (optional)
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        const options = parseArgs();

        if (options.verbose) {
            console.log('🔧 Options:', options);
        }

        const result = await syncShipmentTracking(options);

        // Exit with error code if there were failures
        if (result.failed > 0) {
            console.log(`\n⚠️  Completed with ${result.failed} failures`);
            process.exit(1);
        } else {
            console.log('\n🎉 Synchronization completed successfully!');
            process.exit(0);
        }

    } catch (error) {
        console.error('\n💥 Synchronization failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}