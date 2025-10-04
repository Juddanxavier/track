/** @format */

import { CarrierAdapterFactory, CarrierAPIError } from './carriers';
import { CarrierType, ShipmentDetails, TrackingEvent } from '@/types/shipment';

/**
 * Rate limiting configuration for API calls
 */
interface RateLimitConfig {
    requestsPerMinute: number;
    burstLimit: number;
    cooldownPeriod: number; // milliseconds
}

/**
 * Retry configuration for failed API calls
 */
interface RetryConfig {
    maxAttempts: number;
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
}

/**
 * Service configuration
 */
interface ThirdPartyAPIServiceConfig {
    rateLimit: RateLimitConfig;
    retry: RetryConfig;
    timeout: number;
}

/**
 * Rate limiting tracker for API calls
 */
interface RateLimitTracker {
    requests: number[];
    lastReset: Date;
    isBlocked: boolean;
    blockUntil?: Date;
}

/**
 * Sync result for tracking operations
 */
export interface SyncResult {
    shipmentId: string;
    trackingNumber: string;
    carrier: CarrierType;
    success: boolean;
    error?: string;
    updatedAt: Date;
    eventsAdded: number;
}

/**
 * Third-party API service for carrier integration
 * Handles fetching shipment details and tracking updates from various carriers
 */
export class ThirdPartyAPIService {
    private config: ThirdPartyAPIServiceConfig;
    private rateLimitTrackers: Map<CarrierType, RateLimitTracker> = new Map();

    constructor(config?: Partial<ThirdPartyAPIServiceConfig>) {
        this.config = {
            rateLimit: {
                requestsPerMinute: 60,
                burstLimit: 10,
                cooldownPeriod: 60000, // 1 minute
            },
            retry: {
                maxAttempts: 3,
                baseDelay: 1000, // 1 second
                maxDelay: 30000, // 30 seconds
                backoffMultiplier: 2,
            },
            timeout: 30000, // 30 seconds
            ...config,
        };

        // Initialize rate limit trackers for all carriers
        CarrierAdapterFactory.getSupportedCarriers().forEach((carrier: CarrierType) => {
            this.rateLimitTrackers.set(carrier, {
                requests: [],
                lastReset: new Date(),
                isBlocked: false,
            });
        });
    }

    /**
     * Fetch shipment details from the appropriate carrier API
     * @param trackingNumber - The carrier's tracking number
     * @param carrier - The carrier type
     * @returns Promise resolving to shipment details
     */
    async fetchShipmentDetails(trackingNumber: string, carrier: CarrierType): Promise<ShipmentDetails> {
        return this.executeWithRateLimitAndRetry(
            async () => {
                const adapter = CarrierAdapterFactory.getAdapter(carrier);
                return await adapter.getShipmentDetails(trackingNumber);
            },
            carrier,
            `fetchShipmentDetails-${trackingNumber}`
        );
    }

    /**
     * Get tracking updates for periodic syncing
     * @param trackingNumber - The carrier's tracking number
     * @param carrier - The carrier type
     * @returns Promise resolving to array of tracking events
     */
    async getTrackingUpdates(trackingNumber: string, carrier: CarrierType): Promise<TrackingEvent[]> {
        return this.executeWithRateLimitAndRetry(
            async () => {
                const adapter = CarrierAdapterFactory.getAdapter(carrier);
                return await adapter.getTrackingEvents(trackingNumber);
            },
            carrier,
            `getTrackingUpdates-${trackingNumber}`
        );
    }

    /**
     * Validate tracking number format for a specific carrier
     * @param trackingNumber - The tracking number to validate
     * @param carrier - The carrier type
     * @returns Promise resolving to true if valid
     */
    async validateTrackingNumber(trackingNumber: string, carrier: CarrierType): Promise<boolean> {
        try {
            const adapter = CarrierAdapterFactory.getAdapter(carrier);
            return await adapter.validateTrackingNumber(trackingNumber);
        } catch (error) {
            console.error(`Error validating tracking number for ${carrier}:`, error);
            return false;
        }
    }

