/** @format */

import { db } from '@/database/db';
import { shipments, shipmentEvents, leads } from '@/database/schema';
import { and, eq, desc, count, or, like, inArray, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
    Shipment,
    ShipmentEvent,
    CreateShipmentRequest,
    UpdateShipmentRequest,
    ShipmentListResponse,
    ShipmentWithEvents,
    ShipmentFilters,
    ShipmentSearchParams,
    ConvertLeadToShipmentRequest,
    CreateShipmentEventRequest,
    ShipmentStatusType,
    EventSourceType,
    EventTypeType,
} from '@/types/shipment';
import {
    VALID_STATUS_TRANSITIONS,
    InvalidStatusTransitionError,
    ShipmentError,
} from '@/types/shipment';
import { trackingCodeGenerator } from '@/lib/trackingCodeGenerator';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

export class ShipmentService {
    /**
     * Generate a unique tracking code in format SC + 9 digits
     */
    async generateTrackingCode(): Promise<string> {
        return trackingCodeGenerator.generateInternalTrackingCode();
    }

    /**
     * Validate tracking code format
     */
    private validateTrackingCode(trackingCode: string): boolean {
        return trackingCodeGenerator.validateFormat(trackingCode);
    }

    /**
     * Validate status transition
     */
    private validateStatusTransition(currentStatus: ShipmentStatusType, newStatus: ShipmentStatusType): void {
        const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
        if (!allowedTransitions.includes(newStatus)) {
            throw new InvalidStatusTransitionError(currentStatus, newStatus);
        }
    }

