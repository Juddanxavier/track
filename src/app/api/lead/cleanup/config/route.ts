/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { leadCleanupService } from '@/lib/leadCleanupService';
import { isAdmin } from '@/helpers/authHelpers';
import { z } from 'zod';

const updateConfigSchema = z.object({
    failedLeadRetentionDays: z.number().min(1).max(365).optional(),
    successLeadArchiveDays: z.number().min(1).max(365).optional(),
    isEnabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
    try {
        // Check if user is admin
        if (!(await isAdmin(request))) {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 401 }
            );
        }

        const config = await leadCleanupService.getCleanupConfig();

        return NextResponse.json({
            message: 'Cleanup configuration retrieved successfully',
            config,
        });
    } catch (error) {
        console.error('Error getting cleanup config:', error);
        return NextResponse.json(
            {
                error: 'Failed to get cleanup configuration',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Check if user is admin
        if (!(await isAdmin(request))) {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const configUpdates = updateConfigSchema.parse(body);

        const updatedConfig = await leadCleanupService.updateCleanupConfig(configUpdates);

        return NextResponse.json({
            message: 'Cleanup configuration updated successfully',
            config: updatedConfig,
        });
    } catch (error) {
        console.error('Error updating cleanup config:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid request data',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to update cleanup configuration',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}