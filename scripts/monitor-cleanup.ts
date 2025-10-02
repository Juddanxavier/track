#!/usr/bin/env tsx
/** @format */

/**
 * Lead Cleanup Monitoring Script
 * 
 * This script monitors the health of the lead cleanup system and can send alerts
 * when issues are detected.
 * 
 * Usage:
 *   npx tsx scripts/monitor-cleanup.ts
 *   npx tsx scripts/monitor-cleanup.ts --check-health
 *   npx tsx scripts/monitor-cleanup.ts --alert-threshold=24
 */

import 'dotenv/config';
import { leadCleanupService } from '../src/lib/leadCleanupService';

interface MonitoringOptions {
    checkHealth?: boolean;
    alertThreshold?: number; // hours since last successful run
    verbose?: boolean;
}

interface HealthStatus {
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
    lastRunAt?: Date;
    timeSinceLastRun?: number; // hours
    recentErrors: number;
    config: {
        isEnabled: boolean;
        failedLeadRetentionDays: number;
        successLeadArchiveDays: number;
    };
}

async function checkSystemHealth(options: MonitoringOptions): Promise<HealthStatus> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
        // Check configuration
        const config = await leadCleanupService.getCleanupConfig();

        if (!config.isEnabled) {
            warnings.push('Cleanup system is disabled in configuration');
        }

        // Check recent cleanup activity
        const recentLog = await leadCleanupService.getCleanupLog(1, 10);
        const now = new Date();
        let lastRunAt: Date | undefined;
        let timeSinceLastRun: number | undefined;

        if (recentLog.entries.length > 0) {
            lastRunAt = recentLog.entries[0].performedAt;
            timeSinceLastRun = (now.getTime() - lastRunAt.getTime()) / (1000 * 60 * 60); // hours

            const alertThreshold = options.alertThreshold || 25; // Default: 25 hours (daily + 1 hour buffer)

            if (timeSinceLastRun > alertThreshold) {
                issues.push(`No cleanup activity for ${timeSinceLastRun.toFixed(1)} hours (threshold: ${alertThreshold}h)`);
            }
        } else {
            issues.push('No cleanup activity found in logs');
        }

        // Check for recent errors
        const recentErrors = recentLog.entries.filter(entry =>
            entry.reason.toLowerCase().includes('error') ||
            entry.reason.toLowerCase().includes('failed')
        ).length;

        if (recentErrors > 0) {
            warnings.push(`${recentErrors} error entries found in recent cleanup logs`);
        }

        // Check database connectivity by trying to identify leads
        try {
            await leadCleanupService.identifyLeadsForDeletion();
            await leadCleanupService.identifyLeadsForArchival();
        } catch (dbError) {
            issues.push(`Database connectivity issue: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
        }

        return {
            isHealthy: issues.length === 0,
            issues,
            warnings,
            lastRunAt,
            timeSinceLastRun,
            recentErrors,
            config: {
                isEnabled: config.isEnabled,
                failedLeadRetentionDays: config.failedLeadRetentionDays,
                successLeadArchiveDays: config.successLeadArchiveDays,
            },
        };
    } catch (error) {
        issues.push(`System check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

        return {
            isHealthy: false,
            issues,
            warnings,
            recentErrors: 0,
            config: {
                isEnabled: false,
                failedLeadRetentionDays: 0,
                successLeadArchiveDays: 0,
            },
        };
    }
}

