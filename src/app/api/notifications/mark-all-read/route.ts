/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';

// POST /api/notifications/mark-all-read - Mark all notifications as read
export async function POST(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await notificationService.markAllAsRead(session.user.id);

        return NextResponse.json({
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark all notifications as read' },
            { status: 500 }
        );
    }
}