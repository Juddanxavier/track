/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';

// GET /api/notifications/recent - Get recent notifications for dropdown
export async function GET(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const notifications = await notificationService.getRecentNotifications(session.user.id);

        return NextResponse.json({ notifications });
    } catch (error) {
        console.error('Error fetching recent notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch recent notifications' },
            { status: 500 }
        );
    }
}