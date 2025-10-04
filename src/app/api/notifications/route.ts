/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';
import { z } from 'zod';

const querySchema = z.object({
    page: z
        .preprocess((v) => Number(v), z.number().int().min(1).default(1))
        .optional(),
    perPage: z
        .preprocess((v) => Number(v), z.number().int().min(1).max(100).default(20))
        .optional(),
    unreadOnly: z
        .preprocess((v) => v === 'true', z.boolean().default(false))
        .optional(),
    type: z.string().optional(),
    admin: z
        .preprocess((v) => v === 'true', z.boolean().default(false))
        .optional(),
});

const createNotificationSchema = z.object({
    userId: z.string().optional(),
    userIds: z.array(z.string()).optional(),
    type: z.string().min(1, 'Type is required'),
    title: z.string().optional(),
    message: z.string().optional(),
    data: z.any().optional(),
    actionUrl: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal').optional(),
    expiresAt: z.string().datetime().transform(str => new Date(str)).optional(),
}).refine(
    (data) => data.userId || (data.userIds && data.userIds.length > 0),
    {
        message: "Either userId or userIds must be provided",
        path: ["userId"],
    }
);

// GET /api/notifications - Fetch user notifications
export async function GET(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query params', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { page = 1, perPage = 20, unreadOnly = false, type, admin = false } = parsed.data;

        // Check if user is admin for admin requests
        if (admin && !['admin', 'super-admin'].includes(session.user.role || '')) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        let result;
        if (admin) {
            // Admin view - get all notifications
            result = await notificationService.getAllNotifications({
                page,
                perPage,
                unreadOnly,
                type,
            });
        } else {
            // Regular user view
            result = await notificationService.getUserNotifications(
                session.user.id,
                { page, perPage, unreadOnly, type }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

// POST /api/notifications - Create notification (admin only)
export async function POST(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can create notifications via API
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const parsed = createNotificationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const notificationData = parsed.data;

        // Create notification(s)
        if (notificationData.userIds && notificationData.userIds.length > 0) {
            // Multiple users
            const notifications = await notificationService.createNotificationsForUsers(notificationData);
            return NextResponse.json({
                notifications,
                message: `Created ${notifications.length} notifications`
            }, { status: 201 });
        } else if (notificationData.userId) {
            // Single user
            const notification = await notificationService.createNotification(notificationData);
            return NextResponse.json({ notification }, { status: 201 });
        }

        return NextResponse.json(
            { error: 'Either userId or userIds must be provided' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error creating notification:', error);

        if (error instanceof Error) {
            if (error.message.includes('disabled notifications')) {
                return NextResponse.json(
                    { error: 'User has disabled this notification type' },
                    { status: 400 }
                );
            }
            if (error.message.includes('Title and message are required')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to create notification' },
            { status: 500 }
        );
    }
}