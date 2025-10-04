/** @format */

import { CarrierAPIAdapter, CarrierConfig, CarrierAPIError } from './types';
import { CarrierType, Carrier, ShipmentDetails, TrackingEvent, EventType, ShipmentStatus } from '@/types/shipment';

/**
 * DHL API adapter for tracking integration
 * Implements the CarrierAPIAdapter interface for DHL tracking services
 */
export class DHLAdapter implements CarrierAPIAdapter {
    private config: CarrierConfig;
    private baseUrl: string;

    constructor(config: CarrierConfig = {}) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 80,
            ...config,
        };
        this.baseUrl = config.baseUrl || 'https://api-eu.dhl.com';
    }

    /**
     * Get the carrier type this adapter handles
     */
    getCarrierType(): CarrierType {
        return Carrier.DHL;
    }

    /**
     * Validate DHL tracking number format
     * DHL tracking numbers have various formats:
     * - 10-11 digits
     * - Waybill numbers starting with specific prefixes
     */
    async validateTrackingNumber(trackingNumber: string): Promise<boolean> {
        if (!trackingNumber || typeof trackingNumber !== 'string') {
            return false;
        }

        const cleanNumber = trackingNumber.trim().toUpperCase();

        // DHL Express: 10 digits
        const dhlExpress = /^\d{10}$/;

        // DHL Express: 11 digits
        const dhlExpress11 = /^\d{11}$/;

        // DHL eCommerce: Various formats with letters and numbers
        const dhlEcommerce = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

        // DHL Global Mail: GM followed by 13 digits and 2 letters
        const dhlGlobalMail = /^GM\d{13}[A-Z]{2}$/;

        return dhlExpress.test(cleanNumber) ||
            dhlExpress11.test(cleanNumber) ||
            dhlEcommerce.test(cleanNumber) ||
            dhlGlobalMail.test(cleanNumber);
    }

    /**
     * Check if DHL API is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // In a real implementation, this would ping the DHL API health endpoint
            // For now, we'll simulate availability check
            return true;
        } catch (error) {
            console.error('DHL API availability check failed:', error);
            return false;
        }
    }

    /**
     * Fetch shipment details from DHL API
     */
    async getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid DHL tracking number format',
                    Carrier.DHL,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to DHL
            // For now, we'll return mock data based on the tracking number
            const mockResponse = this.generateMockShipmentDetails(trackingNumber);

            return mockResponse;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch DHL shipment details: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.DHL,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Get tracking events from DHL API
     */
    async getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]> {
        try {
            const isValid = await this.validateTrackingNumber(trackingNumber);
            if (!isValid) {
                throw new CarrierAPIError(
                    'Invalid DHL tracking number format',
                    Carrier.DHL,
                    'INVALID_TRACKING_NUMBER'
                );
            }

            // In a real implementation, this would make an actual API call to DHL
            // For now, we'll return mock tracking events
            const mockEvents = this.generateMockTrackingEvents(trackingNumber);

            return mockEvents;
        } catch (error) {
            if (error instanceof CarrierAPIError) {
                throw error;
            }

            throw new CarrierAPIError(
                `Failed to fetch DHL tracking events: ${error instanceof Error ? error.message : 'Unknown error'}`,
                Carrier.DHL,
                'API_ERROR',
                undefined,
                error
            );
        }
    }

    /**
     * Generate mock shipment details for testing
     * In production, this would be replaced with actual DHL API integration
     */
    private generateMockShipmentDetails(trackingNumber: string): ShipmentDetails {
        const now = new Date();
        const estimatedDelivery = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now (international)

        return {
            customerName: 'Hans Mueller',
            customerEmail: 'hans.mueller@example.com',
            customerPhone: '+49-30-12345678',
            packageDescription: 'Electronics',
            weight: '3.2 kg',
            dimensions: {
                length: 30,
                width: 20,
                height: 15,
                unit: 'cm'
            },
            value: '€150.00',
            originAddress: {
                name: 'Global Electronics',
                company: 'Global Electronics GmbH',
                addressLine1: 'Hauptstraße 123',
                city: 'Berlin',
                state: 'Berlin',
                postalCode: '10115',
                country: 'DE'
            },
            destinationAddress: {
                name: 'Hans Mueller',
                addressLine1: 'Musterstraße 456',
                city: 'Munich',
                state: 'Bavaria',
                postalCode: '80331',
                country: 'DE'
            },
            status: ShipmentStatus.IN_TRANSIT,
            estimatedDelivery,
            events: this.generateMockTrackingEvents(trackingNumber)
        };
    }

    /**
     * Generate mock tracking events for testing
     * In production, this would be replaced with actual DHL API integration
     */
    private generateMockTrackingEvents(trackingNumber: string): TrackingEvent[] {
        const now = new Date();
        const events: TrackingEvent[] = [];

        // Shipment created
        events.push({
            eventType: EventType.SHIPMENT_CREATED,
            status: ShipmentStatus.PENDING,
            description: 'Shipment data received',
            location: 'Berlin, Germany',
            eventTime: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
            metadata: {
                facility: 'DHL Berlin Service Center',
                service: 'DHL Express'
            }
        });

        // Picked up
        events.push({
            eventType: EventType.STATUS_CHANGE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Picked up from shipper',
            location: 'Berlin, Germany',
            eventTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            metadata: {
                facility: 'DHL Berlin Hub'
            }
        });

        // Processing at facility
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'Processed at DHL facility',
            location: 'Leipzig, Germany',
            eventTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            metadata: {
                facility: 'DHL Leipzig Hub',
                nextDestination: 'Munich'
            }
        });

        // In transit to destination
        events.push({
            eventType: EventType.LOCATION_UPDATE,
            status: ShipmentStatus.IN_TRANSIT,
            description: 'In transit to destination facility',
            location: 'Munich, Germany',
            eventTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            metadata: {
                facility: 'DHL Munich Facility'
            }
        });

        return events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    }
}