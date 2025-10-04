/** @format */

import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq, and, ne, isNotNull } from 'drizzle-orm';

export interface TrackingValidationResult {
    valid: boolean;
    message?: string;
    conflictDetails?: {
        existingShipmentId: string;
        existingTrackingCode: string;
        courier: string;
        trackingNumber: string;
    };
}

export interface TrackingConflictResolution {
    action: 'override' | 'skip' | 'update_existing';
    reason?: string;
}

export class TrackingValidationService {
    /**
     * Validate tracking number format based on courier
     */
    validateTrackingNumberFormat(courier: string, trackingNumber?: string): TrackingValidationResult {
        if (!trackingNumber) {
            return { valid: true }; // Allow empty tracking numbers
        }

        const courierPatterns: Record<string, { pattern: RegExp; description: string }> = {
            'fedex': {
                pattern: /^(\d{12}|\d{14}|\d{20})$/,
                description: 'FedEx tracking numbers should be 12, 14, or 20 digits'
            },
            'ups': {
                pattern: /^(1Z[0-9A-Z]{16}|\d{9}|\d{12})$/,
                description: 'UPS tracking numbers should be 1Z followed by 16 alphanumeric characters, or 9-12 digits'
            },
            'usps': {
                pattern: /^(\d{20}|\d{22}|[A-Z]{2}\d{9}[A-Z]{2})$/,
                description: 'USPS tracking numbers should be 20-22 digits or 2 letters + 9 digits + 2 letters'
            },
            'dhl': {
                pattern: /^(\d{10,11}|\d{21})$/,
                description: 'DHL tracking numbers should be 10-11 digits or 21 digits'
            },
            'canada_post': {
                pattern: /^(\d{16}|[A-Z]{2}\d{9}[A-Z]{2})$/,
                description: 'Canada Post tracking numbers should be 16 digits or 2 letters + 9 digits + 2 letters'
            },
            'purolator': {
                pattern: /^[A-Z0-9]{10,12}$/,
                description: 'Purolator tracking numbers should be 10-12 alphanumeric characters'
            },
            'tnt': {
                pattern: /^(\d{9}|[A-Z]{2}\d{7}[A-Z]{2})$/,
                description: 'TNT tracking numbers should be 9 digits or 2 letters + 7 digits + 2 letters'
            },
            'aramex': {
                pattern: /^\d{10,11}$/,
                description: 'Aramex tracking numbers should be 10-11 digits'
            }
        };

        const courierKey = courier.toLowerCase().replace(/\s+/g, '_');
        const pattern = courierPatterns[courierKey];

        if (!pattern) {
            // For unknown couriers, allow any alphanumeric string of reasonable length
            const genericPattern = /^[A-Za-z0-9\-\s]{4,30}$/;
            if (!genericPattern.test(trackingNumber)) {
                return {
                    valid: false,
                    message: 'Tracking number should be 4-30 alphanumeric characters (letters, numbers, hyphens, spaces allowed)'
                };
            }
            return { valid: true };
        }

        if (!pattern.pattern.test(trackingNumber)) {
            return {
                valid: false,
                message: pattern.description
            };
        }

        return { valid: true };
    }

    /**
     * Check for duplicate tracking number assignments
     */
    async checkTrackingNumberConflict(
        courier: string,
        trackingNumber: string,
        excludeShipmentId?: string
    ): Promise<TrackingValidationResult> {
        if (!trackingNumber) {
            return { valid: true };
        }

        let whereCondition = and(
            eq(shipments.courierTrackingNumber, trackingNumber),
            eq(shipments.courier, courier)
        );

        if (excludeShipmentId) {
            whereCondition = and(
                whereCondition,
                ne(shipments.id, excludeShipmentId)
            );
        }

        const existingShipment = await db
            .select({
                id: shipments.id,
                trackingCode: shipments.trackingCode,
                courier: shipments.courier,
                courierTrackingNumber: shipments.courierTrackingNumber
            })
            .from(shipments)
            .where(whereCondition)
            .limit(1);

        if (existingShipment.length > 0) {
            const existing = existingShipment[0];
            return {
                valid: false,
                message: `Tracking number ${trackingNumber} for ${courier} is already assigned to shipment ${existing.trackingCode}`,
                conflictDetails: {
                    existingShipmentId: existing.id,
                    existingTrackingCode: existing.trackingCode,
                    courier: existing.courier || courier,
                    trackingNumber: existing.courierTrackingNumber || trackingNumber
                }
            };
        }

        return { valid: true };
    }

