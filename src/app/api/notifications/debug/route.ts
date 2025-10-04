/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notificationService';
import { notificationTemplateManager } from '@/lib/notificationTemplateManager';

import { NOTIFICATION_TYPES } from '@/types/notification';
import { auth } from '@/lib/auth';

/**
 * Debug endpoint for testing notification system
 * GET /api/notifications/debug - Get system status
 * POST /api/notifications/debug - Create test notification
 */

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only allow admin users to access debug endpoint
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get system status
        const userNotifications = await notificationService.getUserNotifications(session.user.id, { perPage: 5 });
        const userPreferences = await notificationService.getUserPreferences(session.user.id);
        // Note: SSE connection stats disabled - using polling system
        const connectionStats = { totalConnections: 0, uniqueUsers: 0, connectionDetails: [] };
        const connectionCount = 0;
        const hasConnection = false;

        // Test template rendering
        const testTemplate = await notificationTemplateManager.getRenderedNotification(
            NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
            {
                deletedCount: 10,
                archivedCount: 5,
                hasErrors: false
            }
        );

        const adminTypes = await notificationTemplateManager.getNotificationTypesForRole('admin');
        const customerTypes = await notificationTemplateManager.getNotificationTypesForRole('customer');

        return NextResponse.json({
            status: 'healthy',
            user: {
                id: session.user.id,
                email: session.user.email,
                role: session.user.role,
            },
            notifications: {
                total: userNotifications.notifications.length,
                unread: userNotifications.unreadCount,
                recent: userNotifications.notifications.slice(0, 3).map(n => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    read: n.read,
                    createdAt: n.createdAt,
                })),
            },
            preferences: {
                total: userPreferences.length,
                enabled: userPreferences.filter(p => p.enabled).length,
            },
            connections: {
                total: connectionCount,
                userConnected: hasConnection,
            },
            templates: {
                adminTypes: adminTypes.length,
                customerTypes: customerTypes.length,
                testRender: testTemplate ? {
                    title: testTemplate.title,
                    message: testTemplate.message,
                    priority: testTemplate.priority,
                } : null,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only allow admin users to create test notifications
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { type, data, targetUserId } = body;

        // Use current user if no target specified
        const userId = targetUserId || session.user.id;

        // Validate notification type
        if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        // Create test notification
        await notificationTemplateManager.createNotificationFromTemplate(
            userId,
            type,
            data || {},
            {
                priority: 'normal',
            }
        );

        // Get updated notification count
        const updatedNotifications = await notificationService.getUserNotifications(userId, { perPage: 1 });

        return NextResponse.json({
            success: true,
            message: 'Test notification created',
            notification: {
                type,
                targetUserId: userId,
                unreadCount: updatedNotifications.unreadCount,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Debug notification creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create test notification', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}