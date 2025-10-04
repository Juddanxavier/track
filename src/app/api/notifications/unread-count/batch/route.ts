/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';


// POST /api/notifications/unread-count/batch - Get unread counts for multiple users (admin only)
export async function POST(req: NextRequest) {
    try {
        // Authenticate the user and check admin role
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can get batch unread counts
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { userIds, broadcast = false } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
        }

        if (userIds.length > 100) {
            return NextResponse.json({ error: 'Maximum 100 users allowed per batch request' }, { status: 400 });
        }

        // Get unread counts for all users
        const unreadCounts: Record<string, number> = {};
        const errors: string[] = [];

        for (const userId of userIds) {
            try {
                const count = await notificationService.getUnreadCount(userId);
                unreadCounts[userId] = count;

                // Note: Broadcasting disabled - using polling system
            } catch (error) {
                console.error(`Error getting unread count for user ${userId}:`, error);
                errors.push(`Failed to get count for user ${userId}`);
            }
        }

        return NextResponse.json({
            unreadCounts,
            totalUsers: userIds.length,
            successCount: Object.keys(unreadCounts).length,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined,
            broadcast,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error in batch unread count request:', error);
        return NextResponse.json(
            { error: 'Failed to process batch unread count request' },
            { status: 500 }
        );
    }
}

// GET /api/notifications/unread-count/batch - Get unread count statistics (admin only)
export async function GET(req: NextRequest) {
    try {
        // Authenticate the user and check admin role
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can get batch statistics
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        // Note: Connection statistics disabled - using polling system
        const connectionStats = { totalConnections: 0, uniqueUsers: 0, connectionDetails: [], connectionsPerUser: {} };

        // Get unread count statistics for connected users
        const connectedUserIds = Object.keys(connectionStats.connectionsPerUser);
        const unreadStats: Record<string, number> = {};
        let totalUnreadCount = 0;

        for (const userId of connectedUserIds) {
            try {
                const count = await notificationService.getUnreadCount(userId);
                unreadStats[userId] = count;
                totalUnreadCount += count;
            } catch (error) {
                console.error(`Error getting unread count for connected user ${userId}:`, error);
            }
        }

        return NextResponse.json({
            connectionStats,
            unreadStats,
            summary: {
                totalConnectedUsers: connectedUserIds.length,
                totalUnreadNotifications: totalUnreadCount,
                averageUnreadPerUser: connectedUserIds.length > 0 ? totalUnreadCount / connectedUserIds.length : 0,
                usersWithUnreadNotifications: Object.values(unreadStats).filter(count => count > 0).length,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error getting batch unread count statistics:', error);
        return NextResponse.json(
            { error: 'Failed to get unread count statistics' },
            { status: 500 }
        );
    }
}