    /**
     * Create a shipment from a lead
     */
    async createFromLead(leadId: string, shipmentData: ConvertLeadToShipmentRequest, createdBy?: string): Promise<Shipment> {
        // First, get the lead data
        const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId));

        if (!lead) {
            throw new ShipmentError(`Lead with ID ${leadId} not found`, 'LEAD_NOT_FOUND');
        }

        // Check if lead is already converted
        if (lead.shipmentId) {
            throw new ShipmentError(
                `Lead ${leadId} has already been converted to shipment ${lead.shipmentId}`,
                'LEAD_ALREADY_CONVERTED',
                { shipmentId: lead.shipmentId }
            );
        }

        // Validate lead has required information for conversion
        const missingFields = [];
        if (!lead.customerName) missingFields.push('customerName');
        if (!lead.customerEmail) missingFields.push('customerEmail');
        if (!lead.originCountry) missingFields.push('originCountry');
        if (!lead.destinationCountry) missingFields.push('destinationCountry');

        if (missingFields.length > 0) {
            throw new ShipmentError(
                'Lead has incomplete information required for conversion',
                'INCOMPLETE_LEAD_DATA',
                { missingFields }
            );
        }

        // Generate tracking code
        const trackingCode = await this.generateTrackingCode();

        // Create addresses from lead data or use provided addresses
        const originAddress = shipmentData.originAddress || {
            name: lead.customerName,
            addressLine1: 'Origin Address Required',
            city: lead.originCountry,
            state: '',
            postalCode: '',
            country: lead.originCountry,
        };

        const destinationAddress = shipmentData.destinationAddress || {
            name: lead.customerName,
            addressLine1: 'Destination Address Required',
            city: lead.destinationCountry,
            state: '',
            postalCode: '',
            country: lead.destinationCountry,
        };

        // Create shipment record
        const shipmentId = nanoid();
        const now = new Date();

        const newShipment = {
            id: shipmentId,
            trackingCode,
            leadId,
            customerName: lead.customerName,
            customerEmail: lead.customerEmail,
            customerPhone: lead.customerPhone,
            packageDescription: shipmentData.packageDescription || null,
            weight: shipmentData.weight || lead.weight,
            dimensions: shipmentData.dimensions ? JSON.stringify(shipmentData.dimensions) : null,
            value: shipmentData.value || null,
            originAddress: JSON.stringify(originAddress),
            destinationAddress: JSON.stringify(destinationAddress),
            courier: shipmentData.courier,
            courierTrackingNumber: shipmentData.courierTrackingNumber || null,
            shippingMethod: shipmentData.shippingMethod || null,
            status: 'pending' as ShipmentStatusType,
            estimatedDelivery: shipmentData.estimatedDelivery || null,
            actualDelivery: null,
            lastApiSync: null,
            apiProvider: shipmentData.apiProvider || null,
            apiTrackingId: shipmentData.apiTrackingId || null,
            notes: shipmentData.notes || null,
            specialInstructions: shipmentData.specialInstructions || null,
            createdBy: createdBy || null,
            createdAt: now,
            updatedAt: now,
        };

        // Insert shipment
        await db.insert(shipments).values(newShipment);

        // Update lead with shipment reference and status
        await db
            .update(leads)
            .set({
                shipmentId,
                status: 'converted',
                convertedAt: now,
                updatedAt: now,
            })
            .where(eq(leads.id, leadId));

        // Create initial shipment event
        await this.addEvent({
            shipmentId,
            eventType: 'status_change',
            status: 'pending',
            description: `Shipment created from lead ${leadId}`,
            source: 'manual',
            sourceId: createdBy,
            eventTime: now,
        });

        // Trigger shipment creation notification
        await notificationEventHandlers.handleShipmentCreated({
            id: shipmentId,
            trackingCode,
            customerName: lead.customerName,
            customerEmail: lead.customerEmail,
            courier: shipmentData.courier,
            status: 'pending',
            createdBy,
            leadId,
        });

        // Return the created shipment with parsed JSON fields
        return {
            ...newShipment,
            status: newShipment.status as ShipmentStatusType,
            apiProvider: newShipment.apiProvider as any,
            originAddress: JSON.parse(newShipment.originAddress),
            destinationAddress: JSON.parse(newShipment.destinationAddress),
            dimensions: newShipment.dimensions ? JSON.parse(newShipment.dimensions) : null,
        };
    }

    /**
     * Create a shipment from tracking number and carrier (simplified workflow)
     */
    async createFromTrackingNumber(
        carrierTrackingNumber: string,
        carrier: string,
        createdBy?: string
    ): Promise<Shipment> {
        // Generate internal tracking code
        const internalTrackingCode = await this.generateTrackingCode();

        // Create shipment record with minimal data
        const shipmentId = nanoid();
        const now = new Date();

        const newShipment = {
            id: shipmentId,
            internalTrackingCode,
            leadId: null,
            carrier,
            carrierTrackingNumber,
            customerName: null,
            customerEmail: null,
            customerPhone: null,
            packageDescription: null,
            weight: null,
            dimensions: null,
            value: null,
            originAddress: null,
            destinationAddress: null,
            status: 'pending' as ShipmentStatusType,
            estimatedDelivery: null,
            actualDelivery: null,
            lastApiSync: null,
            apiSyncStatus: 'pending' as any,
            apiError: null,
            notes: null,
            needsReview: false,
            createdBy: createdBy || 'system',
            createdAt: now,
            updatedAt: now,
        };

        // Insert shipment
        await db.insert(shipments).values(newShipment);

        // Create initial shipment event
        await this.addEvent({
            shipmentId,
            eventType: 'shipment_created',
            description: `Shipment created with tracking number ${carrierTrackingNumber} for ${carrier}`,
            source: 'manual',
            sourceId: createdBy,
            eventTime: now,
        });

        // Trigger immediate API fetch for shipment details
        try {
            const { ThirdPartyAPIService } = await import('@/lib/third-party-api-service');
            const apiService = new ThirdPartyAPIService();

            const shipmentDetails = await apiService.fetchShipmentDetails(
                carrierTrackingNumber,
                carrier as any
            );

            // Update shipment with API data
            const updateData: any = {
                lastApiSync: now,
                apiSyncStatus: 'success',
                updatedAt: now,
            };

            if (shipmentDetails.customerName) updateData.customerName = shipmentDetails.customerName;
            if (shipmentDetails.customerEmail) updateData.customerEmail = shipmentDetails.customerEmail;
            if (shipmentDetails.customerPhone) updateData.customerPhone = shipmentDetails.customerPhone;
            if (shipmentDetails.packageDescription) updateData.packageDescription = shipmentDetails.packageDescription;
            if (shipmentDetails.weight) updateData.weight = shipmentDetails.weight;
            if (shipmentDetails.dimensions) updateData.dimensions = JSON.stringify(shipmentDetails.dimensions);
            if (shipmentDetails.value) updateData.value = shipmentDetails.value;
            if (shipmentDetails.originAddress) updateData.originAddress = JSON.stringify(shipmentDetails.originAddress);
            if (shipmentDetails.destinationAddress) updateData.destinationAddress = JSON.stringify(shipmentDetails.destinationAddress);
            if (shipmentDetails.status) updateData.status = shipmentDetails.status;
            if (shipmentDetails.estimatedDelivery) updateData.estimatedDelivery = shipmentDetails.estimatedDelivery;
            if (shipmentDetails.actualDelivery) updateData.actualDelivery = shipmentDetails.actualDelivery;

            await db
                .update(shipments)
                .set(updateData)
                .where(eq(shipments.id, shipmentId));

            // Add tracking events from API
            if (shipmentDetails.events && shipmentDetails.events.length > 0) {
                for (const event of shipmentDetails.events) {
                    await this.addEvent({
                        shipmentId,
                        eventType: event.eventType,
                        status: event.status,
                        description: event.description,
                        location: event.location,
                        source: 'api_sync',
                        eventTime: event.eventTime,
                        metadata: event.metadata,
                    });
                }
            }

            // Add API sync success event
            await this.addEvent({
                shipmentId,
                eventType: 'api_sync',
                description: `Successfully fetched shipment details from ${carrier} API`,
                source: 'api_sync',
                eventTime: now,
            });

        } catch (apiError) {
            console.error('Failed to fetch shipment details from API:', apiError);

            // Mark shipment for review due to API failure
            await db
                .update(shipments)
                .set({
                    apiSyncStatus: 'failed',
                    apiError: apiError instanceof Error ? apiError.message : 'Unknown API error',
                    needsReview: true,
                    lastApiSync: now,
                    updatedAt: now,
                })
                .where(eq(shipments.id, shipmentId));

            // Add API sync failure event
            await this.addEvent({
                shipmentId,
                eventType: 'api_sync',
                description: `Failed to fetch shipment details from ${carrier} API: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
                source: 'api_sync',
                eventTime: now,
                metadata: {
                    error: apiError instanceof Error ? apiError.message : 'Unknown error',
                    carrier,
                    trackingNumber: carrierTrackingNumber,
                },
            });
        }

        // Trigger shipment creation notification (if available)
        try {
            await notificationEventHandlers.handleShipmentCreated({
                id: shipmentId,
                trackingCode: internalTrackingCode,
                customerName: newShipment.customerName,
                customerEmail: newShipment.customerEmail,
                courier: carrier,
                status: 'pending',
                createdBy: createdBy || 'system',
                leadId: null,
            });
        } catch (notificationError) {
            console.warn('Failed to send shipment creation notification:', notificationError);
            // Don't fail the shipment creation if notification fails
        }

        // Return the created shipment
        return await this.getById(shipmentId) as Shipment;
    }

    /**
     * Create a shipment directly (not from lead)
     */
    async createDirect(shipmentData: CreateShipmentRequest, createdBy?: string): Promise<Shipment> {
        // Generate tracking code
        const trackingCode = await this.generateTrackingCode();

        // Create shipment record
        const shipmentId = nanoid();
        const now = new Date();

        const newShipment = {
            id: shipmentId,
            trackingCode,
            leadId: shipmentData.leadId || null,
            customerName: shipmentData.customerName,
            customerEmail: shipmentData.customerEmail,
            customerPhone: shipmentData.customerPhone || null,
            packageDescription: shipmentData.packageDescription || null,
            weight: shipmentData.weight || null,
            dimensions: shipmentData.dimensions ? JSON.stringify(shipmentData.dimensions) : null,
            value: shipmentData.value || null,
            originAddress: JSON.stringify(shipmentData.originAddress),
            destinationAddress: JSON.stringify(shipmentData.destinationAddress),
            courier: shipmentData.courier,
            courierTrackingNumber: shipmentData.courierTrackingNumber || null,
            shippingMethod: shipmentData.shippingMethod || null,
            status: 'pending' as ShipmentStatusType,
            estimatedDelivery: shipmentData.estimatedDelivery || null,
            actualDelivery: null,
            lastApiSync: null,
            apiProvider: shipmentData.apiProvider || null,
            apiTrackingId: shipmentData.apiTrackingId || null,
            notes: shipmentData.notes || null,
            specialInstructions: shipmentData.specialInstructions || null,
            createdBy: createdBy || null,
            createdAt: now,
            updatedAt: now,
        };

        // Insert shipment
        await db.insert(shipments).values(newShipment);

        // Create initial shipment event
        await this.addEvent({
            shipmentId,
            eventType: 'status_change',
            status: 'pending',
            description: 'Shipment created',
            source: 'manual',
            sourceId: createdBy,
            eventTime: now,
        });

        // Trigger shipment creation notification
        await notificationEventHandlers.handleShipmentCreated({
            id: shipmentId,
            trackingCode,
            customerName: shipmentData.customerName,
            customerEmail: shipmentData.customerEmail,
            courier: shipmentData.courier,
            status: 'pending',
            createdBy,
            leadId: shipmentData.leadId || null,
        });

        // Return the created shipment with parsed JSON fields
        return {
            ...newShipment,
            status: newShipment.status as ShipmentStatusType,
            apiProvider: newShipment.apiProvider as any,
            originAddress: JSON.parse(newShipment.originAddress),
            destinationAddress: JSON.parse(newShipment.destinationAddress),
            dimensions: newShipment.dimensions ? JSON.parse(newShipment.dimensions) : null,
        };
    }

    /**
     * Update shipment status with conflict detection
     */
    async updateStatus(
        shipmentId: string,
        newStatus: ShipmentStatusType,
        source: EventSourceType = 'manual',
        sourceId?: string,
        notes?: string,
        eventTime?: Date
    ): Promise<void> {
        // Get current shipment
        const [currentShipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!currentShipment) {
            throw new ShipmentError(`Shipment with ID ${shipmentId} not found`, 'SHIPMENT_NOT_FOUND');
        }

        const currentStatus = currentShipment.status as ShipmentStatusType;

        // Validate status transition
        this.validateStatusTransition(currentStatus, newStatus);

        // Conflict detection for manual updates
        if (source === 'manual') {
            await this.detectAndHandleConflicts(shipmentId, currentShipment, newStatus, sourceId);
        }

        const now = new Date();
        const updateData: any = {
            status: newStatus,
            updatedAt: now,
        };

        // Set actual delivery date if status is delivered
        if (newStatus === 'delivered') {
            updateData.actualDelivery = eventTime || now;
        }

        // Update shipment
        await db
            .update(shipments)
            .set(updateData)
            .where(eq(shipments.id, shipmentId));

        // Create status change event using event service
        const { shipmentEventService } = await import('@/lib/shipmentEventService');
        await shipmentEventService.addStatusChangeEvent(
            shipmentId,
            newStatus,
            source,
            sourceId,
            notes || `Status changed from ${currentStatus} to ${newStatus}`,
            eventTime || now
        );
    }

    /**
     * Detect and handle conflicts between manual updates and API updates
     */
    private async detectAndHandleConflicts(
        shipmentId: string,
        currentShipment: any,
        newStatus: ShipmentStatusType,
        adminUserId?: string
    ): Promise<void> {
        // Get recent API events (within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const recentApiEvents = await db
            .select()
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.shipmentId, shipmentId),
                    eq(shipmentEvents.source, 'api'),
                    gte(shipmentEvents.eventTime, fiveMinutesAgo)
                )
            )
            .orderBy(desc(shipmentEvents.eventTime))
            .limit(5);

        // Check if there are recent API updates that might conflict
        if (recentApiEvents.length > 0) {
            const latestApiEvent = recentApiEvents[0];

            // If the latest API event has a different status than what we're trying to set
            if (latestApiEvent.status && latestApiEvent.status !== newStatus) {
                // Log a conflict detection event
                const { shipmentEventService } = await import('@/lib/shipmentEventService');
                await shipmentEventService.addEvent({
                    shipmentId,
                    eventType: 'status_change',
                    description: `Manual status update conflict detected. API recently updated to ${latestApiEvent.status}, admin is changing to ${newStatus}`,
                    source: 'manual',
                    sourceId: adminUserId,
                    eventTime: new Date(),
                    metadata: {
                        conflictType: 'api_manual_conflict',
                        apiStatus: latestApiEvent.status,
                        manualStatus: newStatus,
                        apiEventTime: latestApiEvent.eventTime,
                        apiEventId: latestApiEvent.id,
                        adminOverride: true,
                    },
                });

                console.warn(`Status conflict detected for shipment ${shipmentId}:`, {
                    apiStatus: latestApiEvent.status,
                    manualStatus: newStatus,
                    apiEventTime: latestApiEvent.eventTime,
                    adminUserId,
                });
            }
        }

        // Check for rapid status changes (potential conflicts)
        const recentStatusChanges = await db
            .select()
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.shipmentId, shipmentId),
                    eq(shipmentEvents.eventType, 'status_change'),
                    gte(shipmentEvents.eventTime, fiveMinutesAgo)
                )
            )
            .orderBy(desc(shipmentEvents.eventTime));

        if (recentStatusChanges.length >= 2) {
            // Multiple status changes in short time - potential conflict
            const { shipmentEventService } = await import('@/lib/shipmentEventService');
            await shipmentEventService.addEvent({
                shipmentId,
                eventType: 'status_change',
                description: `Rapid status changes detected. ${recentStatusChanges.length} changes in last 5 minutes`,
                source: 'manual',
                sourceId: adminUserId,
                eventTime: new Date(),
                metadata: {
                    conflictType: 'rapid_status_changes',
                    recentChangesCount: recentStatusChanges.length,
                    recentChanges: recentStatusChanges.map(event => ({
                        status: event.status,
                        source: event.source,
                        eventTime: event.eventTime,
                    })),
                    adminOverride: true,
                },
            });
        }
    }

    /**
     * Get shipment by ID
     */
    async getById(shipmentId: string): Promise<Shipment | null> {
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!shipment) {
            return null;
        }

        return {
            ...shipment,
            status: shipment.status as ShipmentStatusType,
            apiProvider: shipment.apiProvider as any,
            originAddress: JSON.parse(shipment.originAddress),
            destinationAddress: JSON.parse(shipment.destinationAddress),
            dimensions: shipment.dimensions ? JSON.parse(shipment.dimensions) : null,
        };
    }

    /**
     * Get shipment by tracking code
     */
    async getByTrackingCode(trackingCode: string): Promise<Shipment | null> {
        if (!this.validateTrackingCode(trackingCode)) {
            return null;
        }

        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.trackingCode, trackingCode));

        if (!shipment) {
            return null;
        }

        return {
            ...shipment,
            status: shipment.status as ShipmentStatusType,
            apiProvider: shipment.apiProvider as any,
            originAddress: JSON.parse(shipment.originAddress),
            destinationAddress: JSON.parse(shipment.destinationAddress),
            dimensions: shipment.dimensions ? JSON.parse(shipment.dimensions) : null,
        };
    }

    /**
     * Get shipment by carrier tracking number and carrier
     */
    async getByCarrierTrackingNumber(carrierTrackingNumber: string, carrier: string): Promise<Shipment | null> {
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(
                and(
                    eq(shipments.carrierTrackingNumber, carrierTrackingNumber),
                    eq(shipments.carrier, carrier)
                )
            );

        if (!shipment) {
            return null;
        }

        return {
            ...shipment,
            status: shipment.status as ShipmentStatusType,
            apiProvider: shipment.apiProvider as any,
            originAddress: shipment.originAddress ? JSON.parse(shipment.originAddress) : null,
            destinationAddress: shipment.destinationAddress ? JSON.parse(shipment.destinationAddress) : null,
            dimensions: shipment.dimensions ? JSON.parse(shipment.dimensions) : null,
        };
    }

    /**
     * Get shipment with events
     */
    async getShipmentWithEvents(shipmentId: string): Promise<ShipmentWithEvents | null> {
        const shipment = await this.getById(shipmentId);
        if (!shipment) {
            return null;
        }

        const events = await db
            .select()
            .from(shipmentEvents)
            .where(eq(shipmentEvents.shipmentId, shipmentId))
            .orderBy(desc(shipmentEvents.eventTime));

        return {
            ...shipment,
            events: events.map(event => ({
                ...event,
                eventType: event.eventType as EventTypeType,
                source: event.source as EventSourceType,
                status: event.status as ShipmentStatusType | null,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
            })) as ShipmentEvent[],
        };
    }

    /**
     * Search shipments with filters and pagination
     */
    async searchShipments(params: ShipmentSearchParams = {}): Promise<ShipmentListResponse> {
        const {
            page = 1,
            perPage = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            filters = {},
        } = params;

        const offset = (page - 1) * perPage;

        // Build where conditions
        const whereConditions = [];

        if (filters.status && filters.status.length > 0) {
            whereConditions.push(inArray(shipments.status, filters.status));
        }

        if (filters.carrier && filters.carrier.length > 0) {
            whereConditions.push(inArray(shipments.carrier, filters.carrier));
        }

        if (filters.customerName) {
            whereConditions.push(like(shipments.customerName, `%${filters.customerName}%`));
        }

        if (filters.customerEmail) {
            whereConditions.push(like(shipments.customerEmail, `%${filters.customerEmail}%`));
        }

        if (filters.internalTrackingCode) {
            whereConditions.push(like(shipments.internalTrackingCode, `%${filters.internalTrackingCode}%`));
        }

        if (filters.carrierTrackingNumber) {
            whereConditions.push(like(shipments.carrierTrackingNumber, `%${filters.carrierTrackingNumber}%`));
        }

        if (filters.createdBy) {
            whereConditions.push(eq(shipments.createdBy, filters.createdBy));
        }

        if (filters.dateRange) {
            if (filters.dateRange.start) {
                whereConditions.push(gte(shipments.createdAt, filters.dateRange.start));
            }
            if (filters.dateRange.end) {
                whereConditions.push(lte(shipments.createdAt, filters.dateRange.end));
            }
        }

        if (filters.estimatedDeliveryRange) {
            if (filters.estimatedDeliveryRange.start) {
                whereConditions.push(gte(shipments.estimatedDelivery, filters.estimatedDeliveryRange.start));
            }
            if (filters.estimatedDeliveryRange.end) {
                whereConditions.push(lte(shipments.estimatedDelivery, filters.estimatedDeliveryRange.end));
            }
        }

        if (filters.apiSyncStatus && filters.apiSyncStatus.length > 0) {
            whereConditions.push(inArray(shipments.apiSyncStatus, filters.apiSyncStatus));
        }

        if (filters.needsReview !== undefined) {
            whereConditions.push(eq(shipments.needsReview, filters.needsReview));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(shipments)
            .where(whereClause);

        // Build query with sorting
        let orderByClause;
        if (sortBy === 'createdAt') {
            orderByClause = sortOrder === 'asc' ? shipments.createdAt : desc(shipments.createdAt);
        } else if (sortBy === 'updatedAt') {
            orderByClause = sortOrder === 'asc' ? shipments.updatedAt : desc(shipments.updatedAt);
        } else if (sortBy === 'estimatedDelivery') {
            orderByClause = sortOrder === 'asc' ? shipments.estimatedDelivery : desc(shipments.estimatedDelivery);
        } else if (sortBy === 'customerName') {
            orderByClause = sortOrder === 'asc' ? shipments.customerName : desc(shipments.customerName);
        } else if (sortBy === 'status') {
            orderByClause = sortOrder === 'asc' ? shipments.status : desc(shipments.status);
        } else if (sortBy === 'carrier') {
            orderByClause = sortOrder === 'asc' ? shipments.carrier : desc(shipments.carrier);
        } else {
            orderByClause = desc(shipments.createdAt); // Default
        }

        // Get shipments
        const shipmentResults = await db
            .select()
            .from(shipments)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(perPage)
            .offset(offset);

        const totalPages = Math.ceil(total / perPage);

        return {
            shipments: shipmentResults.map(shipment => ({
                ...shipment,
                status: shipment.status as ShipmentStatusType,
                apiProvider: shipment.apiProvider as any,
                originAddress: JSON.parse(shipment.originAddress),
                destinationAddress: JSON.parse(shipment.destinationAddress),
                dimensions: shipment.dimensions ? JSON.parse(shipment.dimensions) : null,
            })) as Shipment[],
            pagination: {
                page,
                perPage,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    /**
     * Update shipment information
     */
    async updateShipment(shipmentId: string, updates: UpdateShipmentRequest): Promise<Shipment> {
        const currentShipment = await this.getById(shipmentId);
        if (!currentShipment) {
            throw new ShipmentError(`Shipment with ID ${shipmentId} not found`, 'SHIPMENT_NOT_FOUND');
        }

        const updateData: any = {
            updatedAt: new Date(),
        };

        // Handle simple field updates
        const simpleFields = [
            'customerName', 'customerEmail', 'customerPhone',
            'packageDescription', 'weight', 'value',
            'courier', 'courierTrackingNumber', 'shippingMethod',
            'estimatedDelivery', 'actualDelivery',
            'apiProvider', 'apiTrackingId',
            'notes', 'specialInstructions'
        ];

        simpleFields.forEach(field => {
            if (updates[field as keyof UpdateShipmentRequest] !== undefined) {
                updateData[field] = updates[field as keyof UpdateShipmentRequest];
            }
        });

        // Handle JSON fields
        if (updates.dimensions !== undefined) {
            updateData.dimensions = updates.dimensions ? JSON.stringify(updates.dimensions) : null;
        }

        if (updates.originAddress !== undefined) {
            updateData.originAddress = JSON.stringify(updates.originAddress);
        }

        if (updates.destinationAddress !== undefined) {
            updateData.destinationAddress = JSON.stringify(updates.destinationAddress);
        }

        // Handle status update separately to validate transition
        if (updates.status && updates.status !== currentShipment.status) {
            this.validateStatusTransition(currentShipment.status, updates.status);
            updateData.status = updates.status;

            // Set actual delivery date if status is delivered
            if (updates.status === 'delivered') {
                updateData.actualDelivery = updates.actualDelivery || new Date();
            }
        }

        // Update shipment
        await db
            .update(shipments)
            .set(updateData)
            .where(eq(shipments.id, shipmentId));

        // Create update event if status changed
        if (updates.status && updates.status !== currentShipment.status) {
            await this.addEvent({
                shipmentId,
                eventType: 'status_change',
                status: updates.status,
                description: `Status updated to ${updates.status}`,
                source: 'manual',
                eventTime: new Date(),
            });
        }

        // Return updated shipment
        const updatedShipment = await this.getById(shipmentId);
        if (!updatedShipment) {
            throw new ShipmentError('Failed to retrieve updated shipment', 'UPDATE_FAILED');
        }

        return updatedShipment;
    }

    /**
     * Add an event to a shipment (delegates to shipment event service)
     */
    async addEvent(eventData: CreateShipmentEventRequest): Promise<ShipmentEvent> {
        const { shipmentEventService } = await import('@/lib/shipmentEventService');
        return shipmentEventService.addEvent(eventData);
    }

    /**
     * Get events for a shipment (delegates to shipment event service)
     */
    async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
        const { shipmentEventService } = await import('@/lib/shipmentEventService');
        const result = await shipmentEventService.getShipmentEvents(shipmentId);
        return result.events;
    }

    /**
     * Get shipment statistics for dashboard
     */
    async getShipmentStats(): Promise<{
        total: number;
        pending: number;
        inTransit: number;
        delivered: number;
        exception: number;
        cancelled: number;
        recentCount: number;
        needsReview: number;
        apiSyncFailures: number;
        recentActivity: Array<{
            id: string;
            type: 'created' | 'status_change' | 'api_sync' | 'delivered';
            description: string;
            timestamp: Date;
            shipmentId: string;
            internalTrackingCode: string;
        }>;
    }> {
        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(shipments);

        // Get counts by status
        const statusCounts = await db
            .select({
                status: shipments.status,
                count: count(),
            })
            .from(shipments)
            .groupBy(shipments.status);

        // Get recent shipments count (last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [{ recentCount }] = await db
            .select({ recentCount: count() })
            .from(shipments)
            .where(gte(shipments.createdAt, twentyFourHoursAgo));

        // Get shipments that need review (API sync failures)
        const [{ needsReview }] = await db
            .select({ needsReview: count() })
            .from(shipments)
            .where(eq(shipments.needsReview, true));

        // Get API sync failures count
        const [{ apiSyncFailures }] = await db
            .select({ apiSyncFailures: count() })
            .from(shipments)
            .where(eq(shipments.apiSyncStatus, 'failed'));

        // Get recent activity (last 10 events from last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentEvents = await db
            .select({
                id: shipmentEvents.id,
                eventType: shipmentEvents.eventType,
                description: shipmentEvents.description,
                eventTime: shipmentEvents.eventTime,
                shipmentId: shipmentEvents.shipmentId,
                internalTrackingCode: shipments.internalTrackingCode,
                status: shipmentEvents.status,
            })
            .from(shipmentEvents)
            .innerJoin(shipments, eq(shipmentEvents.shipmentId, shipments.id))
            .where(gte(shipmentEvents.eventTime, sevenDaysAgo))
            .orderBy(desc(shipmentEvents.eventTime))
            .limit(10);

        // Initialize counts
        const stats = {
            total,
            pending: 0,
            inTransit: 0,
            delivered: 0,
            exception: 0,
            cancelled: 0,
            recentCount,
            needsReview,
            apiSyncFailures,
            recentActivity: recentEvents.map(event => ({
                id: event.id,
                type: event.eventType === 'shipment_created' ? 'created' as const :
                    event.eventType === 'status_change' && event.status === 'delivered' ? 'delivered' as const :
                        event.eventType === 'status_change' ? 'status_change' as const :
                            event.eventType === 'api_sync' ? 'api_sync' as const :
                                'status_change' as const,
                description: event.description,
                timestamp: event.eventTime,
                shipmentId: event.shipmentId,
                internalTrackingCode: event.internalTrackingCode,
            })),
        };

        // Map status counts
        statusCounts.forEach(({ status, count }) => {
            switch (status) {
                case 'pending':
                    stats.pending = count;
                    break;
                case 'in-transit':
                case 'out-for-delivery':
                    stats.inTransit += count;
                    break;
                case 'delivered':
                    stats.delivered = count;
                    break;
                case 'exception':
                    stats.exception = count;
                    break;
                case 'cancelled':
                    stats.cancelled = count;
                    break;
            }
        });

        return stats;
    }

    /**
     * Delete a shipment (admin only)
     */
    async deleteShipment(shipmentId: string): Promise<void> {
        const shipment = await this.getById(shipmentId);
        if (!shipment) {
            throw new ShipmentError(`Shipment with ID ${shipmentId} not found`, 'SHIPMENT_NOT_FOUND');
        }

        // If shipment was created from a lead, update the lead
        if (shipment.leadId) {
            await db
                .update(leads)
                .set({
                    shipmentId: null,
                    status: 'success', // Revert to success status
                    updatedAt: new Date(),
                })
                .where(eq(leads.id, shipment.leadId));
        }

        // Delete shipment (events will be cascade deleted)
        await db.delete(shipments).where(eq(shipments.id, shipmentId));
    }


}

// Export singleton instance
export const shipmentService = new ShipmentService();