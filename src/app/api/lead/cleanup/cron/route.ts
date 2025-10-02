/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { leadCleanupService } from '@/lib/leadCleanupService';
import { z } from 'zod';

const cronRequestSchema = z.object({
    archiveDays: z.number().min(1).max(365).optional(),
    force: z.boolean().optional().default(false),
});

/**
 * Secure API endpoint for external scheduler triggers
 * 
 * This endpoint allows external schedulers (like Vercel Cron, GitHub Actions, 
 * or external cron services) to trigger the cleanup process.
 * 
 * Security:
 * - Requires CRON_SECRET environment variable
 * - Uses Bearer token authentication
 * - Rate limiting should be implemented at the infrastructure level
 * 
 * Usage:
 *   POST /api/lead/cleanup/cron
 *   Authorization: Bearer <CRON_SECRET>
 *   Content-Type: application/json
 *   
 *   Body (optional):
 *   {
 *     "archiveDays": 90,
 *     "force": false
 *   }
 */
export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('CRON_SECRET environment variable is not set');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (token !== cronSecret) {
            console.error('Invalid cron secret provided');
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Parse request body
        let body = {};
        try {
            const rawBody = await request.text();
            if (rawBody) {
                body = JSON.parse(rawBody);
            }
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }

        const { archiveDays, force } = cronRequestSchema.parse(body);

        // Check if cleanup is enabled (unless forced)
        if (!force) {
            const config = await leadCleanupService.getCleanupConfig();
            if (!config.isEnabled) {
                return NextResponse.json({
                    message: 'Cleanup is disabled in configuration',
                    skipped: true,
                    summary: {
                        deletedCount: 0,
                        archivedCount: 0,
                        errors: [],
                        runAt: new Date(),
                    },
                });
            }
        }

        // Run the cleanup
        console.log('🧹 Running scheduled cleanup via API endpoint...');
        const summary = await leadCleanupService.runScheduledCleanup(archiveDays);

        console.log('✅ Cleanup completed via API:', summary);

        return NextResponse.json({
            message: 'Cleanup completed successfully',
            summary,
        });
    } catch (error) {
        console.error('Error in cron cleanup endpoint:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid request parameters',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        // Send failure notification
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

        return NextResponse.json(
            {
                error: 'Cleanup failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * Health check endpoint for monitoring
 */
export async function GET(request: NextRequest) {
    try {
        // Verify authentication for health check too
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        if (token !== cronSecret) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Get cleanup configuration and status
        const config = await leadCleanupService.getCleanupConfig();

        // Get recent cleanup log entries to check if cleanup is working
        const recentLog = await leadCleanupService.getCleanupLog(1, 5);

        return NextResponse.json({
            status: 'healthy',
            config: {
                isEnabled: config.isEnabled,
                failedLeadRetentionDays: config.failedLeadRetentionDays,
                successLeadArchiveDays: config.successLeadArchiveDays,
                lastRunAt: config.lastRunAt,
            },
            recentActivity: {
                totalLogEntries: recentLog.pagination.total,
                lastEntries: recentLog.entries.slice(0, 3).map(entry => ({
                    action: entry.action,
                    performedAt: entry.performedAt,
                    leadId: entry.leadId,
                })),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error in cron health check:', error);
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}