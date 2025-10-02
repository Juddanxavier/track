/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { leadCleanupService } from '@/lib/leadCleanupService';
import { isAdmin } from '@/helpers/authHelpers';

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
        console.error('Error getting cleanup status:', error);
        return NextResponse.json(
            {
                error: 'Failed to get cleanup configuration',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}