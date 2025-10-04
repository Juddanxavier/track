/** @format */

import {
    Shipment,
    ShipmentEvent,
    PublicTrackingInfo,
    PublicTrackingEvent,
    CarrierType
} from '@/types/shipment';
import { trackingCodeGenerator } from './trackingCodeGenerator';

/**
 * White label configuration for customizing public tracking display
 */
interface WhiteLabelConfig {
    brandName: string;
    hideCarrierInfo: boolean;
    customStatusMessages: Record<string, string>;
    allowedEventTypes: string[];
    sanitizeLocations: boolean;
    showEstimatedDelivery: boolean;
}

/**
 * Service for handling white label tracking functionality
 * Ensures carrier information is never exposed to customers
 */
export class WhiteLabelService {
    private config: WhiteLabelConfig;

    constructor(config?: Partial<WhiteLabelConfig>) {
        this.config = {
            brandName: 'ShipCo',
            hideCarrierInfo: true,
            customStatusMessages: {
                'pending': 'Your package is being prepared for shipment',
                'in-transit': 'Your package is on its way',
                'out-for-delivery': 'Your package is out for delivery today',
                'delivered': 'Your package has been delivered',
                'exception': 'There is an update on your package',
                'cancelled': 'This shipment has been cancelled'
            },
            allowedEventTypes: [
                'shipment_created',
                'status_change',
                'location_update',
                'delivery_attempt'
            ],
            sanitizeLocations: true,
            showEstimatedDelivery: true,
            ...config,
        };
    }

    /**
     * Convert internal shipment data to white label public tracking info
     * Removes all carrier-specific information
     */
    sanitizeShipmentForPublic(shipment: Shipment, events: ShipmentEvent[]): PublicTrackingInfo {
        // Validate that we're not exposing carrier tracking numbers
        if (this.isCarrierTrackingNumber(shipment.internalTrackingCode)) {
            throw new Error('Cannot expose carrier tracking number as public tracking code');
        }

        // Sanitize events for public display
        const publicEvents = this.sanitizeEventsForPublic(events);

        // Create public tracking info without carrier details
        const publicInfo: PublicTrackingInfo = {
            internalTrackingCode: shipment.internalTrackingCode,
            carrier: this.sanitizeCarrierName(shipment.carrier),
            carrierTrackingNumber: this.config.hideCarrierInfo ? 'Hidden' : this.maskCarrierTrackingNumber(shipment.carrierTrackingNumber),
            status: shipment.status,
            estimatedDelivery: this.config.showEstimatedDelivery ? shipment.estimatedDelivery : undefined,
            actualDelivery: shipment.actualDelivery,
            events: publicEvents,
        };

        return publicInfo;
    }

    /**
     * Sanitize events for public display
     * Removes internal system information and carrier-specific details
     */
    private sanitizeEventsForPublic(events: ShipmentEvent[]): PublicTrackingEvent[] {
        return events
            .filter(event => this.config.allowedEventTypes.includes(event.eventType))
            .map(event => ({
                eventType: event.eventType,
                status: event.status,
                description: this.sanitizeEventDescription(event.description, event.eventType),
                location: this.sanitizeLocation(event.location),
                eventTime: event.eventTime,
            }))
            .sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
    }

