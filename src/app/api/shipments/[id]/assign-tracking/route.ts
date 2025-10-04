/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { assignmentService } from '@/lib/assignmentService';
import { shipmentService } from '@/lib/shipmentService';
import { trackingService } from '@/lib/trackingService';
import { trackingValidationService } from '@/lib/trackingValidationService';
import { AssignTrackingSchema, TrackingAssignmentStatus } from '@/types/shipment';
import { auth } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

// POST /api/shipments/[id]/assign-tracking - Assign tracking number to shipment
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
        const parsed = AssignTrackingSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid tracking assignment data',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        const { courier, trackingNumber, shippingMethod } = parsed.data;

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

        // Validate tracking number format if provided
        if (trackingNumber) {
            const formatValidation = trackingValidationService.validateTrackingNumberFormat(courier, trackingNumber);
            if (!formatValidation.valid) {
                return NextResponse.json(
                    {
                        error: 'Invalid tracking number format',
                        details: formatValidation.message
                    },
                    { status: 400 }
                );
            }

            // Check for tracking number conflicts
            const conflictValidation = await trackingValidationService.checkTrackingNumberConflict(
                courier,
                trackingNumber,
                shipmentId
            );
            if (!conflictValidation.valid) {
                // Get conflict resolution suggestions
                const resolutionSuggestions = await trackingValidationService.suggestConflictResolution(
                    courier,
                    trackingNumber,
                    shipmentId
                );

                return NextResponse.json(
                    {
                        error: 'Tracking number conflict detected',
                        details: conflictValidation.message,
                        conflictDetails: conflictValidation.conflictDetails,
                        resolutionOptions: resolutionSuggestions.options
                    },
                    { status: 409 }
                );
            }
        }

        // Update tracking assignment status and details
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

        // Trigger API sync if tracking provider is available
        try {
            if (trackingNumber) {
                await trackingService.syncWithAPI(shipmentId);
            }
        } catch (syncError) {
            console.warn('Failed to sync with tracking API:', syncError);
            // Don't fail the assignment if sync fails - log it as a warning
        }

        // Get updated shipment
        const updatedShipment = await shipmentService.getById(shipmentId);

        return NextResponse.json({
            shipment: updatedShipment,
            message: 'Tracking number assigned successfully'
        });

    } catch (error: any) {
        console.error('Error assigning tracking number:', error);

        // Handle specific error types
        if (error.message?.includes('not found')) {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to assign tracking number' },
            { status: 500 }
        );
    }
}

