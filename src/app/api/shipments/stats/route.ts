/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';

// GET /api/shipments/stats - Get shipment statistics
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const stats = await shipmentService.getShipmentStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching shipment stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shipment statistics' },
            { status: 500 }
        );
    }
}