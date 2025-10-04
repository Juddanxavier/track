/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { assignmentService } from '@/lib/assignmentService';
import { shipmentService } from '@/lib/shipmentService';
import { trackingService } from '@/lib/trackingService';
import { trackingValidationService } from '@/lib/trackingValidationService';
import { AssignTrackingSchema, TrackingAssignmentStatus } from '@/types/shipment';
import { auth } from '@/lib/auth';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

const ResolveConflictSchema = z.object({
    courier: z.string().min(1, 'Courier is required'),
    trackingNumber: z.string().min(1, 'Tracking number is required'),
    shippingMethod: z.string().optional(),
    resolution: z.object({
        action: z.enum(['override', 'skip', 'update_existing']),
        reason: z.string().optional()
    })
});

// POST /api/shipments/[id]/assign-tracking/resolve-conflict - Resolve tracking number conflict
export async function POST(req: NextRequest, { params }: RouteParams) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id: shipmentId } = await params;

        if (!shipmentId) {
            return NextResponse.json(
                { error: 'Shipment ID is required' },
                { status: 400 }
            );
        }

        const body = await req.json();

        // Validate request body
        const parsed = ResolveConflictSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid conflict resolution data',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        const { courier, trackingNumber, shippingMethod, resolution } = parsed.data;

        // Get current user for audit trail
        const session = await auth.api.getSession({
            headers: req.headers,
        });
        const adminId = session?.user?.id;

        // Check if shipment exists
        const shipment = await shipmentService.getById(shipmentId);
        if (!shipment) {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        // Resolve the conflict
        const resolutionResult = await trackingValidationService.resolveTrackingConflict(
            courier,
            trackingNumber,
            shipmentId,
            resolution,
            adminId
        );

        if (!resolutionResult.success) {
            return NextResponse.json(
                {
                    error: 'Failed to resolve conflict',
                    details: resolutionResult.message
                },
                { status: 400 }
            );
        }

        // If resolution was successful and not skipped, proceed with assignment
        if (resolution.action !== 'skip' && resolution.action !== 'update_existing') {
            await assignmentService.updateTrackingAssignmentStatus(
                shipmentId,
                TrackingAssignmentStatus.ASSIGNED,
                adminId,
                {
                    courier,
                    trackingNumber,
                    shippingMethod
                }
            );

            // Trigger API sync if tracking number is provided
            try {
                await trackingService.syncWithAPI(shipmentId);
            } catch (syncError) {
                console.warn('Failed to sync with tracking API after conflict resolution:', syncError);
            }
        }

        // Get updated shipment(s)
        const updatedShipment = await shipmentService.getById(shipmentId);
        const response: any = {
            message: resolutionResult.message,
            resolution: {
                action: resolution.action,
                reason: resolution.reason
            },
            shipment: updatedShipment
        };

        if (resolutionResult.updatedShipments) {
            response.affectedShipments = resolutionResult.updatedShipments;
        }

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Error resolving tracking conflict:', error);
        return NextResponse.json(
            { error: 'Failed to resolve tracking conflict' },
            { status: 500 }
        );
    }
}