    /**
     * Validate multiple tracking assignments for bulk operations
     */
    async validateBulkTrackingAssignments(
        assignments: Array<{
            shipmentId: string;
            courier: string;
            trackingNumber?: string;
        }>
    ): Promise<{
        valid: boolean;
        errors: Array<{
            shipmentId: string;
            error: string;
            type: 'format' | 'conflict' | 'duplicate_in_batch';
        }>;
    }> {
        const errors: Array<{
            shipmentId: string;
            error: string;
            type: 'format' | 'conflict' | 'duplicate_in_batch';
        }> = [];

        // Check for duplicates within the batch
        const trackingMap = new Map<string, string[]>();
        assignments.forEach(assignment => {
            if (assignment.trackingNumber) {
                const key = `${assignment.courier}:${assignment.trackingNumber}`;
                if (!trackingMap.has(key)) {
                    trackingMap.set(key, []);
                }
                trackingMap.get(key)!.push(assignment.shipmentId);
            }
        });

        // Report duplicates within batch
        trackingMap.forEach((shipmentIds, key) => {
            if (shipmentIds.length > 1) {
                const [courier, trackingNumber] = key.split(':');
                shipmentIds.forEach(shipmentId => {
                    errors.push({
                        shipmentId,
                        error: `Duplicate tracking number ${trackingNumber} for ${courier} within batch`,
                        type: 'duplicate_in_batch'
                    });
                });
            }
        });

        // Validate each assignment
        for (const assignment of assignments) {
            // Format validation
            if (assignment.trackingNumber) {
                const formatResult = this.validateTrackingNumberFormat(assignment.courier, assignment.trackingNumber);
                if (!formatResult.valid) {
                    errors.push({
                        shipmentId: assignment.shipmentId,
                        error: formatResult.message || 'Invalid tracking number format',
                        type: 'format'
                    });
                    continue; // Skip conflict check if format is invalid
                }

                // Conflict validation
                const conflictResult = await this.checkTrackingNumberConflict(
                    assignment.courier,
                    assignment.trackingNumber,
                    assignment.shipmentId
                );
                if (!conflictResult.valid) {
                    errors.push({
                        shipmentId: assignment.shipmentId,
                        error: conflictResult.message || 'Tracking number conflict',
                        type: 'conflict'
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Suggest resolution options for tracking number conflicts
     */
    async suggestConflictResolution(
        courier: string,
        trackingNumber: string,
        newShipmentId: string
    ): Promise<{
        options: Array<{
            action: 'override' | 'skip' | 'update_existing' | 'modify_number';
            description: string;
            risk: 'low' | 'medium' | 'high';
            recommendation?: boolean;
        }>;
        conflictDetails?: {
            existingShipmentId: string;
            existingTrackingCode: string;
        };
    }> {
        const conflictResult = await this.checkTrackingNumberConflict(courier, trackingNumber, newShipmentId);

        if (conflictResult.valid) {
            return {
                options: [{
                    action: 'override',
                    description: 'No conflict detected, proceed with assignment',
                    risk: 'low',
                    recommendation: true
                }]
            };
        }

        const options = [
            {
                action: 'skip' as const,
                description: 'Skip this assignment and leave tracking unassigned',
                risk: 'low' as const,
                recommendation: true
            },
            {
                action: 'modify_number' as const,
                description: 'Modify the tracking number to avoid conflict',
                risk: 'medium' as const
            },
            {
                action: 'override' as const,
                description: 'Force assign and remove from existing shipment (not recommended)',
                risk: 'high' as const
            },
            {
                action: 'update_existing' as const,
                description: 'Update the existing shipment instead of the new one',
                risk: 'medium' as const
            }
        ];

        return {
            options,
            conflictDetails: conflictResult.conflictDetails
        };
    }

    /**
     * Resolve tracking number conflict based on chosen action
     */
    async resolveTrackingConflict(
        courier: string,
        trackingNumber: string,
        newShipmentId: string,
        resolution: TrackingConflictResolution,
        adminId?: string
    ): Promise<{
        success: boolean;
        message: string;
        updatedShipments?: string[];
    }> {
        const conflictResult = await this.checkTrackingNumberConflict(courier, trackingNumber, newShipmentId);

        if (conflictResult.valid) {
            return {
                success: true,
                message: 'No conflict to resolve'
            };
        }

        const { conflictDetails } = conflictResult;
        if (!conflictDetails) {
            return {
                success: false,
                message: 'Conflict details not available'
            };
        }

        switch (resolution.action) {
            case 'skip':
                return {
                    success: true,
                    message: 'Assignment skipped due to conflict'
                };

            case 'override':
                // Remove tracking from existing shipment and assign to new one
                await db
                    .update(shipments)
                    .set({
                        courierTrackingNumber: null,
                        trackingAssignmentStatus: 'unassigned',
                        updatedAt: new Date()
                    })
                    .where(eq(shipments.id, conflictDetails.existingShipmentId));

                // Log the override action
                const { shipmentEventService } = await import('@/lib/shipmentEventService');
                await shipmentEventService.addEvent({
                    shipmentId: conflictDetails.existingShipmentId,
                    eventType: 'tracking_assigned',
                    description: `Tracking number ${trackingNumber} removed due to conflict resolution (assigned to ${newShipmentId})`,
                    source: 'admin_action',
                    sourceId: adminId,
                    eventTime: new Date(),
                    metadata: {
                        conflictResolution: true,
                        action: 'override',
                        reason: resolution.reason,
                        newShipmentId
                    }
                });

                return {
                    success: true,
                    message: `Tracking number reassigned from ${conflictDetails.existingTrackingCode} to new shipment`,
                    updatedShipments: [conflictDetails.existingShipmentId, newShipmentId]
                };

            case 'update_existing':
                return {
                    success: true,
                    message: `Use existing shipment ${conflictDetails.existingTrackingCode} instead`,
                    updatedShipments: [conflictDetails.existingShipmentId]
                };

            default:
                return {
                    success: false,
                    message: 'Unknown resolution action'
                };
        }
    }

    /**
     * Get tracking number usage statistics
     */
    async getTrackingNumberStats(): Promise<{
        totalAssigned: number;
        byCourier: Record<string, number>;
        duplicates: Array<{
            courier: string;
            trackingNumber: string;
            shipmentCount: number;
            shipmentIds: string[];
        }>;
    }> {
        // Get all shipments with tracking numbers
        const shipmentsWithTracking = await db
            .select({
                id: shipments.id,
                courier: shipments.courier,
                courierTrackingNumber: shipments.courierTrackingNumber
            })
            .from(shipments)
            .where(and(
                isNotNull(shipments.courierTrackingNumber),
                ne(shipments.courierTrackingNumber, '')
            ));

        const totalAssigned = shipmentsWithTracking.length;
        const byCourier: Record<string, number> = {};
        const trackingMap = new Map<string, string[]>();

        shipmentsWithTracking.forEach(shipment => {
            if (shipment.courier && shipment.courierTrackingNumber) {
                // Count by courier
                byCourier[shipment.courier] = (byCourier[shipment.courier] || 0) + 1;

                // Track duplicates
                const key = `${shipment.courier}:${shipment.courierTrackingNumber}`;
                if (!trackingMap.has(key)) {
                    trackingMap.set(key, []);
                }
                trackingMap.get(key)!.push(shipment.id);
            }
        });

        // Find duplicates
        const duplicates: Array<{
            courier: string;
            trackingNumber: string;
            shipmentCount: number;
            shipmentIds: string[];
        }> = [];

        trackingMap.forEach((shipmentIds, key) => {
            if (shipmentIds.length > 1) {
                const [courier, trackingNumber] = key.split(':');
                duplicates.push({
                    courier,
                    trackingNumber,
                    shipmentCount: shipmentIds.length,
                    shipmentIds
                });
            }
        });

        return {
            totalAssigned,
            byCourier,
            duplicates
        };
    }
}

// Export singleton instance
export const trackingValidationService = new TrackingValidationService();