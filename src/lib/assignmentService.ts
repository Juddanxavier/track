/** @format */

import { db } from '@/database/db';
import { shipments, shipmentEvents, users } from '@/database/schema';
import { eq, and, count, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
    Shipment,
    ShipmentEvent,
    UserAssignmentStatusType,
    TrackingAssignmentStatusType,
    ShipmentStatusType,
    EventSourceType,
    AssignmentStats,
} from '@/types/shipment';
import { UserAssignmentStatus, TrackingAssignmentStatus } from '@/types/shipment';
import { assignmentNotificationService } from '@/lib/assignmentNotificationService';

export class AssignmentService {
    /**
     * Update user assignment status for a shipment
     */
    async updateUserAssignmentStatus(
        shipmentId: string,
        status: UserAssignmentStatusType,
        adminId?: string,
        assignedUserId?: string
    ): Promise<void> {
        // Get current shipment
        const [currentShipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!currentShipment) {
            throw new Error(`Shipment with ID ${shipmentId} not found`);
        }

        const previousStatus = currentShipment.userAssignmentStatus as UserAssignmentStatusType;
        const now = new Date();

        // Update shipment with new assignment status
        const updateData: any = {
            userAssignmentStatus: status,
            updatedAt: now,
        };

        // If assigning a user, update the assigned user ID
        if (assignedUserId) {
            updateData.assignedUserId = assignedUserId;
        }

        await db
            .update(shipments)
            .set(updateData)
            .where(eq(shipments.id, shipmentId));

        // Create assignment event
        await this.createAssignmentEvent(
            shipmentId,
            'user_assigned',
            `User assignment status changed from ${previousStatus} to ${status}`,
            adminId,
            now,
            {
                previousStatus,
                newStatus: status,
                assignedUserId,
                assignmentType: 'user',
            }
        );

        // Trigger notifications based on status change
        if (status === UserAssignmentStatus.ASSIGNED && assignedUserId) {
            await assignmentNotificationService.notifyUserAssignment(shipmentId, assignedUserId, adminId);
        } else if (status === UserAssignmentStatus.SIGNUP_SENT) {
            // Signup notification will be handled by the signup endpoint
            console.log(`User assignment status updated to ${status} for shipment ${shipmentId}`);
        }
    }

    /**
     * Update tracking assignment status for a shipment
     */
    async updateTrackingAssignmentStatus(
        shipmentId: string,
        status: TrackingAssignmentStatusType,
        adminId?: string,
        trackingDetails?: {
            courier?: string;
            trackingNumber?: string;
            shippingMethod?: string;
        }
    ): Promise<void> {
        // Get current shipment
        const [currentShipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!currentShipment) {
            throw new Error(`Shipment with ID ${shipmentId} not found`);
        }

        const previousStatus = currentShipment.trackingAssignmentStatus as TrackingAssignmentStatusType;
        const now = new Date();

        // Update shipment with new tracking assignment status
        const updateData: any = {
            trackingAssignmentStatus: status,
            updatedAt: now,
        };

        // If assigning tracking details, update them
        if (trackingDetails) {
            if (trackingDetails.courier) updateData.courier = trackingDetails.courier;
            if (trackingDetails.trackingNumber) updateData.courierTrackingNumber = trackingDetails.trackingNumber;
            if (trackingDetails.shippingMethod) updateData.shippingMethod = trackingDetails.shippingMethod;
        }

        await db
            .update(shipments)
            .set(updateData)
            .where(eq(shipments.id, shipmentId));

        // Create assignment event
        await this.createAssignmentEvent(
            shipmentId,
            'tracking_assigned',
            `Tracking assignment status changed from ${previousStatus} to ${status}`,
            adminId,
            now,
            {
                previousStatus,
                newStatus: status,
                trackingDetails,
                assignmentType: 'tracking',
            }
        );

        // Trigger notifications and API sync if tracking is assigned
        if (status === TrackingAssignmentStatus.ASSIGNED && trackingDetails?.trackingNumber) {
            // Notify about tracking assignment
            await assignmentNotificationService.notifyTrackingAssignment(
                shipmentId,
                {
                    courier: trackingDetails.courier || 'Unknown',
                    trackingNumber: trackingDetails.trackingNumber,
                    shippingMethod: trackingDetails.shippingMethod,
                },
                adminId
            );

            // Trigger API sync
            await this.triggerTrackingSync(shipmentId, trackingDetails);
        }
    }