    /**
     * Check if a carrier API is available
     * @param carrier - The carrier type to check
     * @returns Promise resolving to true if available
     */
    async isCarrierAvailable(carrier: CarrierType): Promise<boolean> {
        try {
            const adapter = CarrierAdapterFactory.getAdapter(carrier);
            return await adapter.isAvailable();
        } catch (error) {
            console.error(`Error checking availability for ${carrier}:`, error);
            return false;
        }
    }

    /**
     * Sync multiple shipments with their respective carrier APIs
     * @param shipments - Array of shipment info to sync
     * @returns Promise resolving to array of sync results
     */
    async syncMultipleShipments(
        shipments: Array<{
            shipmentId: string;
            trackingNumber: string;
            carrier: CarrierType;
        }>
    ): Promise<SyncResult[]> {
        const results: SyncResult[] = [];

        // Group shipments by carrier to respect rate limits
        const shipmentsByCarrier = new Map<CarrierType, typeof shipments>();
        shipments.forEach(shipment => {
            if (!shipmentsByCarrier.has(shipment.carrier)) {
                shipmentsByCarrier.set(shipment.carrier, []);
            }
            shipmentsByCarrier.get(shipment.carrier)!.push(shipment);
        });

        // Process each carrier's shipments with appropriate delays
        for (const [carrier, carrierShipments] of shipmentsByCarrier) {
            for (const shipment of carrierShipments) {
                try {
                    const events = await this.getTrackingUpdates(shipment.trackingNumber, carrier);

                    results.push({
                        shipmentId: shipment.shipmentId,
                        trackingNumber: shipment.trackingNumber,
                        carrier: shipment.carrier,
                        success: true,
                        updatedAt: new Date(),
                        eventsAdded: events.length,
                    });
                } catch (error) {
                    results.push({
                        shipmentId: shipment.shipmentId,
                        trackingNumber: shipment.trackingNumber,
                        carrier: shipment.carrier,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        updatedAt: new Date(),
                        eventsAdded: 0,
                    });
                }

                // Add delay between requests to respect rate limits
                await this.delay(this.calculateDelayBetweenRequests(carrier));
            }
        }

        return results;
    }

    /**
     * Get rate limit status for a carrier
     * @param carrier - The carrier type
     * @returns Current rate limit information
     */
    getRateLimitStatus(carrier: CarrierType): {
        requestsInLastMinute: number;
        isBlocked: boolean;
        blockUntil?: Date;
        requestsRemaining: number;
    } {
        const tracker = this.rateLimitTrackers.get(carrier);
        if (!tracker) {
            return {
                requestsInLastMinute: 0,
                isBlocked: false,
                requestsRemaining: this.config.rateLimit.requestsPerMinute,
            };
        }

        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        // Clean old requests
        tracker.requests = tracker.requests.filter(time => time > oneMinuteAgo.getTime());

        return {
            requestsInLastMinute: tracker.requests.length,
            isBlocked: tracker.isBlocked && tracker.blockUntil ? now < tracker.blockUntil : false,
            blockUntil: tracker.blockUntil,
            requestsRemaining: Math.max(0, this.config.rateLimit.requestsPerMinute - tracker.requests.length),
        };
    }

    /**
     * Execute an API operation with rate limiting and retry logic
     */
    private async executeWithRateLimitAndRetry<T>(
        operation: () => Promise<T>,
        carrier: CarrierType,
        operationId: string
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
            try {
                // Check rate limit before making request
                await this.checkRateLimit(carrier);

                // Record the request
                this.recordRequest(carrier);

                // Execute the operation with timeout
                const result = await Promise.race([
                    operation(),
                    this.createTimeoutPromise<T>(this.config.timeout)
                ]);

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                console.warn(
                    `API operation ${operationId} failed (attempt ${attempt}/${this.config.retry.maxAttempts}):`,
                    lastError.message
                );

                // Don't retry on certain errors
                if (error instanceof CarrierAPIError) {
                    if (error.code === 'INVALID_TRACKING_NUMBER' || error.statusCode === 404) {
                        throw error; // Don't retry validation errors or not found
                    }

                    if (error.statusCode === 429) {
                        // Rate limited - block this carrier temporarily
                        this.blockCarrier(carrier);
                    }
                }

                // Calculate delay before retry
                if (attempt < this.config.retry.maxAttempts) {
                    const delay = this.calculateRetryDelay(attempt);
                    await this.delay(delay);
                }
            }
        }

