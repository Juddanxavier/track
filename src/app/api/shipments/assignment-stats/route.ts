/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';

// GET /api/shipments/assignment-stats - Get assignment statistics
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const stats = await shipmentService.getAssignmentStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching assignment stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assignment statistics' },
            { status: 500 }
        );
    }
}