    /**
     * Get assignment statistics for dashboard
     */
    async getAssignmentStats(): Promise<AssignmentStats> {
        // Get total shipments count
        const [{ totalShipments }] = await db
            .select({ totalShipments: count() })
            .from(shipments);

        // Get unassigned tracking count
        const [{ unassignedTracking }] = await db
            .select({ unassignedTracking: count() })
            .from(shipments)
            .where(eq(shipments.trackingAssignmentStatus, TrackingAssignmentStatus.UNASSIGNED));

        // Get unassigned users count
        const [{ unassignedUsers }] = await db
            .select({ unassignedUsers: count() })
            .from(shipments)
            .where(eq(shipments.userAssignmentStatus, UserAssignmentStatus.UNASSIGNED));

        // Get pending signups count
        const [{ pendingSignups }] = await db
            .select({ pendingSignups: count() })
            .from(shipments)
            .where(eq(shipments.userAssignmentStatus, UserAssignmentStatus.SIGNUP_SENT));

        // Get fully assigned count (both tracking and user assigned)
        const [{ fullyAssigned }] = await db
            .select({ fullyAssigned: count() })
            .from(shipments)
            .where(
                and(
                    eq(shipments.trackingAssignmentStatus, TrackingAssignmentStatus.ASSIGNED),
                    inArray(shipments.userAssignmentStatus, [
                        UserAssignmentStatus.ASSIGNED,
                        UserAssignmentStatus.SIGNUP_COMPLETED
                    ])
                )
            );

        // Get recently ingested count (last 24 hours from API)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentIngestionEvents = await db
            .select({ shipmentId: shipmentEvents.shipmentId })
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.eventType, 'api_ingestion'),
                    eq(shipmentEvents.source, 'api_ingest')
                )
            );

        const recentlyIngested = new Set(recentIngestionEvents.map(e => e.shipmentId)).size;

        return {
            totalShipments,
            unassignedTracking,
            unassignedUsers,
            pendingSignups,
            fullyAssigned,
            recentlyIngested,
        };
    }

    /**
     * Get assignment history for a shipment
     */
    async getAssignmentHistory(shipmentId: string): Promise<ShipmentEvent[]> {
        const events = await db
            .select()
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.shipmentId, shipmentId),
                    inArray(shipmentEvents.eventType, ['user_assigned', 'tracking_assigned', 'signup_sent', 'signup_completed'])
                )
            )
            .orderBy(shipmentEvents.eventTime);

        return events.map(event => ({
            ...event,
            eventType: event.eventType as any,
            source: event.source as EventSourceType,
            status: event.status as ShipmentStatusType | null,
            metadata: event.metadata ? JSON.parse(event.metadata) : null,
        }));
    }

    /**
     * Bulk update assignment statuses
     */
    async bulkUpdateUserAssignmentStatus(
        shipmentIds: string[],
        status: UserAssignmentStatusType,
        adminId?: string,
        assignedUserId?: string
    ): Promise<{ successful: number; failed: number; errors: string[] }> {
        const result = {
            successful: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const shipmentId of shipmentIds) {
            try {
                await this.updateUserAssignmentStatus(shipmentId, status, adminId, assignedUserId);
                result.successful++;
            } catch (error: any) {
                result.failed++;
                result.errors.push(`Shipment ${shipmentId}: ${error.message}`);
            }
        }

        // Notify about bulk operation completion
        if (result.successful > 0 || result.failed > 0) {
            await assignmentNotificationService.notifyBulkAssignmentCompleted(
                'user_assignment',
                {
                    successful: result.successful,
                    failed: result.failed,
                    total: shipmentIds.length,
                    errors: result.errors,
                },
                adminId
            );
        }

        return result;
    }

    /**
     * Bulk update tracking assignment statuses
     */
    async bulkUpdateTrackingAssignmentStatus(
        assignments: Array<{
            shipmentId: string;
            status: TrackingAssignmentStatusType;
            trackingDetails?: {
                courier?: string;
                trackingNumber?: string;
                shippingMethod?: string;
            };
        }>,
        adminId?: string
    ): Promise<{ successful: number; failed: number; errors: string[] }> {
        const result = {
            successful: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const assignment of assignments) {
            try {
                await this.updateTrackingAssignmentStatus(
                    assignment.shipmentId,
                    assignment.status,
                    adminId,
                    assignment.trackingDetails
                );
                result.successful++;
            } catch (error: any) {
                result.failed++;
                result.errors.push(`Shipment ${assignment.shipmentId}: ${error.message}`);
            }
        }

        // Notify about bulk operation completion
        if (result.successful > 0 || result.failed > 0) {
            await assignmentNotificationService.notifyBulkAssignmentCompleted(
                'tracking_assignment',
                {
                    successful: result.successful,
                    failed: result.failed,
                    total: assignments.length,
                    errors: result.errors,
                },
                adminId
            );
        }

        return result;
    }

    /**
     * Create assignment-related event
     */
    private async createAssignmentEvent(
        shipmentId: string,
        eventType: 'user_assigned' | 'tracking_assigned' | 'signup_sent' | 'signup_completed',
        description: string,
        adminId?: string,
        eventTime: Date = new Date(),
        metadata?: Record<string, any>
    ): Promise<void> {
        const eventId = nanoid();

        await db.insert(shipmentEvents).values({
            id: eventId,
            shipmentId,
            eventType,
            status: null,
            description,
            location: null,
            source: 'admin_action' as EventSourceType,
            sourceId: adminId || null,
            eventTime,
            recordedAt: new Date(),
            metadata: metadata ? JSON.stringify(metadata) : null,
        });
    }



    /**
     * Trigger tracking API sync when tracking is assigned
     */
    private async triggerTrackingSync(
        shipmentId: string,
        trackingDetails: {
            courier?: string;
            trackingNumber?: string;
            shippingMethod?: string;
        }
    ): Promise<void> {
        try {
            // Import tracking service dynamically to avoid circular dependencies
            const { trackingService } = await import('@/lib/trackingService');

            // Trigger sync with tracking API
            await trackingService.syncWithAPI(shipmentId);
        } catch (error) {
            console.error('Failed to trigger tracking sync:', error);

            // Log the failure as an event
            await this.createAssignmentEvent(
                shipmentId,
                'tracking_assigned',
                `Failed to sync with tracking API: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                new Date(),
                {
                    syncError: true,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    trackingDetails,
                }
            );
        }
    }

    /**
     * Check if shipment is fully assigned (both tracking and user)
     */
    async isFullyAssigned(shipmentId: string): Promise<boolean> {
        const [shipment] = await db
            .select({
                userAssignmentStatus: shipments.userAssignmentStatus,
                trackingAssignmentStatus: shipments.trackingAssignmentStatus,
            })
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!shipment) return false;

        const userAssigned = shipment.userAssignmentStatus === UserAssignmentStatus.ASSIGNED ||
            shipment.userAssignmentStatus === UserAssignmentStatus.SIGNUP_COMPLETED;
        const trackingAssigned = shipment.trackingAssignmentStatus === TrackingAssignmentStatus.ASSIGNED;

        return userAssigned && trackingAssigned;
    }

    /**
     * Get shipments that need assignment attention
     */
    async getShipmentsNeedingAttention(): Promise<{
        unassignedTracking: Shipment[];
        unassignedUsers: Shipment[];
        pendingSignups: Shipment[];
    }> {
        // Get shipments with unassigned tracking
        const unassignedTrackingResults = await db
            .select()
            .from(shipments)
            .where(eq(shipments.trackingAssignmentStatus, TrackingAssignmentStatus.UNASSIGNED))
            .limit(10);

        // Get shipments with unassigned users
        const unassignedUsersResults = await db
            .select()
            .from(shipments)
            .where(eq(shipments.userAssignmentStatus, UserAssignmentStatus.UNASSIGNED))
            .limit(10);

        // Get shipments with pending signups
        const pendingSignupsResults = await db
            .select()
            .from(shipments)
            .where(eq(shipments.userAssignmentStatus, UserAssignmentStatus.SIGNUP_SENT))
            .limit(10);

        // Convert database rows to Shipment objects
        const convertToShipment = (row: any): Shipment => ({
            ...row,
            status: row.status as ShipmentStatusType,
            userAssignmentStatus: row.userAssignmentStatus as UserAssignmentStatusType,
            trackingAssignmentStatus: row.trackingAssignmentStatus as TrackingAssignmentStatusType,
            apiProvider: row.apiProvider as any,
            originAddress: JSON.parse(row.originAddress),
            destinationAddress: JSON.parse(row.destinationAddress),
            dimensions: row.dimensions ? JSON.parse(row.dimensions) : null,
        });

        return {
            unassignedTracking: unassignedTrackingResults.map(convertToShipment),
            unassignedUsers: unassignedUsersResults.map(convertToShipment),
            pendingSignups: pendingSignupsResults.map(convertToShipment),
        };
    }
}

// Export singleton instance
export const assignmentService = new AssignmentService();