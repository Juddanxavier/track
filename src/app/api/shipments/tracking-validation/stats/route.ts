/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { trackingValidationService } from '@/lib/trackingValidationService';

// GET /api/shipments/tracking-validation/stats - Get tracking number validation statistics
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const stats = await trackingValidationService.getTrackingNumberStats();

        return NextResponse.json({
            stats,
            message: 'Tracking validation statistics retrieved successfully'
        });

    } catch (error: any) {
        console.error('Error getting tracking validation stats:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve tracking validation statistics' },
            { status: 500 }
        );
    }
}