/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';
import { z } from 'zod';

const updatePreferenceSchema = z.object({
    enabled: z.boolean(),
    emailEnabled: z.boolean().default(false),
});

// GET /api/notifications/preferences/[type] - Get specific notification preference
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type: notificationType } = await params;
        if (!notificationType) {
            return NextResponse.json(
                { error: 'Notification type is required' },
                { status: 400 }
            );
        }

        const preference = await notificationService.getUserPreference(
            session.user.id,
            notificationType
        );

        if (!preference) {
            return NextResponse.json(
                { error: 'Preference not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ preference });
    } catch (error) {
        console.error('Error fetching notification preference:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notification preference' },
            { status: 500 }
        );
    }
}

// PUT /api/notifications/preferences/[type] - Update specific notification preference
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type: notificationType } = await params;
        if (!notificationType) {
            return NextResponse.json(
                { error: 'Notification type is required' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const parsed = updatePreferenceSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { enabled, emailEnabled } = parsed.data;

        const updatedPreference = await notificationService.updateUserPreference(
            session.user.id,
            notificationType,
            enabled,
            emailEnabled
        );

        return NextResponse.json({
            preference: updatedPreference,
            message: 'Preference updated successfully'
        });
    } catch (error) {
        console.error('Error updating notification preference:', error);
        return NextResponse.json(
            { error: 'Failed to update notification preference' },
            { status: 500 }
        );
    }
}