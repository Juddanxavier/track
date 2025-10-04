#!/usr/bin/env tsx
/** @format */

/**
 * Health monitoring script for shipment tracking synchronization
 * 
 * This script checks the health of the sync system and can be used for:
 * - Monitoring dashboards
 * - Health checks in load balancers
 * - Alerting systems
 * - Automated recovery
 * 
 * Usage:
 *   npm run sync-health
 *   tsx scripts/monitor-sync-health.ts
 *   tsx scripts/monitor-sync-health.ts --check-stale
 *   tsx scripts/monitor-sync-health.ts --alert-threshold=2
 *   tsx scripts/monitor-sync-health.ts --json
 */

import { trackingService } from '../src/lib/trackingService';
import { db } from '../src/database/db';
import { shipments, shipmentEvents } from '../src/database/schema';
import { and, eq, gte, lt, inArray, desc, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { ShipmentStatusType } from '../src/types/shipment';
import { createSyncLogger } from '../src/lib/syncLogger';

interface HealthCheckOptions {
    checkStale?: boolean;
    alertThreshold?: number; // hours
    json?: boolean;
    verbose?: boolean;
}

interface HealthStatus {
    status: 'healthy' | 'warning' | 'critical';
    timestamp: string;
    checks: {
        apiConnection: boolean;
        recentSyncActivity: boolean;
        staleShipments: boolean;
        errorRate: boolean;
    };
    metrics: {
        totalShipments: number;
        activeShipments: number;
        shipmentsWithApiTracking: number;
        lastSyncTime: string | null;
        recentSyncCount: number;
        staleShipmentCount: number;
        errorRatePercent: number;
        avgSyncInterval: number; // minutes
    };
    alerts: string[];
    recommendations: string[];
}

const logger = createSyncLogger('health-monitor');

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(options: HealthCheckOptions): Promise<HealthStatus> {
    const startTime = Date.now();
    logger.info('Starting health check', { options });

    const status: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            apiConnection: false,
            recentSyncActivity: false,
            staleShipments: true,
            errorRate: true,
        },
        metrics: {
            totalShipments: 0,
            activeShipments: 0,
            shipmentsWithApiTracking: 0,
            lastSyncTime: null,
            recentSyncCount: 0,
            staleShipmentCount: 0,
            errorRatePercent: 0,
            avgSyncInterval: 0,
        },
        alerts: [],
        recommendations: [],
    };

    try {
        // Check 1: API Connection
        status.checks.apiConnection = await checkApiConnection();
        if (!status.checks.apiConnection) {
            status.alerts.push('Tracking API is not available or configured');
            status.recommendations.push('Check API credentials and network connectivity');
            status.status = 'critical';
        }

        // Check 2: Get basic metrics
        const basicMetrics = await getBasicMetrics();
        Object.assign(status.metrics, basicMetrics);

        // Check 3: Recent sync activity
        const recentSyncCheck = await checkRecentSyncActivity(options.alertThreshold || 2);
        status.checks.recentSyncActivity = recentSyncCheck.isHealthy;
        status.metrics.lastSyncTime = recentSyncCheck.lastSyncTime;
        status.metrics.recentSyncCount = recentSyncCheck.recentCount;

        if (!recentSyncCheck.isHealthy) {
            status.alerts.push(`No recent sync activity (last sync: ${recentSyncCheck.lastSyncTime || 'never'})`);
            status.recommendations.push('Check if cron job is running and sync script is working');
            if (status.status === 'healthy') status.status = 'warning';
        }

        // Check 4: Stale shipments (if requested)
        if (options.checkStale) {
            const staleCheck = await checkStaleShipments(options.alertThreshold || 2);
            status.checks.staleShipments = staleCheck.isHealthy;
            status.metrics.staleShipmentCount = staleCheck.staleCount;

            if (!staleCheck.isHealthy) {
                status.alerts.push(`${staleCheck.staleCount} shipments haven't been synced recently`);
                status.recommendations.push('Run manual sync or check for API issues');
                if (status.status === 'healthy') status.status = 'warning';
            }
        }

        // Check 5: Error rate
        const errorRateCheck = await checkErrorRate();
        status.checks.errorRate = errorRateCheck.isHealthy;
        status.metrics.errorRatePercent = errorRateCheck.errorRate;

        if (!errorRateCheck.isHealthy) {
            status.alerts.push(`High error rate: ${errorRateCheck.errorRate.toFixed(1)}%`);
            status.recommendations.push('Check recent error logs and API status');
            if (status.status === 'healthy') status.status = 'warning';
        }

        // Check 6: Average sync interval
        status.metrics.avgSyncInterval = await calculateAverageSyncInterval();

        // Final status determination
        if (status.alerts.length === 0) {
            status.status = 'healthy';
        } else if (status.alerts.some(alert =>
            alert.includes('API is not available') ||
            alert.includes('critical')
        )) {
            status.status = 'critical';
        } else {
            status.status = 'warning';
        }

        const duration = Date.now() - startTime;
        logger.info('Health check completed', {
            status: status.status,
            alertCount: status.alerts.length,
            duration
        });

        return status;

    } catch (error) {
        logger.error('Health check failed', error);
        status.status = 'critical';
        status.alerts.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return status;
    }
}

