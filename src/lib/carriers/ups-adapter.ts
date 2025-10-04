/** @format */

import { CarrierAPIAdapter, CarrierConfig, CarrierAPIError, CarrierAPIResponse } from './types';
import { CarrierType, Carrier, ShipmentDetails, TrackingEvent, EventType, ShipmentStatus } from '@/types/shipment';

/**
 * UPS API adapter for tracking integration
 * Implements the CarrierAPIAdapter interface for UPS tracking services
 */
export class UPSAdapter implements CarrierAPIAdapter {
    private config: CarrierConfig;
    private baseUrl: string;

    constructor(config: CarrierConfig = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 100,
            ...config,
        };
        this.baseUrl = config.baseUrl || 'https://onlinetools.ups.com/api';
    }

    /**
     * Get the carrier type this adapter handles
     */
    getCarrierType(): CarrierType {
        return Carrier.UPS;
    }

    /**
     * Validate UPS tracking number format
     * UPS tracking numbers are typically:
     * - 1Z followed by 16 alphanumeric characters
     * - Or various other formats (T, K, etc.)
     */
    async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
        if (!trackingNumber || typeof trackingNumber !== 'string') {
            return false;
        }

        const cleanNumber = trackingNumber.trim().toUpperCase();

        // UPS 1Z format: 1Z + 6 chars + 2 digits + 6 chars
        const upsFormat1 = /^1Z[A-Z0-9]{6}\d{2}[A-Z0-9]{6}$/;

        // UPS T format: T + 10 digits
        const upsFormatT = /^T\d{10}$/;

        // UPS K format: K + 10 digits  
        const upsFormatK = /^K\d{10}$/;

        return upsFormat1.test(cleanNumber) || upsFormatT.test(cleanNumber) || upsFormatK.test(cleanNumber);
    }

    /**
     * Check if UPS API is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // In a real implementation, this would ping the UPS API health endpoint
            // For now, we'll simulate availability check
            return true;
        } catch (error) {
            console.error('UPS API availability check failed:', error);
            return false;
        }
    }

    /**
     * Fetch shipment details from UPS API
     */
    async getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid UPS tracking number format',
                    Carrier.UPS,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to UPS
            // For now, we'll return mock data based on the tracking number
            const mockResponse = this.generateMockShipmentDetails(trackingNumber);

            return mockResponse;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch UPS shipment details: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.UPS,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Get tracking events from UPS API
     */
    async getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid UPS tracking number format',
                    Carrier.UPS,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to UPS
            // For now, we'll return mock tracking events
            const mockEvents = this.generateMockTrackingEvents(trackingNumber);

            return mockEvents;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch UPS tracking events: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.UPS,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Generate mock shipment details for testing
     * In production, this would be replaced with actual UPS API integration
     */
    private generateMockShipmentDetails(trackingNumber: string): ShipmentDetails {
        const now = new Date();
        const estimatedDelivery = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

        return {
            customerName: 'John Doe',
            customerEmail: 'john.doe@example.com',
            customerPhone: '+1-555-0123',
            packageDescription: 'Package',
            weight: '2.5 lbs',
            dimensions: {
                length: 12,
                width: 8,
                height: 6,
                unit: 'in'
            },
            value: '$50.00',
            originAddress: {
                name: 'Sender Name',
                company: 'Sender Company',
                addressLine1: '123 Sender St',
                city: 'Sender City',
                state: 'CA',
                postalCode: '90210',
                country: 'US'
            },
            destinationAddress: {
                name: 'John Doe',
                addressLine1: '456 Recipient Ave',
                city: 'Recipient City',
                state: 'NY',
                postalCode: '10001',
                country: 'US'
            },
            status: ShipmentStatus.IN_TRANSIT,
            estimatedDelivery,
            events: this.generateMockTrackingEvents(trackingNumber)
        };
    }

    /**
     * Generate mock tracking events for testing
     * In production, this would be replaced with actual UPS API integration
     */
    private generateMockTrackingEvents(trackingNumber: string): TrackingEvent[] {
        const now = new Date();
        const events: TrackingEvent[] = [];

        // Package picked up
        events.push({
            eventType: EventType.SHIPMENT_CREATED,
            status: ShipmentStatus.PENDING,
            description: 'Package picked up by UPS',
            location: 'Los Angeles, CA',
            eventTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            metadata: {
                facility: 'UPS Customer Center',
                employeeId: 'UPS001'
            }
        });

        // In transit
        events.push({
            eventType: EventType.STATUS_CHANGE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Package in transit',
            location: 'Phoenix, AZ',
            eventTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            metadata: {
                facility: 'UPS Phoenix Hub',
                nextLocation: 'Denver, CO'
            }
        });

        // Location update
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Package arrived at facility',
            location: 'Denver, CO',
            eventTime: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
            metadata: {
                facility: 'UPS Denver Hub'
            }
        });

        return events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    }
}