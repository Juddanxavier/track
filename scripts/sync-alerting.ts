#!/usr/bin/env tsx
/** @format */

/**
 * Alerting utility for shipment sync monitoring
 * 
 * This script can be used to send alerts when sync issues are detected.
 * It integrates with the health monitoring system and can send notifications
 * via email, Slack, webhooks, or other channels.
 * 
 * Usage:
 *   npm run sync-alert
 *   tsx scripts/sync-alerting.ts --check-and-alert
 *   tsx scripts/sync-alerting.ts --test-alert
 */

import { createSyncLogger } from '../src/lib/syncLogger';

interface AlertConfig {
    email?: {
        enabled: boolean;
        recipients: string[];
        smtpConfig?: {
            host: string;
            port: number;
            secure: boolean;
            auth: {
                user: string;
                pass: string;
            };
        };
    };
    slack?: {
        enabled: boolean;
        webhookUrl: string;
        channel?: string;
    };
    webhook?: {
        enabled: boolean;
        url: string;
        headers?: Record<string, string>;
    };
    console?: {
        enabled: boolean;
    };
}

interface AlertMessage {
    level: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

const logger = createSyncLogger('alerting');

/**
 * Get alert configuration from environment variables
 */
function getAlertConfig(): AlertConfig {
    return {
        email: {
            enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
            recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
            smtpConfig: process.env.ALERT_SMTP_HOST ? {
                host: process.env.ALERT_SMTP_HOST,
                port: parseInt(process.env.ALERT_SMTP_PORT || '587'),
                secure: process.env.ALERT_SMTP_SECURE === 'true',
                auth: {
                    user: process.env.ALERT_SMTP_USER || '',
                    pass: process.env.ALERT_SMTP_PASS || '',
                },
            } : undefined,
        },
        slack: {
            enabled: process.env.ALERT_SLACK_ENABLED === 'true',
            webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL || '',
            channel: process.env.ALERT_SLACK_CHANNEL,
        },
        webhook: {
            enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
            url: process.env.ALERT_WEBHOOK_URL || '',
            headers: process.env.ALERT_WEBHOOK_HEADERS ?
                JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) : undefined,
        },
        console: {
            enabled: true, // Always enabled as fallback
        },
    };
}

/**
 * Send alert through configured channels
 */
async function sendAlert(alert: AlertMessage, config: AlertConfig): Promise<void> {
    const promises: Promise<void>[] = [];

    // Console alert (always enabled as fallback)
    if (config.console?.enabled) {
        promises.push(sendConsoleAlert(alert));
    }

    // Email alert
    if (config.email?.enabled && config.email.recipients.length > 0) {
        promises.push(sendEmailAlert(alert, config.email));
    }

    // Slack alert
    if (config.slack?.enabled && config.slack.webhookUrl) {
        promises.push(sendSlackAlert(alert, config.slack));
    }

    // Webhook alert
    if (config.webhook?.enabled && config.webhook.url) {
        promises.push(sendWebhookAlert(alert, config.webhook));
    }

    // Send all alerts concurrently
    const results = await Promise.allSettled(promises);

    // Log any failures
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.error(`Alert channel ${index} failed`, result.reason);
        }
    });
}

/**
 * Send console alert
 */
async function sendConsoleAlert(alert: AlertMessage): Promise<void> {
    const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
    }[alert.level];

    console.log(`\n${emoji} ALERT [${alert.timestamp}]: ${alert.title}`);
    console.log(`Level: ${alert.level.toUpperCase()}`);
    console.log(`Message: ${alert.message}`);

    if (alert.metadata) {
        console.log('Details:', JSON.stringify(alert.metadata, null, 2));
    }
    console.log('');
}

/**
 * Send email alert (placeholder - requires email library)
 */
