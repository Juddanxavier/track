/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';

// PATCH /api/notifications/[id] - Mark notification as read
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notificationId } = await params;
        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        await notificationService.markAsRead(notificationId, session.user.id);

        return NextResponse.json({
            message: 'Notification marked as read',
            id: notificationId
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark notification as read' },
            { status: 500 }
        );
    }
}

// DELETE /api/notifications/[id] - Delete notification
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notificationId } = await params;
        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        await notificationService.deleteNotification(notificationId, session.user.id);

        return NextResponse.json({
            message: 'Notification deleted',
            id: notificationId
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json(
            { error: 'Failed to delete notification' },
            { status: 500 }
        );
    }
}