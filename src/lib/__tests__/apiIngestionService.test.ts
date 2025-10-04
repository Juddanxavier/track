/** @format */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIIngestionService } from '../apiIngestionService';
import type { APIShipmentData } from '@/types/shipment';

// Mock dependencies
vi.mock('@/database/db', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        values: vi.fn(),
    },
}));

vi.mock('@/lib/trackingCodeGenerator', () => ({
    trackingCodeGenerator: {
        generateTrackingCode: vi.fn().mockResolvedValue('SC123456789'),
    },
}));

vi.mock('@/lib/notificationEventHandlers', () => ({
    notificationEventHandlers: {
        handleShipmentCreated: vi.fn(),
    },
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn().mockReturnValue('test-id-123'),
}));

describe('APIIngestionService', () => {
    let service: APIIngestionService;
    let mockApiData: APIShipmentData;

    beforeEach(() => {
        service = new APIIngestionService();
        mockApiData = {
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            originAddress: {
                name: 'Sender Name',
                addressLine1: '123 Origin St',
                city: 'Origin City',
                state: 'OS',
                postalCode: '12345',
                country: 'US',
            },
            destinationAddress: {
                name: 'Recipient Name',
                addressLine1: '456 Destination Ave',
                city: 'Destination City',
                state: 'DS',
                postalCode: '67890',
                country: 'US',
            },
            packageDescription: 'Test package',
            weight: '5 lbs',
            externalId: 'EXT123',
        };
    });

    describe('validateAPIPayload', () => {
        it('should validate a correct payload', async () => {
            const result = await service.validateAPIPayload(mockApiData);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject payload with missing required fields', async () => {
            const invalidData = { ...mockApiData };
            delete (invalidData as any).customerName;

            const result = await service.validateAPIPayload(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('customerName');
        });

        it('should reject payload with invalid email', async () => {
            const invalidData = { ...mockApiData, customerEmail: 'invalid-email' };

            const result = await service.validateAPIPayload(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors.some(error => error.includes('email'))).toBe(true);
        });
    });

    describe('bulkIngest', () => {
        it('should process multiple shipments and return results', async () => {
            const shipments = [mockApiData, { ...mockApiData, customerEmail: 'jane@example.com' }];

            // Mock successful ingestion
            vi.spyOn(service, 'ingestFromAPI').mockResolvedValue({
                id: 'test-id',
                trackingCode: 'SC123456789',
            } as any);

            const result = await service.bulkIngest(shipments, 'test-source');

            expect(result.totalProcessed).toBe(2);
            expect(result.successful).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.createdShipments).toHaveLength(2);
        });

        it('should handle errors in bulk processing', async () => {
            const shipments = [mockApiData, { ...mockApiData, customerEmail: 'jane@example.com' }];

            // Mock one success, one failure
            vi.spyOn(service, 'ingestFromAPI')
                .mockResolvedValueOnce({ id: 'test-id', trackingCode: 'SC123456789' } as any)
                .mockRejectedValueOnce(new Error('Test error'));

            const result = await service.bulkIngest(shipments, 'test-source');

            expect(result.totalProcessed).toBe(2);
            expect(result.successful).toBe(1);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toBe('Test error');
        });
    });
});