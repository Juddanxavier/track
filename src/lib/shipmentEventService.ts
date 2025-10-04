/** @format */

import { db } from '@/database/db';
import { shipmentEvents, shipments, leads } from '@/database/schema';
import { and, eq, desc, count, gte, lte, inArray, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
    ShipmentEvent,
    CreateShipmentEventRequest,
    ShipmentEventListResponse,
    ShipmentEventSearchParams,
    ShipmentEventFilters,
    EventTypeType,
    EventSourceType,
    ShipmentStatusType,
} from '@/types/shipment';
import { ShipmentError } from '@/types/shipment';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

export class ShipmentEventService {
    /**
     * Add an event to a shipment with audit trail functionality
     */
    async addEvent(eventData: CreateShipmentEventRequest): Promise<ShipmentEvent> {
        // Validate that the shipment exists
        const [shipment] = await db
            .select({ id: shipments.id })
            .from(shipments)
            .where(eq(shipments.id, eventData.shipmentId));

        if (!shipment) {
            throw new ShipmentError(
                `Shipment with ID ${eventData.shipmentId} not found`,
                'SHIPMENT_NOT_FOUND'
            );
        }

        const eventId = nanoid();
        const now = new Date();

        const newEvent = {
            id: eventId,
            shipmentId: eventData.shipmentId,
            eventType: eventData.eventType,
            status: eventData.status || null,
            description: eventData.description,
            location: eventData.location || null,
            source: eventData.source,
            sourceId: eventData.sourceId || null,
            eventTime: eventData.eventTime,
            recordedAt: now,
            metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : null,
        };

        await db.insert(shipmentEvents).values(newEvent);

        return {
            ...newEvent,
            metadata: eventData.metadata || null,
        } as ShipmentEvent;
    }

    /**
     * Add a status change event with validation and enhanced audit trail
     */
    async addStatusChangeEvent(
        shipmentId: string,
        newStatus: ShipmentStatusType,
        source: EventSourceType = 'manual',
        sourceId?: string,
        notes?: string,
        eventTime?: Date,
        location?: string,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        const description = notes || `Status changed to ${newStatus}`;

        // Get shipment details for notifications and audit trail
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        // Enhanced metadata for manual updates
        let enhancedMetadata = metadata || {};

        if (source === 'manual' && sourceId) {
            // Enhanced metadata for manual updates with basic audit info
            enhancedMetadata = {
                ...enhancedMetadata,
                manualUpdate: true,
                adminUser: {
                    id: sourceId,
                },
                previousStatus: shipment?.status,
                updateReason: notes || 'Manual status update',
                timestamp: new Date().toISOString(),
                auditTrail: {
                    action: 'status_update',
                    source: 'admin_dashboard',
                    recordedAt: new Date().toISOString(),
                },
            };
        }

        const event = await this.addEvent({
            shipmentId,
            eventType: 'status_change',
            status: newStatus,
            description,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata: enhancedMetadata,
        });

        // Trigger appropriate notifications based on status
        if (shipment) {
            await this.triggerStatusChangeNotifications(shipment, newStatus, location, eventTime);
        }

        return event;
    }

    /**
     * Add a manual audit event for tracking admin actions
     */
    async addManualAuditEvent(
        shipmentId: string,
        action: string,
        adminUserId: string,
        details?: Record<string, any>,
        eventTime?: Date
    ): Promise<ShipmentEvent> {
        return this.addEvent({
            shipmentId,
            eventType: 'status_change',
            description: `Admin action: ${action}`,
            source: 'manual',
            sourceId: adminUserId,
            eventTime: eventTime || new Date(),
            metadata: {
                auditEvent: true,
                action,
                adminUserId,
                details: details || {},
                timestamp: new Date().toISOString(),
            },
        });
    }

