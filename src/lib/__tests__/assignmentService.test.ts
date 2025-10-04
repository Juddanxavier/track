/** @format */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssignmentService } from '../assignmentService';
import { UserAssignmentStatus, TrackingAssignmentStatus } from '@/types/shipment';

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
        set: vi.fn(),
        orderBy: vi.fn(),
    },
}));

vi.mock('@/lib/notificationService', () => ({
    notificationService: {
        createNotification: vi.fn(),
        createNotificationsForUsers: vi.fn(),
        getAdminUsers: vi.fn().mockResolvedValue(['admin1', 'admin2']),
    },
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn().mockReturnValue('test-event-id'),
}));

describe('AssignmentService', () => {
    let service: AssignmentService;

    beforeEach(() => {
        service = new AssignmentService();
        vi.clearAllMocks();
    });

    describe('updateUserAssignmentStatus', () => {
        it('should update user assignment status successfully', async () => {
            // Mock database responses
            const mockShipment = {
                id: 'shipment-1',
                userAssignmentStatus: UserAssignmentStatus.UNASSIGNED,
                trackingCode: 'SC123456789',
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
            };

            const { db } = await import('@/database/db');
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([mockShipment]),
                }),
            });

            (db.update as any).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            await service.updateUserAssignmentStatus(
                'shipment-1',
                UserAssignmentStatus.ASSIGNED,
                'admin-1',
                'user-1'
            );

            expect(db.update).toHaveBeenCalled();
            expect(db.insert).toHaveBeenCalled();
        });

        it('should throw error for non-existent shipment', async () => {
            const { db } = await import('@/database/db');
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([]),
                }),
            });

            await expect(
                service.updateUserAssignmentStatus('non-existent', UserAssignmentStatus.ASSIGNED)
            ).rejects.toThrow('Shipment with ID non-existent not found');
        });
    });

    describe('updateTrackingAssignmentStatus', () => {
        it('should update tracking assignment status with tracking details', async () => {
            const mockShipment = {
                id: 'shipment-1',
                trackingAssignmentStatus: TrackingAssignmentStatus.UNASSIGNED,
                trackingCode: 'SC123456789',
            };

            const { db } = await import('@/database/db');
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([mockShipment]),
                }),
            });

            (db.update as any).mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            (db.insert as any).mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            const trackingDetails = {
                courier: 'FedEx',
                trackingNumber: 'FDX123456789',
                shippingMethod: 'Ground',
            };

            await service.updateTrackingAssignmentStatus(
                'shipment-1',
                TrackingAssignmentStatus.ASSIGNED,
                'admin-1',
                trackingDetails
            );

            expect(db.update).toHaveBeenCalled();
            expect(db.insert).toHaveBeenCalled();
        });
    });

    describe('getAssignmentStats', () => {
        it('should return assignment statistics', async () => {
            const { db } = await import('@/database/db');

            // Mock count queries
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ totalShipments: 100 }]),
                }),
            });

            const stats = await service.getAssignmentStats();

            expect(stats).toHaveProperty('totalShipments');
            expect(stats).toHaveProperty('unassignedTracking');
            expect(stats).toHaveProperty('unassignedUsers');
            expect(stats).toHaveProperty('pendingSignups');
            expect(stats).toHaveProperty('fullyAssigned');
            expect(stats).toHaveProperty('recentlyIngested');
        });
    });

    describe('bulkUpdateUserAssignmentStatus', () => {
        it('should process multiple shipments and return results', async () => {
            const shipmentIds = ['shipment-1', 'shipment-2'];

            // Mock successful updates
            vi.spyOn(service, 'updateUserAssignmentStatus').mockResolvedValue();

            const result = await service.bulkUpdateUserAssignmentStatus(
                shipmentIds,
                UserAssignmentStatus.ASSIGNED,
                'admin-1',
                'user-1'
            );

            expect(result.successful).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle errors in bulk processing', async () => {
            const shipmentIds = ['shipment-1', 'shipment-2'];

            // Mock one success, one failure
            vi.spyOn(service, 'updateUserAssignmentStatus')
                .mockResolvedValueOnce()
                .mockRejectedValueOnce(new Error('Test error'));

            const result = await service.bulkUpdateUserAssignmentStatus(
                shipmentIds,
                UserAssignmentStatus.ASSIGNED,
                'admin-1',
                'user-1'
            );

            expect(result.successful).toBe(1);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Test error');
        });
    });
});