/** @format */

import { CarrierAPIAdapter, CarrierConfig, CarrierAPIError } from './types';
import { CarrierType, Carrier, ShipmentDetails, TrackingEvent, EventType, ShipmentStatus } from '@/types/shipment';

/**
 * FedEx API adapter for tracking integration
 * Implements the CarrierAPIAdapter interface for FedEx tracking services
 */
export class FedExAdapter implements CarrierAPIAdapter {
    private config: CarrierConfig;
    private baseUrl: string;

    constructor(config: CarrierConfig = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 120,
            ...config,
        };
        this.baseUrl = config.baseUrl || 'https://apis.fedex.com';
    }

    /**
     * Get the carrier type this adapter handles
     */
    getCarrierType(): CarrierType {
        return Carrier.FEDEX;
    }

    /**
     * Validate FedEx tracking number format
     * FedEx tracking numbers have various formats:
     * - 12-14 digits
     * - 20 digits
     * - 22 digits starting with 96
     */
    async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
        if (!trackingNumber || typeof trackingNumber !== 'string') {
            return false;
        }

        const cleanNumber = trackingNumber.trim().replace(/\s+/g, '');

        // FedEx Express: 12 digits
        const fedexExpress = /^\d{12}$/;

        // FedEx Ground: 14 digits
        const fedexGround = /^\d{14}$/;

        // FedEx SmartPost: 20 digits
        const fedexSmartPost = /^\d{20}$/;

        // FedEx Ground 96: 22 digits starting with 96
        const fedexGround96 = /^96\d{20}$/;

        return fedexExpress.test(cleanNumber) ||
            fedexGround.test(cleanNumber) ||
            fedexSmartPost.test(cleanNumber) ||
            fedexGround96.test(cleanNumber);
    }

    /**
     * Check if FedEx API is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // In a real implementation, this would ping the FedEx API health endpoint
            // For now, we'll simulate availability check
            return true;
        } catch (error) {
            console.error('FedEx API availability check failed:', error);
            return false;
        }
    }

    /**
     * Fetch shipment details from FedEx API
     */
    async getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid FedEx tracking number format',
                    Carrier.FEDEX,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to FedEx
            // For now, we'll return mock data based on the tracking number
            const mockResponse = this.generateMockShipmentDetails(trackingNumber);

            return mockResponse;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch FedEx shipment details: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.FEDEX,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Get tracking events from FedEx API
     */
    async getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid FedEx tracking number format',
                    Carrier.FEDEX,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to FedEx
            // For now, we'll return mock tracking events
            const mockEvents = this.generateMockTrackingEvents(trackingNumber);

            return mockEvents;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch FedEx tracking events: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.FEDEX,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Generate mock shipment details for testing
     * In production, this would be replaced with actual FedEx API integration
     */
    private generateMockShipmentDetails(trackingNumber: string): ShipmentDetails {
        const now = new Date();
        const estimatedDelivery = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

        return {
            customerName: 'Jane Smith',
            customerEmail: 'jane.smith@example.com',
            customerPhone: '+1-555-0456',
            packageDescription: 'Documents',
            weight: '1.0 lbs',
            dimensions: {
                length: 10,
                width: 8,
                height: 2,
                unit: 'in'
            },
            value: '$25.00',
            originAddress: {
                name: 'Business Sender',
                company: 'ABC Corporation',
                addressLine1: '789 Business Blvd',
                city: 'Chicago',
                state: 'IL',
                postalCode: '60601',
                country: 'US'
            },
            destinationAddress: {
                name: 'Jane Smith',
                addressLine1: '321 Home Street',
                city: 'Miami',
                state: 'FL',
                postalCode: '33101',
                country: 'US'
            },
            status: ShipmentStatus.OUT_FOR_DELIVERY,
            estimatedDelivery,
            events: this.generateMockTrackingEvents(trackingNumber)
        };
    }

    /**
     * Generate mock tracking events for testing
     * In production, this would be replaced with actual FedEx API integration
     */
    private generateMockTrackingEvents(trackingNumber: string): TrackingEvent[] {
        const now = new Date();
        const events: TrackingEvent[] = [];

        // Package shipped
        events.push({
            eventType: EventType.SHIPMENT_CREATED,
            status: ShipmentStatus.PENDING,
            description: 'Shipment information sent to FedEx',
            location: 'Chicago, IL',
            eventTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            metadata: {
                facility: 'FedEx Ship Center',
                service: 'FedEx Express'
            }
        });

        // Picked up
        events.push({
            eventType: EventType.STATUS_CHANGE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Picked up',
            location: 'Chicago, IL',
            eventTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            metadata: {
                facility: 'FedEx Chicago Hub'
            }
        });

        // In transit
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'In transit',
            location: 'Atlanta, GA',
            eventTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            metadata: {
                facility: 'FedEx Atlanta Sort Facility'
            }
        });

        // Out for delivery
        events.push({
            eventType: EventType.STATUS_CHANGE,
            status: ShipmentStatus.OUT_FOR_DELIVERY,
            description: 'Out for delivery',
            location: 'Miami, FL',
            eventTime: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
            metadata: {
                facility: 'FedEx Miami Station',
                deliveryVehicle: 'Truck 456'
            }
        });

        return events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    }
}