/**
 * Check if tracking API is available
 */
async function checkApiConnection(): Promise<boolean> {
    try {
        return trackingService.isApiAvailable();
    } catch (error) {
        logger.error('API connection check failed', error);
        return false;
    }
}

/**
 * Get basic shipment metrics
 */
async function getBasicMetrics(): Promise<Partial<HealthStatus['metrics']>> {
    try {
        const stats = await trackingService.getSyncStats();

        const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery'];
        const [activeResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(inArray(shipments.status, activeStatuses));

        return {
            totalShipments: stats.totalShipments,
            activeShipments: activeResult.count,
            shipmentsWithApiTracking: stats.shipmentsWithApiTracking,
        };
    } catch (error) {
        logger.error('Failed to get basic metrics', error);
        return {};
    }
}

/**
 * Check recent sync activity
 */
async function checkRecentSyncActivity(alertThresholdHours: number): Promise<{
    isHealthy: boolean;
    lastSyncTime: string | null;
    recentCount: number;
}> {
    try {
        const thresholdTime = new Date(Date.now() - alertThresholdHours * 60 * 60 * 1000);

        // Get most recent sync
        const [lastSyncResult] = await db
            .select({ lastApiSync: shipments.lastApiSync })
            .from(shipments)
            .where(isNotNull(shipments.lastApiSync))
            .orderBy(desc(shipments.lastApiSync))
            .limit(1);

        // Count recent syncs
        const [recentSyncResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(gte(shipments.lastApiSync, thresholdTime));

        const lastSyncTime = lastSyncResult?.lastApiSync?.toISOString() || null;
        const isHealthy = lastSyncTime ? new Date(lastSyncTime) > thresholdTime : false;

        return {
            isHealthy,
            lastSyncTime,
            recentCount: recentSyncResult.count,
        };
    } catch (error) {
        logger.error('Failed to check recent sync activity', error);
        return { isHealthy: false, lastSyncTime: null, recentCount: 0 };
    }
}

/**
 * Check for stale shipments
 */
async function checkStaleShipments(alertThresholdHours: number): Promise<{
    isHealthy: boolean;
    staleCount: number;
}> {
    try {
        const thresholdTime = new Date(Date.now() - alertThresholdHours * 60 * 60 * 1000);
        const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery'];

        const [staleResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(and(
                inArray(shipments.status, activeStatuses),
                isNotNull(shipments.apiTrackingId),
                lt(shipments.lastApiSync, thresholdTime)
            ));

        return {
            isHealthy: staleResult.count === 0,
            staleCount: staleResult.count,
        };
    } catch (error) {
        logger.error('Failed to check stale shipments', error);
        return { isHealthy: false, staleCount: 0 };
    }
}

/**
 * Check error rate from recent events
 */
async function checkErrorRate(): Promise<{
    isHealthy: boolean;
    errorRate: number;
}> {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Get total events in last hour
        const [totalEventsResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipmentEvents)
            .where(gte(shipmentEvents.recordedAt, oneHourAgo));

        // Get error events in last hour
        const [errorEventsResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipmentEvents)
            .where(and(
                gte(shipmentEvents.recordedAt, oneHourAgo),
                eq(shipmentEvents.eventType, 'exception')
            ));

        const errorRate = totalEventsResult.count > 0
            ? (errorEventsResult.count / totalEventsResult.count) * 100
            : 0;

        return {
            isHealthy: errorRate < 10, // Less than 10% error rate is considered healthy
            errorRate,
        };
    } catch (error) {
        logger.error('Failed to check error rate', error);
        return { isHealthy: false, errorRate: 0 };
    }
}

/**
 * Calculate average sync interval
 */
async function calculateAverageSyncInterval(): Promise<number> {
    try {
        // Get recent sync times
        const recentSyncs = await db
            .select({ lastApiSync: shipments.lastApiSync })
            .from(shipments)
            .where(isNotNull(shipments.lastApiSync))
            .orderBy(desc(shipments.lastApiSync))
            .limit(10);

        if (recentSyncs.length < 2) {
            return 0;
        }

        // Calculate intervals between syncs
        const intervals: number[] = [];
        for (let i = 0; i < recentSyncs.length - 1; i++) {
            const current = recentSyncs[i].lastApiSync!.getTime();
            const next = recentSyncs[i + 1].lastApiSync!.getTime();
            intervals.push((current - next) / (1000 * 60)); // Convert to minutes
        }

        // Return average interval
        return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    } catch (error) {
        logger.error('Failed to calculate average sync interval', error);
        return 0;
    }
}

/**
 * Output health status
 */
function outputHealthStatus(status: HealthStatus, options: HealthCheckOptions): void {
    if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }

    // Human-readable output
    const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        critical: '❌',
    }[status.status];

    console.log(`\n${statusEmoji} Shipment Sync Health Status: ${status.status.toUpperCase()}`);
    console.log(`📅 Checked at: ${status.timestamp}\n`);

    // Metrics
    console.log('📊 Metrics:');
    console.log(`  📦 Total shipments: ${status.metrics.totalShipments}`);
    console.log(`  🚚 Active shipments: ${status.metrics.activeShipments}`);
    console.log(`  🔗 With API tracking: ${status.metrics.shipmentsWithApiTracking}`);
    console.log(`  🕐 Last sync: ${status.metrics.lastSyncTime || 'Never'}`);
    console.log(`  📈 Recent syncs: ${status.metrics.recentSyncCount}`);
    if (options.checkStale) {
        console.log(`  ⏰ Stale shipments: ${status.metrics.staleShipmentCount}`);
    }
    console.log(`  ❌ Error rate: ${status.metrics.errorRatePercent.toFixed(1)}%`);
    console.log(`  ⏱️  Avg sync interval: ${status.metrics.avgSyncInterval.toFixed(1)} minutes`);

    // Checks
    console.log('\n🔍 Health Checks:');
    console.log(`  ${status.checks.apiConnection ? '✅' : '❌'} API Connection`);
    console.log(`  ${status.checks.recentSyncActivity ? '✅' : '❌'} Recent Sync Activity`);
    console.log(`  ${status.checks.staleShipments ? '✅' : '❌'} Stale Shipments Check`);
    console.log(`  ${status.checks.errorRate ? '✅' : '❌'} Error Rate Check`);

    // Alerts
    if (status.alerts.length > 0) {
        console.log('\n🚨 Alerts:');
        status.alerts.forEach(alert => console.log(`  - ${alert}`));
    }

    // Recommendations
    if (status.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        status.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs(): HealthCheckOptions {
    const args = process.argv.slice(2);
    const options: HealthCheckOptions = {};

    for (const arg of args) {
        if (arg === '--check-stale') {
            options.checkStale = true;
        } else if (arg === '--json') {
            options.json = true;
        } else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        } else if (arg.startsWith('--alert-threshold=')) {
            const threshold = parseInt(arg.split('=')[1]);
            if (!isNaN(threshold) && threshold > 0) {
                options.alertThreshold = threshold;
            }
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }
    }

    return options;
}

/**
 * Show help information
 */
function showHelp(): void {
    console.log(`
🏥 Shipment Sync Health Monitor

Usage:
  tsx scripts/monitor-sync-health.ts [options]

Options:
  --help, -h              Show this help message
  --check-stale           Check for stale shipments that haven't been synced
  --alert-threshold=N     Hours threshold for alerts (default: 2)
  --json                  Output results in JSON format
  --verbose, -v           Show detailed output

Examples:
  # Basic health check
  tsx scripts/monitor-sync-health.ts

  # Check with stale shipment detection
  tsx scripts/monitor-sync-health.ts --check-stale

  # JSON output for monitoring systems
  tsx scripts/monitor-sync-health.ts --json

  # Custom alert threshold (4 hours)
  tsx scripts/monitor-sync-health.ts --alert-threshold=4

Health Check Integration:
  # Use in monitoring systems
  if tsx scripts/monitor-sync-health.ts --json | jq -r '.status' | grep -q 'healthy'; then
    echo "System is healthy"
  else
    echo "System needs attention"
  fi

  # Exit codes:
  # 0 = Healthy
  # 1 = Warning
  # 2 = Critical
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        const options = parseArgs();

        if (options.verbose) {
            logger.info('Health check options', options);
        }

        const healthStatus = await performHealthCheck(options);
        outputHealthStatus(healthStatus, options);

        // Exit with appropriate code for monitoring systems
        switch (healthStatus.status) {
            case 'healthy':
                process.exit(0);
            case 'warning':
                process.exit(1);
            case 'critical':
                process.exit(2);
            default:
                process.exit(1);
        }

    } catch (error) {
        logger.error('Health check failed', error);
        console.error('\n💥 Health check failed:', error);
        process.exit(2);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}