async function sendEmailAlert(alert: AlertMessage, config: AlertConfig['email']): Promise<void> {
    // This is a placeholder implementation
    // In a real implementation, you would use a library like nodemailer

    logger.info('Email alert would be sent', {
        recipients: config?.recipients,
        subject: `[${alert.level.toUpperCase()}] ${alert.title}`,
        alert,
    });

    // Example implementation with nodemailer:
    /*
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter(config.smtpConfig);
    
    const mailOptions = {
        from: config.smtpConfig.auth.user,
        to: config.recipients.join(','),
        subject: `[${alert.level.toUpperCase()}] Shipment Sync Alert: ${alert.title}`,
        html: `
            <h2>${alert.title}</h2>
            <p><strong>Level:</strong> ${alert.level.toUpperCase()}</p>
            <p><strong>Time:</strong> ${alert.timestamp}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            ${alert.metadata ? `<pre>${JSON.stringify(alert.metadata, null, 2)}</pre>` : ''}
        `,
    };
    
    await transporter.sendMail(mailOptions);
    */
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(alert: AlertMessage, config: AlertConfig['slack']): Promise<void> {
    const color = {
        info: '#36a64f',
        warning: '#ff9500',
        critical: '#ff0000',
    }[alert.level];

    const payload = {
        channel: config?.channel,
        username: 'Shipment Sync Monitor',
        icon_emoji: ':truck:',
        attachments: [
            {
                color,
                title: alert.title,
                text: alert.message,
                fields: [
                    {
                        title: 'Level',
                        value: alert.level.toUpperCase(),
                        short: true,
                    },
                    {
                        title: 'Time',
                        value: alert.timestamp,
                        short: true,
                    },
                ],
                footer: 'Shipment Sync Monitor',
                ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
            },
        ],
    };

    if (alert.metadata) {
        payload.attachments[0].fields.push({
            title: 'Details',
            value: `\`\`\`${JSON.stringify(alert.metadata, null, 2)}\`\`\``,
            short: false,
        });
    }

    try {
        const response = await fetch(config?.webhookUrl || '', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
        }

        logger.info('Slack alert sent successfully');
    } catch (error) {
        logger.error('Failed to send Slack alert', error);
        throw error;
    }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(alert: AlertMessage, config: AlertConfig['webhook']): Promise<void> {
    const payload = {
        type: 'shipment_sync_alert',
        alert,
        source: 'shipment-sync-monitor',
        hostname: process.env.HOSTNAME || 'unknown',
    };

    try {
        const response = await fetch(config?.url || '', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config?.headers,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

        logger.info('Webhook alert sent successfully');
    } catch (error) {
        logger.error('Failed to send webhook alert', error);
        throw error;
    }
}

/**
 * Check health and send alerts if needed
 */
async function checkAndAlert(): Promise<void> {
    try {
        // Import health check function
        const { execSync } = require('child_process');

        // Run health check and get JSON output
        const healthOutput = execSync('npm run sync-health:json', {
            encoding: 'utf8',
            cwd: process.cwd(),
        });

        const healthStatus = JSON.parse(healthOutput);
        const config = getAlertConfig();

        // Only send alerts for warning or critical status
        if (healthStatus.status === 'warning' || healthStatus.status === 'critical') {
            const alert: AlertMessage = {
                level: healthStatus.status === 'critical' ? 'critical' : 'warning',
                title: `Shipment Sync ${healthStatus.status === 'critical' ? 'Critical' : 'Warning'}`,
                message: `Shipment synchronization system is in ${healthStatus.status} state with ${healthStatus.alerts.length} alerts.`,
                timestamp: new Date().toISOString(),
                metadata: {
                    status: healthStatus.status,
                    alerts: healthStatus.alerts,
                    recommendations: healthStatus.recommendations,
                    metrics: healthStatus.metrics,
                },
            };

            await sendAlert(alert, config);
            logger.info('Alert sent for health status', { status: healthStatus.status });
        } else {
            logger.info('System is healthy, no alerts needed');
        }

    } catch (error) {
        logger.error('Failed to check health and send alerts', error);

        // Send critical alert about the monitoring system itself
        const config = getAlertConfig();
        const alert: AlertMessage = {
            level: 'critical',
            title: 'Shipment Sync Monitoring Failure',
            message: 'Failed to check shipment sync health status. The monitoring system itself may be down.',
            timestamp: new Date().toISOString(),
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };

        await sendAlert(alert, config);
        throw error;
    }
}

/**
 * Send test alert
 */
async function sendTestAlert(): Promise<void> {
    const config = getAlertConfig();

    const alert: AlertMessage = {
        level: 'info',
        title: 'Shipment Sync Alert Test',
        message: 'This is a test alert to verify the alerting system is working correctly.',
        timestamp: new Date().toISOString(),
        metadata: {
            test: true,
            config: {
                emailEnabled: config.email?.enabled,
                slackEnabled: config.slack?.enabled,
                webhookEnabled: config.webhook?.enabled,
            },
        },
    };

    await sendAlert(alert, config);
    logger.info('Test alert sent');
}

/**
 * Show configuration help
 */
function showConfigHelp(): void {
    console.log(`
🚨 Shipment Sync Alerting Configuration

Environment Variables:

Email Alerts:
  ALERT_EMAIL_ENABLED=true
  ALERT_EMAIL_RECIPIENTS=admin@company.com,ops@company.com
  ALERT_SMTP_HOST=smtp.gmail.com
  ALERT_SMTP_PORT=587
  ALERT_SMTP_SECURE=false
  ALERT_SMTP_USER=your-email@gmail.com
  ALERT_SMTP_PASS=your-app-password

Slack Alerts:
  ALERT_SLACK_ENABLED=true
  ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
  ALERT_SLACK_CHANNEL=#alerts

Webhook Alerts:
  ALERT_WEBHOOK_ENABLED=true
  ALERT_WEBHOOK_URL=https://your-monitoring-system.com/webhooks/alerts
  ALERT_WEBHOOK_HEADERS='{"Authorization":"Bearer token123"}'

Usage Examples:
  # Check health and send alerts if needed
  tsx scripts/sync-alerting.ts --check-and-alert

  # Send test alert
  tsx scripts/sync-alerting.ts --test-alert

  # Show this help
  tsx scripts/sync-alerting.ts --help

Cron Integration:
  # Check and alert every 30 minutes
  */30 * * * * cd /path/to/app && npm run sync-alert >> /var/log/sync-alerts.log 2>&1
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(): { action: string } {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showConfigHelp();
        process.exit(0);
    }

    if (args.includes('--test-alert')) {
        return { action: 'test' };
    }

    if (args.includes('--check-and-alert')) {
        return { action: 'check' };
    }

    // Default action
    return { action: 'check' };
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        const { action } = parseArgs();

        switch (action) {
            case 'test':
                await sendTestAlert();
                console.log('✅ Test alert sent successfully');
                break;
            case 'check':
                await checkAndAlert();
                console.log('✅ Health check and alerting completed');
                break;
            default:
                showConfigHelp();
        }

    } catch (error) {
        logger.error('Alerting script failed', error);
        console.error('❌ Alerting failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}