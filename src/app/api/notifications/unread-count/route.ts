/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';


// GET /api/notifications/unread-count - Get unread notification count for authenticated user
export async function GET(req: NextRequest) {
    try {
        // Authenticate the user
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Get unread count from notification service
        const unreadCount = await notificationService.getUnreadCount(userId);

        // Check if real-time update is requested
        const searchParams = req.nextUrl.searchParams;
        const broadcast = searchParams.get('broadcast') === 'true';

        // Note: broadcast parameter ignored - using polling system

        return NextResponse.json({
            unreadCount,
            userId,
            timestamp: new Date().toISOString(),
            broadcast: broadcast || false
        });

    } catch (error) {
        console.error('Error fetching unread count:', error);
        return NextResponse.json(
            { error: 'Failed to fetch unread count' },
            { status: 500 }
        );
    }
}

// POST /api/notifications/unread-count - Force broadcast unread count update via SSE
export async function POST(req: NextRequest) {
    try {
        // Authenticate the user
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Get current unread count
        const unreadCount = await notificationService.getUnreadCount(userId);

        // Note: Broadcasting disabled - using polling system
        const sent = 0;

        return NextResponse.json({
            unreadCount,
            userId,
            sent,
            timestamp: new Date().toISOString(),
            message: sent
                ? `Unread count update broadcasted to user connections`
                : `No active connections found for user`
        });

    } catch (error) {
        console.error('Error broadcasting unread count:', error);
        return NextResponse.json(
            { error: 'Failed to broadcast unread count' },
            { status: 500 }
        );
    }
}

// PATCH /api/notifications/unread-count - Optimistic unread count update
export async function PATCH(req: NextRequest) {
    try {
        // Authenticate the user
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const { delta, operation } = body; // delta: number, operation: 'increment' | 'decrement' | 'set'

        // Get current unread count
        let currentCount = await notificationService.getUnreadCount(userId);
        let newCount = currentCount;

        // Apply the operation
        switch (operation) {
            case 'increment':
                newCount = currentCount + (delta || 1);
                break;
            case 'decrement':
                newCount = Math.max(0, currentCount - (delta || 1));
                break;
            case 'set':
                newCount = Math.max(0, delta || 0);
                break;
            default:
                return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
        }

        // Note: Broadcasting disabled - using polling system
        const sent = 0;

        // Return the optimistic count (actual count will be updated by the next real operation)
        return NextResponse.json({
            unreadCount: newCount,
            previousCount: currentCount,
            operation,
            delta,
            userId,
            sent,
            optimistic: true,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error updating unread count optimistically:', error);
        return NextResponse.json(
            { error: 'Failed to update unread count' },
            { status: 500 }
        );
    }
}