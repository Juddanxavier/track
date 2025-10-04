/** @format */

import { CarrierAPIAdapter, CarrierConfig, CarrierAPIError } from './types';
import { CarrierType, Carrier, ShipmentDetails, TrackingEvent, EventType, ShipmentStatus } from '@/types/shipment';

/**
 * USPS API adapter for tracking integration
 * Implements the CarrierAPIAdapter interface for USPS tracking services
 */
export class USPSAdapter implements CarrierAPIAdapter {
    private config: CarrierConfig;
    private baseUrl: string;

    constructor(config: CarrierConfig = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 60,
            ...config,
        };
        this.baseUrl = config.baseUrl || 'https://secure.shippingapis.com';
    }

    /**
     * Get the carrier type this adapter handles
     */
    getCarrierType(): CarrierType {
        return Carrier.USPS;
    }

    /**
     * Validate USPS tracking number format
     * USPS tracking numbers have various formats:
     * - Priority Mail Express: 9 digits + 2 letters + 9 digits + 2 letters
     * - Priority Mail: 9 digits + 2 letters + 9 digits + 2 letters
     * - Certified Mail: 20 digits
     */
    async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
        if (!trackingNumber || typeof trackingNumber !== 'string') {
            return false;
        }

        const cleanNumber = trackingNumber.trim().toUpperCase().replace(/\s+/g, '');

        // Priority Mail Express/Priority Mail: 9420 + 9 digits + 92 + 9 digits + US
        const priorityMail = /^9[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}(\s?[0-9]{2})?$/;

        // Certified Mail: 20 digits starting with 7
        const certifiedMail = /^7\d{19}$/;

        // Registered Mail: 13 characters starting with R
        const registeredMail = /^R[A-Z0-9]{12}$/;

        // Global Express Guaranteed: 10 digits
        const globalExpress = /^\d{10}$/;

        // Delivery Confirmation: 22 digits starting with 03
        const deliveryConfirmation = /^03\d{20}$/;

        return priorityMail.test(cleanNumber) ||
            certifiedMail.test(cleanNumber) ||
            registeredMail.test(cleanNumber) ||
            globalExpress.test(cleanNumber) ||
            deliveryConfirmation.test(cleanNumber);
    }

    /**
     * Check if USPS API is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // In a real implementation, this would ping the USPS API health endpoint
            // For now, we'll simulate availability check
            return true;
        } catch (error) {
            console.error('USPS API availability check failed:', error);
            return false;
        }
    }

    /**
     * Fetch shipment details from USPS API
     */
    async getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid USPS tracking number format',
                    Carrier.USPS,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to USPS
            // For now, we'll return mock data based on the tracking number
            const mockResponse = this.generateMockShipmentDetails(trackingNumber);

            return mockResponse;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch USPS shipment details: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.USPS,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Get tracking events from USPS API
     */
    async getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid USPS tracking number format',
                    Carrier.USPS,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to USPS
            // For now, we'll return mock tracking events
            const mockEvents = this.generateMockTrackingEvents(trackingNumber);

            return mockEvents;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch USPS tracking events: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.USPS,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Generate mock shipment details for testing
     * In production, this would be replaced with actual USPS API integration
     */
    private generateMockShipmentDetails(trackingNumber: string): ShipmentDetails {
        const now = new Date();
        const estimatedDelivery = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

        return {
            customerName: 'Sarah Johnson',
            customerEmail: 'sarah.johnson@example.com',
            customerPhone: '+1-555-0789',
            packageDescription: 'Books',
            weight: '1.8 lbs',
            dimensions: {
                length: 9,
                width: 6,
                height: 4,
                unit: 'in'
            },
            value: '$35.00',
            originAddress: {
                name: 'Online Bookstore',
                company: 'Books & More LLC',
                addressLine1: '555 Commerce St',
                city: 'Portland',
                state: 'OR',
                postalCode: '97201',
                country: 'US'
            },
            destinationAddress: {
                name: 'Sarah Johnson',
                addressLine1: '123 Oak Avenue',
                city: 'Seattle',
                state: 'WA',
                postalCode: '98101',
                country: 'US'
            },
            status: ShipmentStatus.IN_TRANSIT,
            estimatedDelivery,
            events: this.generateMockTrackingEvents(trackingNumber)
        };
    }

    /**
     * Generate mock tracking events for testing
     * In production, this would be replaced with actual USPS API integration
     */
    private generateMockTrackingEvents(trackingNumber: string): TrackingEvent[] {
        const now = new Date();
        const events: TrackingEvent[] = [];

        // Pre-shipment
        events.push({
            eventType: EventType.SHIPMENT_CREATED,
            status: ShipmentStatus.PENDING,
            description: 'Shipping label created',
            location: 'Portland, OR',
            eventTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            metadata: {
                facility: 'USPS Portland Post Office',
                service: 'Priority Mail'
            }
        });

        // Acceptance
        events.push({
            eventType: EventType.STATUS_CHANGE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Accepted at USPS facility',
            location: 'Portland, OR',
            eventTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            metadata: {
                facility: 'Portland OR Distribution Center'
            }
        });

        // In transit
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'In transit to next facility',
            location: 'Tacoma, WA',
            eventTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            metadata: {
                facility: 'Tacoma WA Distribution Center'
            }
        });

        // Arrived at destination facility
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Arrived at destination facility',
            location: 'Seattle, WA',
            eventTime: new Date(now.getTime() - 8 * 60 * 60 * 1000), // 8 hours ago
            metadata: {
                facility: 'Seattle WA Post Office'
            }
        });

        return events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    }
}