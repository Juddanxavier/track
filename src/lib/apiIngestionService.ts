/** @format */

import { db } from '@/database/db';
import { shipments, shipmentEvents } from '@/database/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
    APIShipmentData,
    Shipment,
    ValidationResult,
    BulkIngestResult,
    UserAssignmentStatusType,
    TrackingAssignmentStatusType,
    ShipmentStatusType,
    EventSourceType,
} from '@/types/shipment';
import { APIShipmentDataSchema, UserAssignmentStatus, TrackingAssignmentStatus } from '@/types/shipment';
import { trackingCodeGenerator } from '@/lib/trackingCodeGenerator';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

export class APIIngestionService {
    /**
     * Validate API payload using Zod schema
     */
    async validateAPIPayload(payload: any): Promise<ValidationResult> {
        try {
            // Validate using Zod schema
            APIShipmentDataSchema.parse(payload);

            // Additional business rule validations
            const warnings: string[] = [];

            // Check for potential duplicate customer information
            if (payload.customerEmail) {
                const existingShipment = await this.findPotentialDuplicate(payload);
                if (existingShipment) {
                    warnings.push(`Potential duplicate: Similar shipment found for customer ${payload.customerEmail}`);
                }
            }

            // Validate address completeness
            if (!payload.originAddress.addressLine1 || !payload.destinationAddress.addressLine1) {
                warnings.push('Address information is minimal - consider requesting more detailed address data');
            }

            return {
                valid: true,
                errors: [],
                warnings,
            };
        } catch (error: any) {
            const errors: string[] = [];

            if (error.errors) {
                // Zod validation errors
                errors.push(...error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`));
            } else {
                errors.push(error.message || 'Unknown validation error');
            }

            return {
                valid: false,
                errors,
            };
        }
    }

    /**
     * Find potential duplicate shipments based on customer email and addresses
     */
    private async findPotentialDuplicate(apiData: APIShipmentData): Promise<Shipment | null> {
        // Look for shipments with same customer email created in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [existingShipment] = await db
            .select()
            .from(shipments)
            .where(
                and(
                    eq(shipments.customerEmail, apiData.customerEmail),
                    gte(shipments.createdAt, oneDayAgo)
                )
            )
            .limit(1);

        if (!existingShipment) {
            return null;
        }

        // Parse addresses for comparison
        const existingOrigin = JSON.parse(existingShipment.originAddress);
        const existingDestination = JSON.parse(existingShipment.destinationAddress);

        // Check if addresses are similar (same city and country)
        const originMatch = existingOrigin.city === apiData.originAddress.city &&
            existingOrigin.country === apiData.originAddress.country;
        const destinationMatch = existingDestination.city === apiData.destinationAddress.city &&
            existingDestination.country === apiData.destinationAddress.country;

        if (originMatch && destinationMatch) {
            return {
                ...existingShipment,
                status: existingShipment.status as ShipmentStatusType,
                userAssignmentStatus: existingShipment.userAssignmentStatus as UserAssignmentStatusType,
                trackingAssignmentStatus: existingShipment.trackingAssignmentStatus as TrackingAssignmentStatusType,
                apiProvider: existingShipment.apiProvider as any,
                originAddress: existingOrigin,
                destinationAddress: existingDestination,
                dimensions: existingShipment.dimensions ? JSON.parse(existingShipment.dimensions) : null,
            };
        }

        return null;
    }

    /**
     * Ingest shipment data from API
     */
    async ingestFromAPI(apiData: APIShipmentData, source: string): Promise<Shipment> {
        // Validate payload first
        const validation = await this.validateAPIPayload(apiData);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Check for duplicates based on external ID if provided
        if (apiData.externalId) {
            const existingByExternalId = await this.findByExternalId(apiData.externalId, source);
            if (existingByExternalId) {
                throw new Error(`Duplicate shipment: External ID ${apiData.externalId} already exists for source ${source}`);
            }
        }

        // Generate unique tracking code
        const trackingCode = await trackingCodeGenerator.generateTrackingCode();

        // Create shipment record
        const shipmentId = nanoid();
        const now = new Date();

        const newShipment = {
            id: shipmentId,
            trackingCode,
            leadId: null,

            // Customer Information (from API)
            customerName: apiData.customerName,
            customerEmail: apiData.customerEmail,
            customerPhone: apiData.customerPhone || null,

            // Package Details (from API)
            packageDescription: apiData.packageDescription || null,
            weight: apiData.weight || null,
            dimensions: apiData.dimensions ? JSON.stringify(apiData.dimensions) : null,
            value: apiData.value || null,

            // Addresses (from API)
            originAddress: JSON.stringify(apiData.originAddress),
            destinationAddress: JSON.stringify(apiData.destinationAddress),

            // Assignment Status (initially unassigned)
            assignedUserId: null,
            userAssignmentStatus: UserAssignmentStatus.UNASSIGNED,
            trackingAssignmentStatus: TrackingAssignmentStatus.UNASSIGNED,

            // Shipping Details (initially empty - to be assigned by admin)
            courier: null,
            courierTrackingNumber: null,
            shippingMethod: null,

            // Status and Tracking
            status: 'pending' as ShipmentStatusType,
            estimatedDelivery: apiData.estimatedDelivery ? new Date(apiData.estimatedDelivery) : null,
            actualDelivery: null,

            // API Integration
            lastApiSync: null,
            apiProvider: null,
            apiTrackingId: null,

            // Signup Link Management
            signupToken: null,
            signupTokenExpiry: null,
            signupLinkSentAt: null,

            // API Ingestion Metadata
            apiSource: source,
            apiPayload: JSON.stringify(apiData),

            // Metadata
            notes: null,
            specialInstructions: apiData.specialInstructions || null,
            createdBy: null, // API ingestion, not created by a user
            createdAt: now,
            updatedAt: now,
        };

        // Insert shipment into database
        await db.insert(shipments).values(newShipment);

        // Create API ingestion event
        await this.createIngestionEvent(shipmentId, source, apiData, now);

        // Trigger notification for new API shipment
        await notificationEventHandlers.handleShipmentCreated({
            id: shipmentId,
            trackingCode,
            customerName: apiData.customerName,
            customerEmail: apiData.customerEmail,
            courier: 'Unassigned',
            status: 'pending',
            createdBy: null,
            leadId: null,
        });

        // Return the created shipment with parsed JSON fields
        return {
            ...newShipment,
            status: newShipment.status as ShipmentStatusType,
            userAssignmentStatus: newShipment.userAssignmentStatus as UserAssignmentStatusType,
            trackingAssignmentStatus: newShipment.trackingAssignmentStatus as TrackingAssignmentStatusType,
            apiProvider: newShipment.apiProvider as any,
            originAddress: JSON.parse(newShipment.originAddress),
            destinationAddress: JSON.parse(newShipment.destinationAddress),
            dimensions: newShipment.dimensions ? JSON.parse(newShipment.dimensions) : null,
        };
    }

    /**
     * Bulk ingest multiple shipments
     */
    async bulkIngest(shipmentsData: APIShipmentData[], source: string): Promise<BulkIngestResult> {
        const result: BulkIngestResult = {
            totalProcessed: shipmentsData.length,
            successful: 0,
            failed: 0,
            errors: [],
            createdShipments: [],
        };

        // Process shipments in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < shipmentsData.length; i += batchSize) {
            const batch = shipmentsData.slice(i, i + batchSize);

            // Process each shipment in the batch
            for (let j = 0; j < batch.length; j++) {
                const shipmentData = batch[j];
                const index = i + j;

                try {
                    const createdShipment = await this.ingestFromAPI(shipmentData, source);
                    result.successful++;
                    result.createdShipments.push(createdShipment.id);
                } catch (error: any) {
                    result.failed++;
                    result.errors.push({
                        index,
                        error: error.message || 'Unknown error occurred',
                        data: shipmentData,
                    });
                }
            }
        }

        return result;
    }

    /**
     * Find shipment by external ID and source
     */
    private async findByExternalId(externalId: string, source: string): Promise<Shipment | null> {
        // Search for shipments with matching API source and external ID in the payload
        const existingShipments = await db
            .select()
            .from(shipments)
            .where(eq(shipments.apiSource, source));

        // Filter by external ID in the API payload
        const matchingShipment = existingShipments.find(shipment => {
            if (!shipment.apiPayload) return false;
            try {
                const payload = JSON.parse(shipment.apiPayload);
                return payload.externalId === externalId;
            } catch {
                return false;
            }
        });

        const existingShipment = matchingShipment;

        if (!existingShipment) {
            return null;
        }

        return {
            ...existingShipment,
            status: existingShipment.status as ShipmentStatusType,
            userAssignmentStatus: existingShipment.userAssignmentStatus as UserAssignmentStatusType,
            trackingAssignmentStatus: existingShipment.trackingAssignmentStatus as TrackingAssignmentStatusType,
            apiProvider: existingShipment.apiProvider as any,
            originAddress: JSON.parse(existingShipment.originAddress),
            destinationAddress: JSON.parse(existingShipment.destinationAddress),
            dimensions: existingShipment.dimensions ? JSON.parse(existingShipment.dimensions) : null,
        };
    }

    /**
     * Create API ingestion event
     */
    private async createIngestionEvent(
        shipmentId: string,
        source: string,
        apiData: APIShipmentData,
        eventTime: Date
    ): Promise<void> {
        const eventId = nanoid();

        await db.insert(shipmentEvents).values({
            id: eventId,
            shipmentId,
            eventType: 'api_ingestion',
            status: null,
            description: `Shipment created via API ingestion from ${source}`,
            location: null,
            source: 'api_ingest' as EventSourceType,
            sourceId: source,
            eventTime,
            recordedAt: new Date(),
            metadata: JSON.stringify({
                apiSource: source,
                customerEmail: apiData.customerEmail,
                externalId: apiData.externalId,
                externalSource: apiData.externalSource,
                hasEstimatedDelivery: !!apiData.estimatedDelivery,
                packageDescription: apiData.packageDescription,
                weight: apiData.weight,
                value: apiData.value,
            }),
        });
    }

    /**
     * Get ingestion statistics
     */
    async getIngestionStats(timeRange?: { start: Date; end: Date }) {
        const whereConditions = [eq(shipmentEvents.eventType, 'api_ingestion')];

        if (timeRange) {
            whereConditions.push(gte(shipmentEvents.eventTime, timeRange.start));
            whereConditions.push(lte(shipmentEvents.eventTime, timeRange.end));
        }

        const events = await db
            .select({
                sourceId: shipmentEvents.sourceId,
                eventTime: shipmentEvents.eventTime,
                metadata: shipmentEvents.metadata,
            })
            .from(shipmentEvents)
            .where(and(...whereConditions));

        // Group by source
        const sourceStats = new Map<string, number>();
        events.forEach(event => {
            const source = event.sourceId || 'unknown';
            sourceStats.set(source, (sourceStats.get(source) || 0) + 1);
        });

        return {
            totalIngested: events.length,
            sourceBreakdown: Object.fromEntries(sourceStats),
            recentIngestions: events
                .sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
                .slice(0, 10)
                .map(event => ({
                    source: event.sourceId || 'unknown',
                    timestamp: event.eventTime,
                    metadata: event.metadata ? JSON.parse(event.metadata) : null,
                })),
        };
    }
}

// Export singleton instance
export const apiIngestionService = new APIIngestionService();