    /**
     * Trigger notifications based on status changes
     */
    private async triggerStatusChangeNotifications(
        shipment: any,
        newStatus: ShipmentStatusType,
        location?: string,
        eventTime?: Date
    ): Promise<void> {
        try {
            // Get customer ID from lead if shipment was created from a lead
            let customerId = null;
            if (shipment.leadId) {
                const [lead] = await db
                    .select({ customerId: leads.customerId })
                    .from(leads)
                    .where(eq(leads.id, shipment.leadId));

                customerId = lead?.customerId || null;
            }

            const shipmentData = {
                id: shipment.id,
                trackingCode: shipment.trackingCode,
                customerName: shipment.customerName,
                customerEmail: shipment.customerEmail,
                customerId,
                courier: shipment.courier,
                estimatedDelivery: shipment.estimatedDelivery,
                location,
            };

            // Get the old status for status update notifications
            const oldStatus = shipment.status;

            switch (newStatus) {
                case 'delivered':
                    await notificationEventHandlers.handleShipmentDelivered({
                        ...shipmentData,
                        deliveryDate: eventTime || new Date(),
                    });
                    break;

                case 'out-for-delivery':
                    await notificationEventHandlers.handleShipmentOutForDelivery(shipmentData);
                    break;

                case 'in-transit':
                    await notificationEventHandlers.handleShipmentInTransit(shipmentData);
                    break;

                case 'exception':
                    // For exceptions, we need the exception reason from metadata or description
                    const exceptionReason = 'Exception occurred';
                    await notificationEventHandlers.handleShipmentException({
                        ...shipmentData,
                        exceptionReason,
                        eventTime: eventTime || new Date(),
                    });
                    break;

                default:
                    // For other status changes, send general status update notification
                    await notificationEventHandlers.handleShipmentStatusUpdate({
                        ...shipmentData,
                        oldStatus,
                        newStatus,
                        updatedBy: undefined,
                    });
                    break;
            }
        } catch (error) {
            console.error('Failed to trigger status change notifications:', error);
            // Don't throw error to avoid breaking the main flow
        }
    }

    /**
     * Add a location update event
     */
    async addLocationUpdateEvent(
        shipmentId: string,
        location: string,
        description: string,
        source: EventSourceType = 'api',
        sourceId?: string,
        eventTime?: Date,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        return this.addEvent({
            shipmentId,
            eventType: 'location_update',
            description,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata,
        });
    }

    /**
     * Add a delivery attempt event
     */
    async addDeliveryAttemptEvent(
        shipmentId: string,
        description: string,
        location?: string,
        source: EventSourceType = 'api',
        sourceId?: string,
        eventTime?: Date,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        return this.addEvent({
            shipmentId,
            eventType: 'delivery_attempt',
            description,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata,
        });
    }

    /**
     * Add an exception event
     */
    async addExceptionEvent(
        shipmentId: string,
        description: string,
        location?: string,
        source: EventSourceType = 'api',
        sourceId?: string,
        eventTime?: Date,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        // Get shipment details for notifications
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        const event = await this.addEvent({
            shipmentId,
            eventType: 'exception',
            status: 'exception',
            description,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata,
        });

        // Trigger exception notification
        if (shipment) {
            await notificationEventHandlers.handleShipmentException({
                id: shipment.id,
                trackingCode: shipment.trackingCode,
                customerName: shipment.customerName,
                customerEmail: shipment.customerEmail,
                courier: shipment.courier,
                exceptionReason: description,
                location,
                eventTime: eventTime || new Date(),
            });
        }

        return event;
    }

    /**
     * Add a delivery failure event
     */
    async addDeliveryFailureEvent(
        shipmentId: string,
        failureReason: string,
        attemptNumber: number,
        nextAttemptDate?: Date,
        location?: string,
        source: EventSourceType = 'api',
        sourceId?: string,
        eventTime?: Date,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        // Get shipment details for notifications
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        const event = await this.addEvent({
            shipmentId,
            eventType: 'delivery_attempt',
            description: `Delivery attempt ${attemptNumber} failed: ${failureReason}`,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata: {
                ...metadata,
                failureReason,
                attemptNumber,
                nextAttemptDate,
            },
        });

        // Trigger delivery failure notification
        if (shipment) {
            await notificationEventHandlers.handleShipmentDeliveryFailed({
                id: shipment.id,
                trackingCode: shipment.trackingCode,
                customerName: shipment.customerName,
                customerEmail: shipment.customerEmail,
                courier: shipment.courier,
                failureReason,
                attemptNumber,
                nextAttemptDate,
                location,
            });
        }

        return event;
    }

    /**
     * Add a shipment delay event
     */
    async addDelayEvent(
        shipmentId: string,
        delayReason: string,
        originalDelivery?: Date,
        newEstimatedDelivery?: Date,
        location?: string,
        source: EventSourceType = 'api',
        sourceId?: string,
        eventTime?: Date,
        metadata?: Record<string, any>
    ): Promise<ShipmentEvent> {
        // Get shipment details for notifications
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        const event = await this.addEvent({
            shipmentId,
            eventType: 'exception',
            description: `Shipment delayed: ${delayReason}`,
            location,
            source,
            sourceId,
            eventTime: eventTime || new Date(),
            metadata: {
                ...metadata,
                delayReason,
                originalDelivery,
                newEstimatedDelivery,
                isDelay: true,
            },
        });

        // Trigger delay notification
        if (shipment) {
            await notificationEventHandlers.handleShipmentDelayed({
                id: shipment.id,
                trackingCode: shipment.trackingCode,
                customerName: shipment.customerName,
                customerEmail: shipment.customerEmail,
                courier: shipment.courier,
                delayReason,
                originalDelivery,
                newEstimatedDelivery,
                location,
            });
        }

        return event;
    }

