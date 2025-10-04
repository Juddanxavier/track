/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/helpers/authHelpers';
import { signupReminderService } from '@/lib/signupReminderService';
import { z } from 'zod';

const reminderConfigSchema = z.object({
    reminderAfterDays: z.number().min(1).max(30).optional().default(3),
    maxReminders: z.number().min(1).max(10).optional().default(2),
    action: z.enum(['send_reminders', 'cleanup_expired', 'get_stats']).optional().default('send_reminders'),
});

export async function POST(req: NextRequest) {
    try {
        // Check admin authorization
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();

        // Validate request body
        const parsed = reminderConfigSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { reminderAfterDays, maxReminders, action } = parsed.data;

        switch (action) {
            case 'send_reminders': {
                const results = await signupReminderService.sendSignupReminders(
                    reminderAfterDays,
                    maxReminders
                );

                return NextResponse.json({
                    message: 'Signup reminders processed',
                    action: 'send_reminders',
                    config: {
                        reminderAfterDays,
                        maxReminders,
                    },
                    results: {
                        remindersSent: results.remindersSent,
                        errorsCount: results.errors.length,
                        processed: results.processed,
                        errors: results.errors,
                    },
                });
            }

            case 'cleanup_expired': {
                const results = await signupReminderService.cleanupExpiredSignupTokens();

                return NextResponse.json({
                    message: 'Expired signup tokens cleaned up',
                    action: 'cleanup_expired',
                    results: {
                        cleanedUp: results.cleanedUp,
                        errorsCount: results.errors.length,
                        errors: results.errors,
                    },
                });
            }

            case 'get_stats': {
                const stats = await signupReminderService.getSignupStats();

                return NextResponse.json({
                    message: 'Signup statistics retrieved',
                    action: 'get_stats',
                    stats,
                });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

    } catch (error) {
        console.error('Error processing signup reminders:', error);
        return NextResponse.json(
            { error: 'Failed to process signup reminders' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Check admin authorization
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Get signup statistics
        const stats = await signupReminderService.getSignupStats();

        return NextResponse.json({
            message: 'Signup statistics retrieved',
            stats,
            endpoints: {
                sendReminders: 'POST /api/shipments/signup-reminders with action: "send_reminders"',
                cleanupExpired: 'POST /api/shipments/signup-reminders with action: "cleanup_expired"',
                getStats: 'GET /api/shipments/signup-reminders',
            },
        });

    } catch (error) {
        console.error('Error getting signup statistics:', error);
        return NextResponse.json(
            { error: 'Failed to get signup statistics' },
            { status: 500 }
        );
    }
}