    /**
     * Sanitize event descriptions to remove carrier-specific information
     */
    private sanitizeEventDescription(description: string, eventType: string): string {
        if (!description) {
            return this.getGenericEventDescription(eventType);
        }

        let sanitized = description;

        // Remove carrier-specific facility names
        sanitized = sanitized.replace(/UPS\s+[A-Za-z\s]+(?:Hub|Center|Facility)/gi, 'Shipping facility');
        sanitized = sanitized.replace(/FedEx\s+[A-Za-z\s]+(?:Hub|Center|Facility|Station)/gi, 'Shipping facility');
        sanitized = sanitized.replace(/DHL\s+[A-Za-z\s]+(?:Hub|Center|Facility)/gi, 'Shipping facility');
        sanitized = sanitized.replace(/USPS\s+[A-Za-z\s]+(?:Post Office|Distribution Center)/gi, 'Shipping facility');

        // Remove carrier names from descriptions
        sanitized = sanitized.replace(/\b(UPS|FedEx|DHL|USPS)\b/gi, this.config.brandName);

        // Remove tracking numbers from descriptions
        sanitized = sanitized.replace(/tracking\s+number\s+\w+/gi, 'tracking information');

        // Remove employee/driver IDs
        sanitized = sanitized.replace(/(?:employee|driver)\s+(?:id|#)\s*:?\s*\w+/gi, '');

        return sanitized.trim() || this.getGenericEventDescription(eventType);
    }

    /**
     * Get generic event description for white label display
     */
    private getGenericEventDescription(eventType: string): string {
        const descriptions: Record<string, string> = {
            'shipment_created': 'Shipment information received',
            'status_change': 'Package status updated',
            'location_update': 'Package location updated',
            'delivery_attempt': 'Delivery attempted',
            'exception': 'Package status updated',
            'api_sync': 'Tracking information updated',
        };

        return descriptions[eventType] || 'Package update';
    }

    /**
     * Sanitize location information
     */
    private sanitizeLocation(location?: string | null): string | undefined {
        if (!location || !this.config.sanitizeLocations) {
            return location || undefined;
        }

        // Remove facility-specific information but keep city/state
        let sanitized = location;

        // Remove facility names but keep location
        sanitized = sanitized.replace(/,?\s*(?:UPS|FedEx|DHL|USPS)\s+[A-Za-z\s]*(?:Hub|Center|Facility|Station|Post Office)/gi, '');

        // Clean up extra commas and spaces
        sanitized = sanitized.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '').trim();

        return sanitized || undefined;
    }

    /**
     * Sanitize carrier name for white label display
     */
    private sanitizeCarrierName(carrier: CarrierType): CarrierType {
        if (this.config.hideCarrierInfo) {
            // Return a generic carrier name or the brand name
            return 'usps' as CarrierType; // Use USPS as generic since it's most neutral
        }
        return carrier;
    }

    /**
     * Mask carrier tracking number for security
     */
    private maskCarrierTrackingNumber(trackingNumber: string): string {
        if (!trackingNumber || trackingNumber.length < 4) {
            return '****';
        }

        // Show first 2 and last 2 characters, mask the middle
        const start = trackingNumber.substring(0, 2);
        const end = trackingNumber.substring(trackingNumber.length - 2);
        const middle = '*'.repeat(Math.max(4, trackingNumber.length - 4));

        return `${start}${middle}${end}`;
    }

    /**
     * Check if a string looks like a carrier tracking number
     */
    private isCarrierTrackingNumber(input: string): boolean {
        return trackingCodeGenerator.isCarrierTrackingNumber(input);
    }

    /**
     * Format tracking code for public display
     */
    formatTrackingCodeForDisplay(trackingCode: string): string {
        const sanitized = trackingCodeGenerator.sanitizeForPublicDisplay(trackingCode);
        return sanitized.displayFormat || trackingCode;
    }

    /**
     * Get white label status message
     */
    getStatusMessage(status: string): string {
        return this.config.customStatusMessages[status] || `Package status: ${status}`;
    }

    /**
     * Validate that tracking lookup is using internal code only
     */
    validatePublicTrackingLookup(input: string): {
        isValid: boolean;
        normalizedCode?: string;
        error?: string;
    } {
        // Check if input looks like a carrier tracking number
        if (this.isCarrierTrackingNumber(input)) {
            return {
                isValid: false,
                error: 'Please use your tracking code that starts with SC'
            };
        }

        // Normalize the internal tracking code
        const normalized = trackingCodeGenerator.normalizeInternalTrackingCode(input);
        if (!normalized) {
            return {
                isValid: false,
                error: 'Invalid tracking code format. Please check your tracking code.'
            };
        }

        return {
            isValid: true,
            normalizedCode: normalized,
        };
    }

    /**
     * Get white label configuration
     */
    getConfig(): WhiteLabelConfig {
        return { ...this.config };
    }

    /**
     * Update white label configuration
     */
    updateConfig(updates: Partial<WhiteLabelConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Generate white label tracking URL
     */
    generateTrackingUrl(trackingCode: string, baseUrl: string = ''): string {
        const formatted = this.formatTrackingCodeForDisplay(trackingCode);
        return `${baseUrl}/tracking/${encodeURIComponent(trackingCode)}`;
    }

    /**
     * Create white label tracking email content
     */
    generateTrackingEmailContent(shipment: Shipment): {
        subject: string;
        trackingCode: string;
        trackingUrl: string;
        statusMessage: string;
    } {
        const formatted = this.formatTrackingCodeForDisplay(shipment.internalTrackingCode);

        return {
            subject: `Your ${this.config.brandName} package is on its way`,
            trackingCode: formatted,
            trackingUrl: this.generateTrackingUrl(shipment.internalTrackingCode),
            statusMessage: this.getStatusMessage(shipment.status),
        };
    }
}

// Export singleton instance
export const whiteLabelService = new WhiteLabelService();

// Export utility functions
export const sanitizeShipmentForPublic = (shipment: Shipment, events: ShipmentEvent[]) =>
    whiteLabelService.sanitizeShipmentForPublic(shipment, events);

export const validatePublicTrackingLookup = (input: string) =>
    whiteLabelService.validatePublicTrackingLookup(input);

export const formatTrackingCodeForDisplay = (trackingCode: string) =>
    whiteLabelService.formatTrackingCodeForDisplay(trackingCode);