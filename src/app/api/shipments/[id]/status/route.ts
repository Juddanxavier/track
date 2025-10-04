/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';
import { ManualStatusUpdateSchema } from '@/types/shipment';
import { auth } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

// PUT /api/shipments/[id]/status - Update shipment status manually
export async function PUT(req: NextRequest, { params }: RouteParams) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Shipment ID is required' },
                { status: 400 }
            );
        }

        const body = await req.json();

        // Validate request body
        const parsed = ManualStatusUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid status update data',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        // Get current user for audit trail
        const session = await auth.api.getSession({
            headers: req.headers,
        });

        // Update shipment status
        await shipmentService.updateStatus(
            id,
            parsed.data.status,
            'manual',
            session?.user?.id,
            parsed.data.notes,
            parsed.data.eventTime
        );

        // Get updated shipment
        const updatedShipment = await shipmentService.getById(id);

        return NextResponse.json({
            shipment: updatedShipment,
            message: 'Shipment status updated successfully'
        });

    } catch (error: any) {
        console.error('Error updating shipment status:', error);

        // Handle specific shipment errors
        if (error.code === 'SHIPMENT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        if (error.code === 'INVALID_STATUS_TRANSITION') {
            return NextResponse.json(
                {
                    error: 'Invalid status transition',
                    details: error.details
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to update shipment status' },
            { status: 500 }
        );
    }
}