        throw lastError || new Error('Operation failed after all retry attempts');
    }

    /**
     * Check if we can make a request to the carrier (rate limiting)
     */
    private async checkRateLimit(carrier: CarrierType): Promise<void> {
        const status = this.getRateLimitStatus(carrier);

        if (status.isBlocked) {
            const waitTime = status.blockUntil ? status.blockUntil.getTime() - Date.now() : 0;
            if (waitTime > 0) {
                throw new CarrierAPIError(
                    `Rate limited for ${carrier}. Try again in ${Math.ceil(waitTime / 1000)} seconds`,
                    carrier,
                    'RATE_LIMITED'
                );
            }
        }

        if (status.requestsRemaining <= 0) {
            throw new CarrierAPIError(
                `Rate limit exceeded for ${carrier}. Try again later`,
                carrier,
                'RATE_LIMITED'
            );
        }
    }

    /**
     * Record a request for rate limiting purposes
     */
    private recordRequest(carrier: CarrierType): void {
        const tracker = this.rateLimitTrackers.get(carrier);
        if (tracker) {
            tracker.requests.push(Date.now());
        }
    }

    /**
     * Block a carrier temporarily due to rate limiting
     */
    private blockCarrier(carrier: CarrierType): void {
        const tracker = this.rateLimitTrackers.get(carrier);
        if (tracker) {
            tracker.isBlocked = true;
            tracker.blockUntil = new Date(Date.now() + this.config.rateLimit.cooldownPeriod);
        }
    }

    /**
     * Calculate delay between requests for a carrier
     */
    private calculateDelayBetweenRequests(carrier: CarrierType): number {
        const status = this.getRateLimitStatus(carrier);
        const requestsPerSecond = this.config.rateLimit.requestsPerMinute / 60;
        const baseDelay = 1000 / requestsPerSecond; // milliseconds between requests

        // Add extra delay if we're approaching the limit
        const utilizationRatio = status.requestsInLastMinute / this.config.rateLimit.requestsPerMinute;
        const extraDelay = utilizationRatio > 0.8 ? baseDelay * 2 : 0;

        return Math.ceil(baseDelay + extraDelay);
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(attempt: number): number {
        const delay = this.config.retry.baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.config.retry.maxDelay);
    }

    /**
     * Create a timeout promise that rejects after the specified time
     */
    private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

    /**
     * Simple delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get service statistics
     */
    getServiceStats(): {
        carriers: Array<{
            carrier: CarrierType;
            requestsInLastMinute: number;
            isBlocked: boolean;
            requestsRemaining: number;
        }>;
        config: ThirdPartyAPIServiceConfig;
    } {
        const carriers = CarrierAdapterFactory.getSupportedCarriers().map((carrier: CarrierType) => ({
            carrier,
            ...this.getRateLimitStatus(carrier),
        }));

        return {
            carriers,
            config: this.config,
        };
    }

    /**
     * Reset rate limiting for a specific carrier (useful for testing)
     */
    resetRateLimit(carrier: CarrierType): void {
        const tracker = this.rateLimitTrackers.get(carrier);
        if (tracker) {
            tracker.requests = [];
            tracker.isBlocked = false;
            tracker.blockUntil = undefined;
            tracker.lastReset = new Date();
        }
    }

    /**
     * Reset rate limiting for all carriers
     */
    resetAllRateLimits(): void {
        CarrierAdapterFactory.getSupportedCarriers().forEach((carrier: CarrierType) => {
            this.resetRateLimit(carrier);
        });
    }
}