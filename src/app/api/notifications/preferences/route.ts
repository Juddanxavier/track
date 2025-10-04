/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { notificationService } from '@/lib/notificationService';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
    preferences: z.array(z.object({
        type: z.string().min(1, 'Type is required'),
        enabled: z.boolean(),
        emailEnabled: z.boolean().default(false),
    })).min(1, 'At least one preference must be provided'),
});

const updateSinglePreferenceSchema = z.object({
    type: z.string().min(1, 'Type is required'),
    enabled: z.boolean(),
    emailEnabled: z.boolean().default(false),
});

// GET /api/notifications/preferences - Get user notification preferences
export async function GET(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const preferences = await notificationService.getUserPreferences(session.user.id);

        return NextResponse.json({ preferences });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notification preferences' },
            { status: 500 }
        );
    }
}

// PUT /api/notifications/preferences - Update user notification preferences
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        // Check if it's a single preference update or bulk update
        const isBulkUpdate = Array.isArray(body.preferences);

        if (isBulkUpdate) {
            const parsed = updatePreferencesSchema.safeParse(body);

            if (!parsed.success) {
                return NextResponse.json(
                    { error: 'Invalid input', details: parsed.error.issues },
                    { status: 400 }
                );
            }

            const { preferences } = parsed.data;
            const updatedPreferences = [];

            // Update each preference
            for (const pref of preferences) {
                try {
                    const updatedPref = await notificationService.updateUserPreference(
                        session.user.id,
                        pref.type,
                        pref.enabled,
                        pref.emailEnabled
                    );
                    updatedPreferences.push(updatedPref);
                } catch (error) {
                    console.error(`Failed to update preference for type ${pref.type}:`, error);
                    // Continue with other preferences even if one fails
                }
            }

            return NextResponse.json({
                preferences: updatedPreferences,
                message: `Updated ${updatedPreferences.length} preferences`
            });
        } else {
            // Single preference update
            const parsed = updateSinglePreferenceSchema.safeParse(body);

            if (!parsed.success) {
                return NextResponse.json(
                    { error: 'Invalid input', details: parsed.error.issues },
                    { status: 400 }
                );
            }

            const { type, enabled, emailEnabled } = parsed.data;

            const updatedPreference = await notificationService.updateUserPreference(
                session.user.id,
                type,
                enabled,
                emailEnabled
            );

            return NextResponse.json({
                preference: updatedPreference,
                message: 'Preference updated successfully'
            });
        }
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        return NextResponse.json(
            { error: 'Failed to update notification preferences' },
            { status: 500 }
        );
    }
}