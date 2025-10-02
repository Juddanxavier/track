/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { leadCleanupService } from '@/lib/leadCleanupService';
import { isAdmin } from '@/helpers/authHelpers';
import { z } from 'zod';

const getLogSchema = z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    perPage: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
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

        const { searchParams } = new URL(request.url);
        const queryParams = Object.fromEntries(searchParams.entries());

        const { page, perPage } = getLogSchema.parse(queryParams);

        const result = await leadCleanupService.getCleanupLog(page || 1, perPage || 50);

        return NextResponse.json({
            message: 'Cleanup log retrieved successfully',
            ...result,
        });
    } catch (error) {
        console.error('Error getting cleanup log:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to get cleanup log',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}