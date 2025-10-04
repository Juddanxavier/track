/** @format */

import { z } from 'zod';
import {
    APITrackingResponse,
    APITrackingEvent,
    WebhookPayload,
    Shipment,
    ShipmentStatusType,
    EventTypeType,
    APIIntegrationError,
} from '@/types/shipment';

// Base interface for all tracking API adapters
export interface TrackingAPIAdapter {
    /**
     * Create tracking for a shipment with the third-party provider
     */
    createTracking(shipmentData: CreateTrackingData): Promise<APITrackingResponse>;

    /**
     * Get tracking updates for a specific tracking ID
     */
    getTrackingUpdates(trackingId: string): Promise<APITrackingEvent[]>;

    /**
     * Validate webhook signature and payload
     */
    validateWebhook(payload: any, signature: string): boolean;

    /**
     * Parse webhook payload into standardized format
     */
    parseWebhookPayload(payload: any): WebhookPayload;

    /**
     * Get the provider name
     */
    getProviderName(): string;
}

// Data structure for creating tracking
export interface CreateTrackingData {
    shipmentId: string;
    trackingCode: string;
    courierTrackingNumber?: string;
    originAddress: {
        name: string;
        company?: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phone?: string;
    };
    destinationAddress: {
        name: string;
        company?: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phone?: string;
    };
    packageDetails?: {
        description?: string;
        weight?: string;
        dimensions?: {
            length: number;
            width: number;
            height: number;
            unit: 'in' | 'cm';
        };
        value?: string;
    };
    courier: string;
    shippingMethod?: string;
}

// ShipEngine API configuration
interface ShipEngineConfig {
    apiKey: string;
    baseUrl: string;
    webhookSecret?: string;
}

// ShipEngine API response types
interface ShipEngineTrackingResponse {
    tracking_number: string;
    status_code: string;
    status_description: string;
    carrier_code: string;
    events: ShipEngineEvent[];
    estimated_delivery_date?: string;
    actual_delivery_date?: string;
}

interface ShipEngineEvent {
    occurred_at: string;
    carrier_occurred_at?: string;
    description: string;
    city_locality?: string;
    state_province?: string;
    postal_code?: string;
    country_code?: string;
    company_name?: string;
    signer?: string;
    event_code?: string;
}

interface ShipEngineWebhookPayload {
    resource_url: string;
    resource_type: string;
    resource_id: string;
    data: {
        tracking_number: string;
        status_code: string;
        events: ShipEngineEvent[];
    };
}

/**
 * ShipEngine API adapter implementation
 */
export class ShipEngineAdapter implements TrackingAPIAdapter {
    private config: ShipEngineConfig;

    constructor(config: ShipEngineConfig) {
        this.config = config;
    }

    getProviderName(): string {
        return 'shipengine';
    }

    async createTracking(shipmentData: CreateTrackingData): Promise<APITrackingResponse> {
        try {
            // For ShipEngine, we typically don't "create" tracking but rather
            // register for tracking updates on an existing tracking number
            if (!shipmentData.courierTrackingNumber) {
                throw new APIIntegrationError(
                    'Courier tracking number is required for ShipEngine integration',
                    'shipengine'
                );
            }

            const response = await this.makeRequest('POST', '/v1/tracking/start', {
                tracking_number: shipmentData.courierTrackingNumber,
                carrier_code: this.mapCourierToCarrierCode(shipmentData.courier),
            });

            return this.mapShipEngineResponse(response);
        } catch (error) {
            throw new APIIntegrationError(
                `Failed to create tracking with ShipEngine: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'shipengine',
                { shipmentId: shipmentData.shipmentId, error }
            );
        }
    }

    async getTrackingUpdates(trackingId: string): Promise<APITrackingEvent[]> {
        try {
            const response = await this.makeRequest('GET', `/v1/tracking/${trackingId}`);
            const mapped = this.mapShipEngineResponse(response);
            return mapped.events;
        } catch (error) {
            throw new APIIntegrationError(
                `Failed to get tracking updates from ShipEngine: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'shipengine',
                { trackingId, error }
            );
        }
    }

