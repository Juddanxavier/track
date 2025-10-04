/** @format */

/**
 * Structured logging utility for shipment synchronization operations
 * Provides consistent logging format for background jobs and monitoring
 */

export interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    operation: string;
    message: string;
    metadata?: Record<string, any>;
    duration?: number;
    shipmentId?: string;
    trackingCode?: string;
}

export class SyncLogger {
    private context: string;

    constructor(context: string = 'sync') {
        this.context = context;
    }

    /**
     * Log an info message
     */
    info(message: string, metadata?: Record<string, any>): void {
        this.log('info', message, metadata);
    }

    /**
     * Log a warning message
     */
    warn(message: string, metadata?: Record<string, any>): void {
        this.log('warn', message, metadata);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
        const errorMetadata = {
            ...metadata,
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : String(error),
        };
        this.log('error', message, errorMetadata);
    }

    /**
     * Log a debug message (only in verbose mode)
     */
    debug(message: string, metadata?: Record<string, any>): void {
        if (process.env.SYNC_VERBOSE === 'true' || process.argv.includes('--verbose')) {
            this.log('debug', message, metadata);
        }
    }

    /**
     * Log operation start
     */
    startOperation(operation: string, metadata?: Record<string, any>): () => void {
        const startTime = Date.now();
        this.info(`Starting ${operation}`, metadata);

        return () => {
            const duration = Date.now() - startTime;
            this.info(`Completed ${operation}`, { ...metadata, duration });
        };
    }

    /**
     * Log shipment-specific operation
     */
    shipment(
        level: 'info' | 'warn' | 'error',
        shipmentId: string,
        trackingCode: string,
        message: string,
        metadata?: Record<string, any>
    ): void {
        this.log(level, message, {
            ...metadata,
            shipmentId,
            trackingCode,
        });
    }

    /**
     * Log sync statistics
     */
    stats(stats: {
        totalProcessed: number;
        successful: number;
        failed: number;
        duration: number;
        errors?: Array<{ shipmentId: string; error: string }>;
    }): void {
        this.info('Sync statistics', {
            totalProcessed: stats.totalProcessed,
            successful: stats.successful,
            failed: stats.failed,
            duration: stats.duration,
            successRate: stats.totalProcessed > 0
                ? ((stats.successful / stats.totalProcessed) * 100).toFixed(2) + '%'
                : '0%',
            errorCount: stats.errors?.length || 0,
        });

        if (stats.errors && stats.errors.length > 0) {
            this.error('Sync errors occurred', undefined, {
                errorDetails: stats.errors,
            });
        }
    }

    /**
     * Core logging method
     */
    private log(level: LogEntry['level'], message: string, metadata?: Record<string, any>): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            operation: this.context,
            message,
            metadata,
        };

        // Format for console output
        const emoji = this.getLevelEmoji(level);
        const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';

        const logMessage = `${emoji} [${entry.timestamp}] ${this.context.toUpperCase()}: ${message}${metadataStr}`;

        // Output to appropriate console method
        switch (level) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'debug':
                console.debug(logMessage);
                break;
            default:
                console.log(logMessage);
        }

        // In production, you might want to send to external logging service
        if (process.env.NODE_ENV === 'production') {
            this.sendToExternalLogger(entry);
        }
    }

    /**
     * Get emoji for log level
     */
    private getLevelEmoji(level: LogEntry['level']): string {
        switch (level) {
            case 'info':
                return 'ℹ️';
            case 'warn':
                return '⚠️';
            case 'error':
                return '❌';
            case 'debug':
                return '🔍';
            default:
                return '📝';
        }
    }

    /**
     * Send log entry to external logging service (placeholder)
     * In a real implementation, this would send to services like:
     * - CloudWatch Logs
     * - Datadog
     * - New Relic
     * - Sentry
     * - Custom logging endpoint
     */
    private sendToExternalLogger(entry: LogEntry): void {
        // Placeholder for external logging integration
        // Example implementations:

        // For file-based logging:
        // fs.appendFileSync('/var/log/shipment-sync.json', JSON.stringify(entry) + '\n');

        // For HTTP logging service:
        // fetch('https://logs.yourservice.com/api/logs', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(entry)
        // }).catch(console.error);

        // For now, just ensure the entry is properly formatted
        if (entry.level === 'error') {
            // Could trigger alerts or notifications here
        }
    }
}

/**
 * Create a logger instance for sync operations
 */
export function createSyncLogger(context: string = 'sync'): SyncLogger {
    return new SyncLogger(context);
}

/**
 * Default sync logger instance
 */
export const syncLogger = new SyncLogger('shipment-sync');