/** @format */

import { CarrierType, ShipmentDetails, TrackingEvent } from '@/types/shipment';

/**
 * Base interface for all carrier API adapters
 * Defines the contract that all carrier implementations must follow
 */
export interface CarrierAPIAdapter {
    /**
     * Fetch complete shipment details from the carrier's API
     * @param trackingNumber - The carrier's tracking number
     * @returns Promise resolving to shipment details
     * @throws CarrierAPIError if the API call fails
     */
    getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails>;

    /**
     * Get tracking events/updates for a shipment
     * @param trackingNumber - The carrier's tracking number
     * @returns Promise resolving to array of tracking events
     * @throws CarrierAPIError if the API call fails
     */
    getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]>;

    /**
     * Validate if a tracking number format is valid for this carrier
     * @param trackingNumber - The tracking number to validate
     * @returns Promise resolving to true if valid, false otherwise
     */
    validateTrackingNumber(trackingNumber: string): Promise<boolean>;

    /**
     * Get the carrier type this adapter handles
     * @returns The carrier type
     */
    getCarrierType(): CarrierType;

    /**
     * Check if the carrier API is available/healthy
     * @returns Promise resolving to true if API is available
     */
    isAvailable(): Promise<boolean>;
}

/**
 * Configuration interface for carrier API adapters
 */
export interface CarrierConfig {
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    rateLimitPerMinute?: number;
}

/**
 * Error class for carrier API operations
 */
export class CarrierAPIError extends Error {
    constructor(
        message: string,
        public carrier: CarrierType,
        public code: string,
        public statusCode?: number,
        public details?: any
    ) {
        super(message);
        this.name = 'CarrierAPIError';
    }
}

/**
 * Rate limiting information for carrier APIs
 */
export interface RateLimitInfo {
    requestsRemaining: number;
    resetTime: Date;
    requestsPerMinute: number;
}

/**
 * API response wrapper for carrier responses
 */
export interface CarrierAPIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    rateLimitInfo?: RateLimitInfo;
    requestId?: string;
}