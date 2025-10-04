/** @format */

import { CarrierAPIAdapter, CarrierConfig, CarrierAPIError } from './types';
import { CarrierType, Carrier } from '@/types/shipment';
import { UPSAdapter } from './ups-adapter';
import { FedExAdapter } from './fedex-adapter';
import { DHLAdapter } from './dhl-adapter';
import { USPSAdapter } from './usps-adapter';

/**
 * Factory class for creating carrier API adapters
 * Manages the instantiation and configuration of different carrier adapters
 */
export class CarrierAdapterFactory {
    private static adapters: Map<CarrierType, CarrierAPIAdapter> = new Map();
    private static configs: Map<CarrierType, CarrierConfig> = new Map();

    /**
     * Configure a carrier adapter with specific settings
     * @param carrier - The carrier type to configure
     * @param config - Configuration options for the carrier
     */
    static configure(carrier: CarrierType, config: CarrierConfig): void {
        this.configs.set(carrier, config);

        // Clear existing adapter to force recreation with new config
        if (this.adapters.has(carrier)) {
            this.adapters.delete(carrier);
        }
    }

    /**
     * Get a carrier adapter instance
     * @param carrier - The carrier type to get an adapter for
     * @returns The carrier adapter instance
     * @throws CarrierAPIError if the carrier is not supported
     */
    static getAdapter(carrier: CarrierType): CarrierAPIAdapter {
        // Return existing adapter if available
        if (this.adapters.has(carrier)) {
            return this.adapters.get(carrier)!;
        }

        // Get configuration for this carrier
        const config = this.configs.get(carrier) || {};

        // Create new adapter based on carrier type
        let adapter: CarrierAPIAdapter;

        switch (carrier) {
            case Carrier.UPS:
                adapter = new UPSAdapter(config);
                break;
            case Carrier.FEDEX:
                adapter = new FedExAdapter(config);
                break;
            case Carrier.DHL:
                adapter = new DHLAdapter(config);
                break;
            case Carrier.USPS:
                adapter = new USPSAdapter(config);
                break;
            default:
                throw new CarrierAPIError(
                    `Unsupported carrier: ${carrier}`,
                    carrier,
                    'UNSUPPORTED_CARRIER'
                );
        }

        // Cache the adapter
        this.adapters.set(carrier, adapter);
        return adapter;
    }

    /**
     * Get all supported carriers
     * @returns Array of supported carrier types
     */
    static getSupportedCarriers(): CarrierType[] {
        return Object.values(Carrier);
    }

    /**
     * Check if a carrier is supported
     * @param carrier - The carrier type to check
     * @returns True if the carrier is supported
     */
    static isSupported(carrier: CarrierType): boolean {
        return this.getSupportedCarriers().includes(carrier);
    }

    /**
     * Validate a tracking number for a specific carrier
     * @param trackingNumber - The tracking number to validate
     * @param carrier - The carrier type
     * @returns Promise resolving to true if valid
     */
    static async validateTrackingNumber(trackingNumber: string, carrier: CarrierType): Promise<boolean> {
        try {
            const adapter = this.getAdapter(carrier);
            return await adapter.validateTrackingNumber(trackingNumber);
        } catch (error) {
            console.error(`Error validating tracking number for ${carrier}:`, error);
            return false;
        }
    }

    /**
     * Check availability of all configured carriers
     * @returns Promise resolving to a map of carrier availability status
     */
    static async checkAllAvailability(): Promise<Map<CarrierType, boolean>> {
        const availabilityMap = new Map<CarrierType, boolean>();
        const carriers = this.getSupportedCarriers();

        await Promise.all(
            carriers.map(async (carrier) => {
                try {
                    const adapter = this.getAdapter(carrier);
                    const isAvailable = await adapter.isAvailable();
                    availabilityMap.set(carrier, isAvailable);
                } catch (error) {
                    console.error(`Error checking availability for ${carrier}:`, error);
                    availabilityMap.set(carrier, false);
                }
            })
        );

        return availabilityMap;
    }

    /**
     * Clear all cached adapters (useful for testing or configuration changes)
     */
    static clearCache(): void {
        this.adapters.clear();
    }

    /**
     * Initialize factory with default configurations
     * This can be called at application startup
     */
    static initialize(): void {
        // Set default configurations for each carrier
        // In production, these would come from environment variables or config files

        this.configure(Carrier.UPS, {
            apiKey: process.env.UPS_API_KEY,
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 100
        });

        this.configure(Carrier.FEDEX, {
            apiKey: process.env.FEDEX_API_KEY,
            apiSecret: process.env.FEDEX_API_SECRET,
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 120
        });

        this.configure(Carrier.DHL, {
            apiKey: process.env.DHL_API_KEY,
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 80
        });

        this.configure(Carrier.USPS, {
            apiKey: process.env.USPS_API_KEY,
            timeout: 30000,
            retryAttempts: 3,
            rateLimitPerMinute: 60
        });
    }
}