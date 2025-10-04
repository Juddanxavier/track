/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { assignmentService } from '@/lib/assignmentService';
import { shipmentService } from '@/lib/shipmentService';
import { trackingService } from '@/lib/trackingService';
import { trackingValidationService } from '@/lib/trackingValidationService';
import { BulkAssignTrackingSchema, TrackingAssignmentStatus } from '@/types/shipment';
import { auth } from '@/lib/auth';
import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { inArray } from 'drizzle-orm';

// POST /api/shipments/bulk-assign-tracking - Bulk assign tracking numbers
export async function POST(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Validate request body
        const parsed = BulkAssignTrackingSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid bulk assignment data',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        const { assignments } = parsed.data;

        // Get current user for audit trail
        const session = await auth.api.getSession({
            headers: req.headers,
        });
        const adminId = session?.user?.id;

        // Validate all shipments exist
        const shipmentIds = assignments.map(a => a.shipmentId);
        const existingShipments = await db
            .select({ id: shipments.id })
            .from(shipments)
            .where(inArray(shipments.id, shipmentIds));

        const existingIds = new Set(existingShipments.map(s => s.id));
        const missingIds = shipmentIds.filter(id => !existingIds.has(id));

        if (missingIds.length > 0) {
            return NextResponse.json(
                {
                    error: 'Some shipments not found',
                    details: { missingShipmentIds: missingIds }
                },
                { status: 404 }
            );
        }

        // Validate all tracking assignments using the validation service
        const validationResult = await trackingValidationService.validateBulkTrackingAssignments(
            assignments.map(a => ({
                shipmentId: a.shipmentId,
                courier: a.courier,
                trackingNumber: a.trackingNumber
            }))
        );

        if (!validationResult.valid) {
            const errorsByType = {
                format: validationResult.errors.filter(e => e.type === 'format'),
                conflict: validationResult.errors.filter(e => e.type === 'conflict'),
                duplicate_in_batch: validationResult.errors.filter(e => e.type === 'duplicate_in_batch')
            };

            return NextResponse.json(
                {
                    error: 'Bulk tracking validation failed',
                    details: {
                        totalErrors: validationResult.errors.length,
                        formatErrors: errorsByType.format.length,
                        conflictErrors: errorsByType.conflict.length,
                        duplicateErrors: errorsByType.duplicate_in_batch.length,
                        errors: validationResult.errors
                    }
                },
                { status: 400 }
            );
        }

        // Process bulk assignments
        const results = {
            totalProcessed: assignments.length,
            successful: 0,
            failed: 0,
            errors: [] as Array<{ shipmentId: string; error: string }>,
            syncErrors: [] as Array<{ shipmentId: string; error: string }>
        };

        // Process assignments in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < assignments.length; i += batchSize) {
            const batch = assignments.slice(i, i + batchSize);

            await Promise.all(batch.map(async (assignment) => {
                try {
                    // Update tracking assignment
                    await assignmentService.updateTrackingAssignmentStatus(
                        assignment.shipmentId,
                        TrackingAssignmentStatus.ASSIGNED,
                        adminId,
                        {
                            courier: assignment.courier,
                            trackingNumber: assignment.trackingNumber,
                            shippingMethod: assignment.shippingMethod
                        }
                    );

                    results.successful++;

                    // Trigger API sync if tracking number is provided
                    if (assignment.trackingNumber) {
                        try {
                            await trackingService.syncWithAPI(assignment.shipmentId);
                        } catch (syncError) {
                            results.syncErrors.push({
                                shipmentId: assignment.shipmentId,
                                error: syncError instanceof Error ? syncError.message : 'Unknown sync error'
                            });
                        }
                    }
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        shipmentId: assignment.shipmentId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }));
        }

        // Prepare response
        const response: any = {
            message: 'Bulk tracking assignment completed',
            results: {
                totalProcessed: results.totalProcessed,
                successful: results.successful,
                failed: results.failed
            }
        };

        if (results.errors.length > 0) {
            response.errors = results.errors;
        }

        if (results.syncErrors.length > 0) {
            response.syncErrors = results.syncErrors;
            response.message += ` (${results.syncErrors.length} sync warnings)`;
        }

        // Return appropriate status code
        const statusCode = results.failed > 0 ? 207 : 200; // 207 Multi-Status for partial success

        return NextResponse.json(response, { status: statusCode });

    } catch (error: any) {
        console.error('Error in bulk tracking assignment:', error);
        return NextResponse.json(
            { error: 'Failed to process bulk tracking assignment' },
            { status: 500 }
        );
    }
}

