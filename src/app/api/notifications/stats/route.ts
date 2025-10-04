/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { notifications, users } from '@/database/schema';
import { count, eq, and, or, isNull, gt, sql } from 'drizzle-orm';

// GET /api/notifications/stats - Get notification statistics (admin only)
export async function GET(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        if (!['admin', 'super-admin'].includes(session.user.role || '')) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get total notifications count
        const [{ totalNotifications }] = await db
            .select({ totalNotifications: count() })
            .from(notifications)
            .where(
                or(
                    isNull(notifications.expiresAt),
                    gt(notifications.expiresAt, new Date())
                )
            );

        // Get unread notifications count
        const [{ unreadNotifications }] = await db
            .select({ unreadNotifications: count() })
            .from(notifications)
            .where(
                and(
                    eq(notifications.read, false),
                    or(
                        isNull(notifications.expiresAt),
                        gt(notifications.expiresAt, new Date())
                    )
                )
            );

        // Get notifications by type
        const notificationsByType = await db
            .select({
                type: notifications.type,
                count: count()
            })
            .from(notifications)
            .where(
                or(
                    isNull(notifications.expiresAt),
                    gt(notifications.expiresAt, new Date())
                )
            )
            .groupBy(notifications.type);

        // Get active users count (users who have received notifications in the last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [{ activeUsers }] = await db
            .select({ activeUsers: sql<number>`COUNT(DISTINCT ${notifications.userId})` })
            .from(notifications)
            .where(
                and(
                    gt(notifications.createdAt, thirtyDaysAgo),
                    or(
                        isNull(notifications.expiresAt),
                        gt(notifications.expiresAt, new Date())
                    )
                )
            );

        // Convert notifications by type to object
        const notificationsByTypeObj: Record<string, number> = {};
        notificationsByType.forEach(item => {
            notificationsByTypeObj[item.type] = item.count;
        });

        return NextResponse.json({
            totalNotifications,
            unreadNotifications,
            notificationsByType: notificationsByTypeObj,
            activeUsers,
        });
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notification stats' },
            { status: 500 }
        );
    }
}