    /**
     * Get events for a specific shipment
     */
    async getShipmentEvents(
        shipmentId: string,
        params: Omit<ShipmentEventSearchParams, 'filters'> & {
            filters?: ShipmentEventFilters;
        } = {}
    ): Promise<ShipmentEventListResponse> {
        const {
            page = 1,
            perPage = 50,
            sortBy = 'eventTime',
            sortOrder = 'desc',
            filters = {},
        } = params;

        const offset = (page - 1) * perPage;

        // Build where conditions
        const whereConditions = [eq(shipmentEvents.shipmentId, shipmentId)];

        if (filters.eventType && filters.eventType.length > 0) {
            whereConditions.push(inArray(shipmentEvents.eventType, filters.eventType));
        }

        if (filters.source && filters.source.length > 0) {
            whereConditions.push(inArray(shipmentEvents.source, filters.source));
        }

        if (filters.dateRange) {
            if (filters.dateRange.start) {
                whereConditions.push(gte(shipmentEvents.eventTime, filters.dateRange.start));
            }
            if (filters.dateRange.end) {
                whereConditions.push(lte(shipmentEvents.eventTime, filters.dateRange.end));
            }
        }

        const whereClause = and(...whereConditions);

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(shipmentEvents)
            .where(whereClause);

        // Build query with sorting
        let orderByClause;
        if (sortBy === 'eventTime') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.eventTime) : desc(shipmentEvents.eventTime);
        } else if (sortBy === 'recordedAt') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.recordedAt) : desc(shipmentEvents.recordedAt);
        } else if (sortBy === 'eventType') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.eventType) : desc(shipmentEvents.eventType);
        } else {
            orderByClause = desc(shipmentEvents.eventTime); // Default
        }

        // Get events
        const eventResults = await db
            .select()
            .from(shipmentEvents)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(perPage)
            .offset(offset);

        const totalPages = Math.ceil(total / perPage);

        return {
            events: eventResults.map(event => ({
                ...event,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
            })) as ShipmentEvent[],
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
     * Search events across all shipments with advanced filtering
     */
    async searchEvents(params: ShipmentEventSearchParams = {}): Promise<ShipmentEventListResponse> {
        const {
            page = 1,
            perPage = 50,
            sortBy = 'eventTime',
            sortOrder = 'desc',
            filters = {},
        } = params;

        const offset = (page - 1) * perPage;

        // Build where conditions
        const whereConditions = [];

        if (filters.eventType && filters.eventType.length > 0) {
            whereConditions.push(inArray(shipmentEvents.eventType, filters.eventType));
        }

        if (filters.source && filters.source.length > 0) {
            whereConditions.push(inArray(shipmentEvents.source, filters.source));
        }

        if (filters.dateRange) {
            if (filters.dateRange.start) {
                whereConditions.push(gte(shipmentEvents.eventTime, filters.dateRange.start));
            }
            if (filters.dateRange.end) {
                whereConditions.push(lte(shipmentEvents.eventTime, filters.dateRange.end));
            }
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(shipmentEvents)
            .where(whereClause);

        // Build query with sorting
        let orderByClause;
        if (sortBy === 'eventTime') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.eventTime) : desc(shipmentEvents.eventTime);
        } else if (sortBy === 'recordedAt') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.recordedAt) : desc(shipmentEvents.recordedAt);
        } else if (sortBy === 'eventType') {
            orderByClause = sortOrder === 'asc' ? asc(shipmentEvents.eventType) : desc(shipmentEvents.eventType);
        } else {
            orderByClause = desc(shipmentEvents.eventTime); // Default
        }

        // Get events
        const eventResults = await db
            .select()
            .from(shipmentEvents)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(perPage)
            .offset(offset);

        const totalPages = Math.ceil(total / perPage);

        return {
            events: eventResults.map(event => ({
                ...event,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
            })) as ShipmentEvent[],
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
     * Get the latest event for a shipment
     */
    async getLatestEvent(shipmentId: string): Promise<ShipmentEvent | null> {
        const [event] = await db
            .select()
            .from(shipmentEvents)
            .where(eq(shipmentEvents.shipmentId, shipmentId))
            .orderBy(desc(shipmentEvents.eventTime))
            .limit(1);

        if (!event) {
            return null;
        }

        return {
            ...event,
            metadata: event.metadata ? JSON.parse(event.metadata) : null,
        } as ShipmentEvent;
    }

    /**
     * Get events by source for audit trail analysis
     */
    async getEventsBySource(
        source: EventSourceType,
        params: Omit<ShipmentEventSearchParams, 'filters'> = {}
    ): Promise<ShipmentEventListResponse> {
        return this.searchEvents({
            ...params,
            filters: {
                source: [source],
            },
        });
    }

    /**
     * Get manual events (for audit trail of admin actions)
     */
    async getManualEvents(params: Omit<ShipmentEventSearchParams, 'filters'> = {}): Promise<ShipmentEventListResponse> {
        return this.getEventsBySource('manual', params);
    }

    /**
     * Get API events (for tracking API integration issues)
     */
    async getApiEvents(params: Omit<ShipmentEventSearchParams, 'filters'> = {}): Promise<ShipmentEventListResponse> {
        return this.getEventsBySource('api', params);
    }

    /**
     * Get webhook events (for real-time tracking updates)
     */
    async getWebhookEvents(params: Omit<ShipmentEventSearchParams, 'filters'> = {}): Promise<ShipmentEventListResponse> {
        return this.getEventsBySource('webhook', params);
    }

    /**
     * Get status change events for a shipment (audit trail)
     */
    async getStatusChangeEvents(shipmentId: string): Promise<ShipmentEvent[]> {
        const events = await db
            .select()
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.shipmentId, shipmentId),
                    eq(shipmentEvents.eventType, 'status_change')
                )
            )
            .orderBy(desc(shipmentEvents.eventTime));

        return events.map(event => ({
            ...event,
            metadata: event.metadata ? JSON.parse(event.metadata) : null,
        })) as ShipmentEvent[];
    }

    /**
     * Get events within a date range for reporting
     */
    async getEventsInDateRange(
        startDate: Date,
        endDate: Date,
        params: Omit<ShipmentEventSearchParams, 'filters'> = {}
    ): Promise<ShipmentEventListResponse> {
        return this.searchEvents({
            ...params,
            filters: {
                dateRange: {
                    start: startDate,
                    end: endDate,
                },
            },
        });
    }

    /**
     * Delete events for a shipment (admin only, for cleanup)
     */
    async deleteShipmentEvents(shipmentId: string): Promise<number> {
        const result = await db
            .delete(shipmentEvents)
            .where(eq(shipmentEvents.shipmentId, shipmentId));

        return result.rowCount || 0;
    }

    /**
     * Get event statistics for reporting
     */
    async getEventStatistics(
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalEvents: number;
        eventsByType: Record<EventTypeType, number>;
        eventsBySource: Record<EventSourceType, number>;
        eventsPerDay: Array<{ date: string; count: number }>;
    }> {
        const whereConditions = [];

        if (startDate) {
            whereConditions.push(gte(shipmentEvents.eventTime, startDate));
        }

        if (endDate) {
            whereConditions.push(lte(shipmentEvents.eventTime, endDate));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Get all events in the date range
        const events = await db
            .select({
                eventType: shipmentEvents.eventType,
                source: shipmentEvents.source,
                eventTime: shipmentEvents.eventTime,
            })
            .from(shipmentEvents)
            .where(whereClause);

        // Calculate statistics
        const totalEvents = events.length;

        const eventsByType: Record<string, number> = {};
        const eventsBySource: Record<string, number> = {};
        const eventsPerDay: Record<string, number> = {};

        events.forEach(event => {
            // Count by type
            eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

            // Count by source
            eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;

            // Count by day
            const dateKey = event.eventTime.toISOString().split('T')[0];
            eventsPerDay[dateKey] = (eventsPerDay[dateKey] || 0) + 1;
        });

        return {
            totalEvents,
            eventsByType: eventsByType as Record<EventTypeType, number>,
            eventsBySource: eventsBySource as Record<EventSourceType, number>,
            eventsPerDay: Object.entries(eventsPerDay).map(([date, count]) => ({
                date,
                count,
            })),
        };
    }
}

// Export singleton instance
export const shipmentEventService = new ShipmentEventService();