    validateWebhook(payload: any, signature: string): boolean {
        if (!this.config.webhookSecret) {
            console.warn('ShipEngine webhook secret not configured, skipping validation');
            return true; // Allow if no secret configured
        }

        try {
            // ShipEngine uses HMAC-SHA256 for webhook validation
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', this.config.webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');

            // ShipEngine sends signature in format "sha256=<hash>"
            const receivedSignature = signature.replace('sha256=', '');

            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(receivedSignature, 'hex')
            );
        } catch (error) {
            console.error('Error validating ShipEngine webhook signature:', error);
            return false;
        }
    }

    parseWebhookPayload(payload: any): WebhookPayload {
        try {
            const shipEnginePayload = payload as ShipEngineWebhookPayload;

            return {
                trackingId: shipEnginePayload.data.tracking_number,
                events: shipEnginePayload.data.events.map(event => this.mapShipEngineEvent(event)),
                timestamp: new Date(),
            };
        } catch (error) {
            throw new APIIntegrationError(
                `Failed to parse ShipEngine webhook payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'shipengine',
                { payload, error }
            );
        }
    }

    private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
        const url = `${this.config.baseUrl}${endpoint}`;

        const options: RequestInit = {
            method,
            headers: {
                'API-Key': this.config.apiKey,
                'Content-Type': 'application/json',
            },
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ShipEngine API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    private mapShipEngineResponse(response: ShipEngineTrackingResponse): APITrackingResponse {
        return {
            trackingId: response.tracking_number,
            status: this.mapShipEngineStatus(response.status_code),
            events: response.events.map(event => this.mapShipEngineEvent(event)),
            estimatedDelivery: response.estimated_delivery_date ? new Date(response.estimated_delivery_date) : undefined,
            actualDelivery: response.actual_delivery_date ? new Date(response.actual_delivery_date) : undefined,
        };
    }

    private mapShipEngineEvent(event: ShipEngineEvent): APITrackingEvent {
        const location = this.buildLocationString(event);

        return {
            eventType: this.mapShipEngineEventType(event.event_code || event.description),
            description: event.description,
            location,
            eventTime: new Date(event.occurred_at),
            metadata: {
                carrierOccurredAt: event.carrier_occurred_at,
                eventCode: event.event_code,
                signer: event.signer,
                companyName: event.company_name,
            },
        };
    }

    private buildLocationString(event: ShipEngineEvent): string | undefined {
        const parts = [
            event.city_locality,
            event.state_province,
            event.postal_code,
            event.country_code,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(', ') : undefined;
    }

    private mapShipEngineStatus(statusCode: string): string {
        // Map ShipEngine status codes to our internal status
        const statusMap: Record<string, ShipmentStatusType> = {
            'AC': 'pending', // Accepted
            'IT': 'in-transit', // In Transit
            'DE': 'delivered', // Delivered
            'EX': 'exception', // Exception
            'AT': 'out-for-delivery', // Delivery Attempt (mapped to out-for-delivery)
            'NY': 'pending', // Not Yet in System
            'UN': 'exception', // Unknown
        };

        return statusMap[statusCode] || 'pending';
    }

    private mapShipEngineEventType(eventCodeOrDescription: string): EventTypeType {
        const eventCode = eventCodeOrDescription.toLowerCase();

        // Map common ShipEngine event codes/descriptions to our event types
        if (eventCode.includes('pickup') || eventCode.includes('collected')) {
            return 'pickup';
        }
        if (eventCode.includes('transit') || eventCode.includes('departed') || eventCode.includes('arrived')) {
            return 'in_transit';
        }
        if (eventCode.includes('out for delivery') || eventCode.includes('loaded for delivery')) {
            return 'out_for_delivery';
        }
        if (eventCode.includes('delivered') || eventCode.includes('signed')) {
            return 'delivered';
        }
        if (eventCode.includes('attempt') || eventCode.includes('failed delivery')) {
            return 'delivery_attempt';
        }
        if (eventCode.includes('exception') || eventCode.includes('delay') || eventCode.includes('hold')) {
            return 'exception';
        }
        if (eventCode.includes('cancelled') || eventCode.includes('returned')) {
            return 'cancelled';
        }

        // Default to location update for other events
        return 'location_update';
    }

    private mapCourierToCarrierCode(courier: string): string {
        // Map courier names to ShipEngine carrier codes
        const courierMap: Record<string, string> = {
            'ups': 'ups',
            'fedex': 'fedex',
            'usps': 'stamps_com',
            'dhl': 'dhl_express',
            'ontrac': 'ontrac',
            'lasership': 'lasership',
            'amazon': 'amazon_shipping',
        };

        const normalizedCourier = courier.toLowerCase().replace(/\s+/g, '');
        return courierMap[normalizedCourier] || courier;
    }
}

/**
 * Factory function to create tracking API adapters
 */
export function createTrackingAdapter(provider: string, config: any): TrackingAPIAdapter {
    switch (provider.toLowerCase()) {
        case 'shipengine':
            return new ShipEngineAdapter(config);
        default:
            throw new Error(`Unsupported tracking API provider: ${provider}`);
    }
}

/**
 * Configuration validation schemas
 */
export const ShipEngineConfigSchema = z.object({
    apiKey: z.string().min(1, 'ShipEngine API key is required'),
    baseUrl: z.string().url().default('https://api.shipengine.com'),
    webhookSecret: z.string().optional(),
});

export const TrackingAdapterConfigSchema = z.object({
    provider: z.enum(['shipengine']),
    config: z.union([ShipEngineConfigSchema]),
});

// Helper function to get adapter configuration from environment
export function getTrackingAdapterConfig(): { provider: string; config: any } | null {
    const provider = process.env.TRACKING_API_PROVIDER;

    if (!provider) {
        return null;
    }

    switch (provider.toLowerCase()) {
        case 'shipengine':
            const apiKey = process.env.SHIPENGINE_API_KEY;
            const baseUrl = process.env.SHIPENGINE_BASE_URL || 'https://api.shipengine.com';
            const webhookSecret = process.env.SHIPENGINE_WEBHOOK_SECRET;

            if (!apiKey) {
                throw new Error('SHIPENGINE_API_KEY environment variable is required');
            }

            return {
                provider: 'shipengine',
                config: {
                    apiKey,
                    baseUrl,
                    webhookSecret,
                },
            };
        default:
            throw new Error(`Unsupported tracking API provider: ${provider}`);
    }
}