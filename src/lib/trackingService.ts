/** @format */

import { db } from '@/database/db';
import { shipments, shipmentEvents } from '@/database/schema';
import { eq, and, isNotNull, lt, inArray, or, isNull, gte, sql } from 'drizzle-orm';
import {
    TrackingAPIAdapter,
    createTrackingAdapter,
    getTrackingAdapterConfig,
    CreateTrackingData,
} from '@/lib/trackingApiAdapter';
import {
    Shipment,
    ShipmentEvent,
    APITrackingEvent,
    ShipmentStatusType,
    EventTypeType,
    EventSourceType,
    APIIntegrationError,
    ShipmentError,
} from '@/types/shipment';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';

/**
 * Service for managing third-party tracking API synchronization
 */
export class TrackingService {
    private adapter: TrackingAPIAdapter | null = null;
    private rateLimitQueue: Map<string, number> = new Map();
    private readonly maxRetries = 3;
    private readonly baseRetryDelay = 1000; // 1 second
    private readonly maxConcurrentRequests = 5;
    private readonly rateLimitWindow = 60000; // 1 minute
    private readonly maxRequestsPerWindow = 100;

    constructor() {
        this.initializeAdapter();
    }

    /**
     * Initialize the tracking API adapter based on configuration
     */
    private initializeAdapter(): void {
        try {
            const config = getTrackingAdapterConfig();
            if (config) {
                this.adapter = createTrackingAdapter(config.provider, config.config);
                console.log(`Initialized tracking adapter: ${config.provider}`);
            } else {
                console.warn('No tracking API configuration found. API synchronization will be disabled.');
            }
        } catch (error) {
            console.error('Failed to initialize tracking adapter:', error);
            this.adapter = null;
        }
    }

    /**
     * Check if API integration is available
     */
    isApiAvailable(): boolean {
        return this.adapter !== null;
    }

    /**
     * Get the current adapter provider name
     */
    getProviderName(): string | null {
        return this.adapter?.getProviderName() || null;
    }