async function sendAlert(status: HealthStatus): Promise<void> {
    // This is a placeholder for alert functionality
    // In a real implementation, you would integrate with:
    // - Email services (SendGrid, AWS SES, etc.)
    // - Slack/Discord webhooks
    // - PagerDuty, Datadog, or other monitoring services
    // - SMS services

    const alertMessage = `
🚨 Lead Cleanup System Alert

Status: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}

Issues:
${status.issues.map(issue => `• ${issue}`).join('\n')}

Warnings:
${status.warnings.map(warning => `• ${warning}`).join('\n')}

Configuration:
• Enabled: ${status.config.isEnabled}
• Failed lead retention: ${status.config.failedLeadRetentionDays} days
• Success lead archive: ${status.config.successLeadArchiveDays} days

Last Run: ${status.lastRunAt ? status.lastRunAt.toISOString() : 'Never'}
Time Since Last Run: ${status.timeSinceLastRun ? `${status.timeSinceLastRun.toFixed(1)} hours` : 'N/A'}

Timestamp: ${new Date().toISOString()}
  `.trim();

    console.log('📧 Alert Message:');
    console.log(alertMessage);

    // TODO: Implement actual alert sending
    // Example integrations:

    // Slack webhook
    // if (process.env.SLACK_WEBHOOK_URL) {
    //   await fetch(process.env.SLACK_WEBHOOK_URL, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ text: alertMessage }),
    //   });
    // }

    // Email via SendGrid
    // if (process.env.SENDGRID_API_KEY && process.env.ALERT_EMAIL) {
    //   // Send email using SendGrid API
    // }

    console.log('⚠️  Alert sending not implemented. Configure your preferred notification method.');
}

async function generateReport(status: HealthStatus): Promise<void> {
    console.log('📊 Lead Cleanup System Health Report');
    console.log('=====================================');
    console.log();

    console.log(`🏥 Overall Health: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log();

    if (status.issues.length > 0) {
        console.log('🚨 Issues:');
        status.issues.forEach(issue => console.log(`   • ${issue}`));
        console.log();
    }

    if (status.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        status.warnings.forEach(warning => console.log(`   • ${warning}`));
        console.log();
    }

    console.log('⚙️  Configuration:');
    console.log(`   • Cleanup enabled: ${status.config.isEnabled}`);
    console.log(`   • Failed lead retention: ${status.config.failedLeadRetentionDays} days`);
    console.log(`   • Success lead archive: ${status.config.successLeadArchiveDays} days`);
    console.log();

    console.log('📈 Activity:');
    console.log(`   • Last cleanup run: ${status.lastRunAt ? status.lastRunAt.toLocaleString() : 'Never'}`);
    if (status.timeSinceLastRun !== undefined) {
        console.log(`   • Time since last run: ${status.timeSinceLastRun.toFixed(1)} hours`);
    }
    console.log(`   • Recent error entries: ${status.recentErrors}`);
    console.log();

    // Get some statistics
    try {
        const leadsToDelete = await leadCleanupService.identifyLeadsForDeletion();
        const leadsToArchive = await leadCleanupService.identifyLeadsForArchival();

        console.log('📋 Pending Actions:');
        console.log(`   • Leads ready for deletion: ${leadsToDelete.length}`);
        console.log(`   • Leads ready for archival: ${leadsToArchive.length}`);
        console.log();
    } catch (error) {
        console.log('❌ Could not retrieve pending actions statistics');
        console.log();
    }

    console.log(`🕐 Report generated: ${new Date().toLocaleString()}`);
}

async function main() {
    const args = process.argv.slice(2);
    const options: MonitoringOptions = {
        checkHealth: args.includes('--check-health'),
        alertThreshold: parseInt(args.find(arg => arg.startsWith('--alert-threshold='))?.split('=')[1] || '25'),
        verbose: args.includes('--verbose'),
    };

    try {
        console.log('🔍 Monitoring lead cleanup system...');

        const status = await checkSystemHealth(options);

        if (options.verbose || !status.isHealthy || status.warnings.length > 0) {
            await generateReport(status);
        }

        // Send alerts if there are issues
        if (!status.isHealthy) {
            await sendAlert(status);
            process.exit(1); // Exit with error code for monitoring systems
        }

        if (options.checkHealth) {
            console.log('✅ System is healthy');
        }

        process.exit(0);
    } catch (error) {
        console.error('💥 Monitoring failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring interrupted');
    process.exit(0);
});

main();