    /**
     * Create tracking for a shipment with the third-party API
     */
    async createTracking(shipment: Shipment): Promise<void> {
        if (!this.adapter) {
            throw new APIIntegrationError('No tracking API adapter available', 'none');
        }

        if (!shipment.courierTrackingNumber) {
            throw new APIIntegrationError(
                'Courier tracking number is required for API integration',
                this.adapter.getProviderName()
            );
        }

        try {
            await this.checkRateLimit();

            const trackingData: CreateTrackingData = {
                shipmentId: shipment.id,
                trackingCode: shipment.trackingCode,
                courierTrackingNumber: shipment.courierTrackingNumber,
                originAddress: shipment.originAddress,
                destinationAddress: shipment.destinationAddress,
                packageDetails: {
                    description: shipment.packageDescription || undefined,
                    weight: shipment.weight || undefined,
                    dimensions: shipment.dimensions || undefined,
                    value: shipment.value || undefined,
                },
                courier: shipment.courier,
                shippingMethod: shipment.shippingMethod || undefined,
            };

            const response = await this.executeWithRetry(
                () => this.adapter!.createTracking(trackingData),
                `create-tracking-${shipment.id}`
            );

            // Update shipment with API tracking information
            await db
                .update(shipments)
                .set({
                    apiTrackingId: response.trackingId,
                    apiProvider: this.adapter.getProviderName(),
                    lastApiSync: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(shipments.id, shipment.id));

            // Process initial events from API response
            if (response.events && response.events.length > 0) {
                await this.processApiEvents(shipment.id, response.events);
            }

            console.log(`Created tracking for shipment ${shipment.id} with API tracking ID: ${response.trackingId}`);
        } catch (error) {
            console.error(`Failed to create tracking for shipment ${shipment.id}:`, error);

            // Log the error as a shipment event
            await shipmentEventService.addEvent({
                shipmentId: shipment.id,
                eventType: 'exception',
                description: `Failed to create API tracking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                source: 'api',
                sourceId: this.adapter.getProviderName(),
                eventTime: new Date(),
                metadata: { error: error instanceof Error ? error.message : String(error) },
            });

            throw error;
        }
    }

    /**
     * Synchronize tracking data for a specific shipment
     */
    async syncWithAPI(shipmentId: string): Promise<void> {
        if (!this.adapter) {
            throw new APIIntegrationError('No tracking API adapter available', 'none');
        }

        const shipment = await shipmentService.getById(shipmentId);
        if (!shipment) {
            throw new ShipmentError(`Shipment with ID ${shipmentId} not found`, 'SHIPMENT_NOT_FOUND');
        }

        if (!shipment.apiTrackingId) {
            // Try to create tracking if it doesn't exist
            if (shipment.courierTrackingNumber) {
                await this.createTracking(shipment);
                return;
            } else {
                throw new APIIntegrationError(
                    'No API tracking ID or courier tracking number available for synchronization',
                    this.adapter.getProviderName()
                );
            }
        }

        try {
            await this.checkRateLimit();

            const events = await this.executeWithRetry(
                () => this.adapter!.getTrackingUpdates(shipment.apiTrackingId!),
                `sync-${shipmentId}`
            );

            // Process new events
            await this.processApiEvents(shipmentId, events);

            // Update last sync time
            await db
                .update(shipments)
                .set({
                    lastApiSync: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(shipments.id, shipmentId));

            console.log(`Synchronized tracking data for shipment ${shipmentId}, processed ${events.length} events`);
        } catch (error) {
            console.error(`Failed to sync tracking for shipment ${shipmentId}:`, error);

            // Log the error as a shipment event
            await shipmentEventService.addEvent({
                shipmentId,
                eventType: 'exception',
                description: `Failed to sync API tracking: ${error instanceof Error ? error.message : 'Unknown error'}`,
                source: 'api',
                sourceId: this.adapter.getProviderName(),
                eventTime: new Date(),
                metadata: { error: error instanceof Error ? error.message : String(error) },
            });

            throw error;
        }
    }

    /**
     * Batch synchronization for multiple shipments
     */
    async batchSync(shipmentIds?: string[], maxConcurrent: number = this.maxConcurrentRequests): Promise<{
        successful: string[];
        failed: { shipmentId: string; error: string }[];
    }> {
        if (!this.adapter) {
            throw new APIIntegrationError('No tracking API adapter available', 'none');
        }

        // Get shipments to sync
        let shipmentsToSync: Shipment[];

        if (shipmentIds && shipmentIds.length > 0) {
            // Sync specific shipments
            const shipmentPromises = shipmentIds.map(id => shipmentService.getById(id));
            const shipmentResults = await Promise.all(shipmentPromises);
            shipmentsToSync = shipmentResults.filter((s): s is Shipment => s !== null);
        } else {
            // Sync all active shipments that haven't been synced recently
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery'];

            const shipmentResults = await db
                .select()
                .from(shipments)
                .where(
                    and(
                        inArray(shipments.status, activeStatuses),
                        isNotNull(shipments.apiTrackingId),
                        or(
                            lt(shipments.lastApiSync, oneHourAgo),
                            isNull(shipments.lastApiSync)
                        )
                    )
                )
                .limit(100); // Limit to prevent overwhelming the API

            shipmentsToSync = shipmentResults.map(shipment => ({
                ...shipment,
                status: shipment.status as ShipmentStatusType,
                apiProvider: shipment.apiProvider as any,
                originAddress: JSON.parse(shipment.originAddress),
                destinationAddress: JSON.parse(shipment.destinationAddress),
                dimensions: shipment.dimensions ? JSON.parse(shipment.dimensions) : null,
            }));
        }

        console.log(`Starting batch sync for ${shipmentsToSync.length} shipments`);

        const successful: string[] = [];
        const failed: { shipmentId: string; error: string }[] = [];

        // Process shipments in batches to respect rate limits
        const batches = this.chunkArray(shipmentsToSync, maxConcurrent);

        for (const batch of batches) {
            const batchPromises = batch.map(async (shipment) => {
                try {
                    await this.syncWithAPI(shipment.id);
                    successful.push(shipment.id);
                } catch (error) {
                    failed.push({
                        shipmentId: shipment.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            });

            await Promise.all(batchPromises);

            // Add delay between batches to respect rate limits
            if (batches.indexOf(batch) < batches.length - 1) {
                await this.delay(1000);
            }
        }

        console.log(`Batch sync completed: ${successful.length} successful, ${failed.length} failed`);

        return { successful, failed };
    }

    /**
     * Process API events and update shipment status
     */
    private async processApiEvents(shipmentId: string, apiEvents: APITrackingEvent[]): Promise<void> {
        if (!apiEvents || apiEvents.length === 0) {
            return;
        }

        // Get existing events to avoid duplicates
        const existingEvents = await db
            .select()
            .from(shipmentEvents)
            .where(
                and(
                    eq(shipmentEvents.shipmentId, shipmentId),
                    eq(shipmentEvents.source, 'api')
                )
            );

        const existingEventTimes = new Set(
            existingEvents.map(e => e.eventTime.getTime())
        );

        // Filter out events we've already processed
        const newEvents = apiEvents.filter(
            event => !existingEventTimes.has(event.eventTime.getTime())
        );

        if (newEvents.length === 0) {
            return;
        }

        // Sort events by time (oldest first)
        newEvents.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());

        let latestStatus: ShipmentStatusType | undefined;

        // Process each new event
        for (const apiEvent of newEvents) {
            const mappedStatus = this.mapApiEventToStatus(apiEvent);

            await shipmentEventService.addEvent({
                shipmentId,
                eventType: apiEvent.eventType as EventTypeType,
                status: mappedStatus,
                description: apiEvent.description,
                location: apiEvent.location,
                source: 'api',
                sourceId: this.adapter?.getProviderName(),
                eventTime: apiEvent.eventTime,
                metadata: apiEvent.metadata,
            });

            // Track the latest status change
            if (mappedStatus) {
                latestStatus = mappedStatus;
            }
        }

        // Update shipment status to the latest status from API events
        if (latestStatus) {
            const currentShipment = await shipmentService.getById(shipmentId);
            if (currentShipment && currentShipment.status !== latestStatus) {
                try {
                    await shipmentService.updateStatus(
                        shipmentId,
                        latestStatus,
                        'api',
                        this.adapter?.getProviderName(),
                        `Status updated from API: ${latestStatus}`,
                        newEvents[newEvents.length - 1].eventTime
                    );
                } catch (error) {
                    // Log but don't fail if status transition is invalid
                    console.warn(`Could not update status for shipment ${shipmentId} to ${latestStatus}:`, error);
                }
            }
        }
    }

    /**
     * Map API event to internal shipment status
     */
    private mapApiEventToStatus(apiEvent: APITrackingEvent): ShipmentStatusType | undefined {
        const eventType = apiEvent.eventType.toLowerCase();
        const description = apiEvent.description.toLowerCase();

        // Map based on event type first
        switch (apiEvent.eventType as EventTypeType) {
            case 'pickup':
                return 'in-transit';
            case 'in_transit':
                return 'in-transit';
            case 'out_for_delivery':
                return 'out-for-delivery';
            case 'delivered':
                return 'delivered';
            case 'exception':
                return 'exception';
            case 'cancelled':
                return 'cancelled';
        }

        // Fallback to description-based mapping
        if (description.includes('delivered') || description.includes('signed')) {
            return 'delivered';
        }
        if (description.includes('out for delivery') || description.includes('loaded for delivery')) {
            return 'out-for-delivery';
        }
        if (description.includes('in transit') || description.includes('departed') || description.includes('arrived')) {
            return 'in-transit';
        }
        if (description.includes('exception') || description.includes('delay') || description.includes('hold')) {
            return 'exception';
        }
        if (description.includes('cancelled') || description.includes('returned')) {
            return 'cancelled';
        }

        // No status change for location updates and other events
        return undefined;
    }

    /**
     * Execute a function with exponential backoff retry logic
     */
    private async executeWithRetry<T>(
        fn: () => Promise<T>,
        operationId: string,
        retryCount: number = 0
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retryCount >= this.maxRetries) {
                throw error;
            }

            const delay = this.baseRetryDelay * Math.pow(2, retryCount);
            console.warn(
                `Operation ${operationId} failed (attempt ${retryCount + 1}/${this.maxRetries + 1}), retrying in ${delay}ms:`,
                error instanceof Error ? error.message : error
            );

            await this.delay(delay);
            return this.executeWithRetry(fn, operationId, retryCount + 1);
        }
    }

    /**
     * Check and enforce rate limiting
     */
    private async checkRateLimit(): Promise<void> {
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;

        // Clean up old entries
        for (const [key, timestamp] of this.rateLimitQueue.entries()) {
            if (timestamp < windowStart) {
                this.rateLimitQueue.delete(key);
            }
        }

        // Check if we're at the rate limit
        if (this.rateLimitQueue.size >= this.maxRequestsPerWindow) {
            const oldestRequest = Math.min(...this.rateLimitQueue.values());
            const waitTime = oldestRequest + this.rateLimitWindow - now;

            if (waitTime > 0) {
                console.warn(`Rate limit reached, waiting ${waitTime}ms`);
                await this.delay(waitTime);
            }
        }

        // Add current request to queue
        this.rateLimitQueue.set(now.toString(), now);
    }

    /**
     * Utility function to create a delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Utility function to chunk an array into smaller arrays
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Get synchronization statistics
     */
    async getSyncStats(): Promise<{
        totalShipments: number;
        shipmentsWithApiTracking: number;
        lastSyncedCount: number;
        needsSyncCount: number;
        providerName: string | null;
    }> {
        const [totalResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments);

        const [withApiResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(isNotNull(shipments.apiTrackingId));

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const [recentSyncResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(and(isNotNull(shipments.lastApiSync), gte(shipments.lastApiSync, oneHourAgo)));

        const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery'];
        const [needsSyncResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shipments)
            .where(
                and(
                    inArray(shipments.status, activeStatuses),
                    isNotNull(shipments.apiTrackingId),
                    or(
                        lt(shipments.lastApiSync, oneHourAgo),
                        isNull(shipments.lastApiSync)
                    )
                )
            );

        return {
            totalShipments: totalResult.count,
            shipmentsWithApiTracking: withApiResult.count,
            lastSyncedCount: recentSyncResult.count,
            needsSyncCount: needsSyncResult.count,
            providerName: this.getProviderName(),
        };
    }

    /**
     * Force refresh the API adapter (useful for configuration changes)
     */
    refreshAdapter(): void {
        this.initializeAdapter();
    }
}

// Export singleton instance
export const trackingService = new TrackingService();