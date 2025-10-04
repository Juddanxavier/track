/** @format */

/**
 * Comprehensive test script for lead-to-shipment-to-delivery workflow
 * This script tests the complete functionality from lead conversion to delivery tracking
 */

import { db } from '@/database/db';
import { leads, shipments, shipmentEvents, users } from '@/database/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { shipmentService } from '@/lib/shipmentService';
import { trackingService } from '@/lib/trackingService';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

interface TestResult {
    step: string;
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

class WorkflowTester {
    private results: TestResult[] = [];
    private testLeadId: string = '';
    private testShipmentId: string = '';
    private testUserId: string = '';

    private log(step: string, success: boolean, message: string, data?: any, error?: string) {
        const result: TestResult = { step, success, message, data, error };
        this.results.push(result);

        const status = success ? '✅' : '❌';
        console.log(`${status} ${step}: ${message}`);
        if (error) {
            console.error(`   Error: ${error}`);
        }
        if (data && success) {
            console.log(`   Data:`, JSON.stringify(data, null, 2));
        }
    }

    async runCompleteWorkflowTest(): Promise<TestResult[]> {
        console.log('🚀 Starting complete lead-to-shipment-to-delivery workflow test...\n');

        try {
            // Step 1: Setup test data
            await this.setupTestData();

            // Step 2: Test lead creation
            await this.testLeadCreation();

            // Step 3: Test lead to shipment conversion
            await this.testLeadToShipmentConversion();

            // Step 4: Test shipment status updates
            await this.testShipmentStatusUpdates();

            // Step 5: Test API integration simulation
            await this.testAPIIntegrationSimulation();

            // Step 6: Test public tracking
            await this.testPublicTracking();

            // Step 7: Test notification delivery
            await this.testNotificationDelivery();

            // Step 8: Test audit trail validation
            await this.testAuditTrailValidation();

            // Step 9: Cleanup test data
            await this.cleanupTestData();

        } catch (error) {
            this.log('FATAL_ERROR', false, 'Test execution failed', null, error instanceof Error ? error.message : String(error));
        }

        // Print summary
        this.printSummary();
        return this.results;
    }

    private async setupTestData() {
        try {
            // Try to find an existing admin user first
            const [existingAdmin] = await db
                .select()
                .from(users)
                .where(eq(users.role, 'admin'))
                .limit(1);

            if (existingAdmin) {
                this.testUserId = existingAdmin.id;
                this.log('SETUP', true, 'Using existing admin user for testing', { userId: this.testUserId });
            } else {
                // Create test user with minimal required fields
                this.testUserId = nanoid();
                await db.insert(users).values({
                    id: this.testUserId,
                    email: 'test-admin@example.com',
                    name: 'Test Admin',
                    role: 'admin',
                    emailVerified: true,
                });

                this.log('SETUP', true, 'Test user created successfully', { userId: this.testUserId });
            }
        } catch (error) {
            this.log('SETUP', false, 'Failed to setup test user', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testLeadCreation() {
        try {
            this.testLeadId = nanoid();

            const leadData = {
                id: this.testLeadId,
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                customerPhone: '+1234567890',
                originCountry: 'United States',
                destinationCountry: 'Canada',
                weight: '5kg',
                packageType: 'Box',
                status: 'success',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await db.insert(leads).values(leadData);

            // Verify lead creation
            const [createdLead] = await db
                .select()
                .from(leads)
                .where(eq(leads.id, this.testLeadId));

            if (createdLead) {
                this.log('LEAD_CREATION', true, 'Lead created successfully', { leadId: this.testLeadId, customerName: createdLead.customerName });
            } else {
                throw new Error('Lead not found after creation');
            }
        } catch (error) {
            this.log('LEAD_CREATION', false, 'Failed to create lead', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testLeadToShipmentConversion() {
        try {
            const conversionData = {
                courier: 'FedEx',
                courierTrackingNumber: 'FDX123456789',
                packageDescription: 'Test Package',
                weight: '5kg',
                originAddress: {
                    name: 'Test Sender',
                    addressLine1: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    postalCode: '10001',
                    country: 'United States',
                },
                destinationAddress: {
                    name: 'John Doe',
                    addressLine1: '456 Oak Ave',
                    city: 'Toronto',
                    state: 'ON',
                    postalCode: 'M5V 3A8',
                    country: 'Canada',
                },
                estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            };

            const shipment = await shipmentService.createFromLead(this.testLeadId, conversionData, this.testUserId);
            this.testShipmentId = shipment.id;

            // Verify lead status update
            const [updatedLead] = await db
                .select()
                .from(leads)
                .where(eq(leads.id, this.testLeadId));

            if (updatedLead?.status === 'converted' && updatedLead.shipmentId === this.testShipmentId) {
                this.log('LEAD_CONVERSION', true, 'Lead converted to shipment successfully', {
                    shipmentId: this.testShipmentId,
                    trackingCode: shipment.trackingCode,
                    leadStatus: updatedLead.status
                });
            } else {
                throw new Error('Lead status not updated correctly after conversion');
            }
        } catch (error) {
            this.log('LEAD_CONVERSION', false, 'Failed to convert lead to shipment', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testShipmentStatusUpdates() {
        try {
            const statusUpdates = [
                { status: 'in-transit', description: 'Package picked up by courier' },
                { status: 'out-for-delivery', description: 'Package out for delivery' },
                { status: 'delivered', description: 'Package delivered successfully' }
            ];

            for (const update of statusUpdates) {
                await shipmentService.updateStatus(
                    this.testShipmentId,
                    update.status as any,
                    'manual',
                    this.testUserId,
                    update.description
                );

                // Verify status update
                const shipment = await shipmentService.getById(this.testShipmentId);
                if (shipment?.status === update.status) {
                    this.log('STATUS_UPDATE', true, `Status updated to ${update.status}`, { status: update.status });
                } else {
                    throw new Error(`Status not updated to ${update.status}`);
                }

                // Add small delay between updates
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            this.log('STATUS_UPDATE', false, 'Failed to update shipment status', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testAPIIntegrationSimulation() {
        try {
            // Simulate API sync
            const mockApiData = {
                status: 'delivered',
                location: 'Toronto, ON, Canada',
                timestamp: new Date(),
                description: 'Package delivered to recipient',
            };

            // Add API event
            await shipmentService.addEvent({
                shipmentId: this.testShipmentId,
                eventType: 'status_change',
                status: 'delivered',
                description: mockApiData.description,
                location: mockApiData.location,
                source: 'api',
                sourceId: 'shipengine_test',
                eventTime: mockApiData.timestamp,
                metadata: {
                    apiProvider: 'shipengine',
                    apiEventId: 'test_event_123',
                    rawData: mockApiData,
                },
            });

            this.log('API_INTEGRATION', true, 'API integration simulation completed', mockApiData);
        } catch (error) {
            this.log('API_INTEGRATION', false, 'Failed to simulate API integration', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testPublicTracking() {
        try {
            const shipment = await shipmentService.getById(this.testShipmentId);
            if (!shipment) {
                throw new Error('Shipment not found');
            }

            // Test public tracking by tracking code
            const publicTrackingInfo = await trackingService.getPublicTrackingInfo(shipment.trackingCode);

            if (publicTrackingInfo && publicTrackingInfo.trackingCode === shipment.trackingCode) {
                this.log('PUBLIC_TRACKING', true, 'Public tracking information retrieved successfully', {
                    trackingCode: publicTrackingInfo.trackingCode,
                    status: publicTrackingInfo.status,
                    eventsCount: publicTrackingInfo.events?.length || 0
                });
            } else {
                throw new Error('Public tracking information not available');
            }
        } catch (error) {
            this.log('PUBLIC_TRACKING', false, 'Failed to retrieve public tracking information', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async testNotificationDelivery() {
        try {
            // Test shipment status change notification
            await notificationEventHandlers.handleShipmentStatusChanged({
                id: this.testShipmentId,
                trackingCode: 'SC123456789', // Mock tracking code
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                status: 'delivered',
                previousStatus: 'out-for-delivery',
                courier: 'FedEx',
                updatedBy: this.testUserId,
            });

            this.log('NOTIFICATION_DELIVERY', true, 'Notification delivery test completed', {
                notificationType: 'shipment_status_changed',
                status: 'delivered'
            });
        } catch (error) {
            this.log('NOTIFICATION_DELIVERY', false, 'Failed to test notification delivery', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testAuditTrailValidation() {
        try {
            // Get shipment with events
            const shipmentWithEvents = await shipmentService.getShipmentWithEvents(this.testShipmentId);

            if (!shipmentWithEvents) {
                throw new Error('Shipment with events not found');
            }

            const events = shipmentWithEvents.events;
            const requiredEventTypes = ['status_change'];
            const requiredSources = ['manual', 'api'];

            // Validate event structure
            let hasManualEvents = false;
            let hasApiEvents = false;
            let hasStatusChanges = false;

            for (const event of events) {
                if (event.eventType === 'status_change') {
                    hasStatusChanges = true;
                }
                if (event.source === 'manual') {
                    hasManualEvents = true;
                }
                if (event.source === 'api') {
                    hasApiEvents = true;
                }

                // Validate event structure
                if (!event.id || !event.eventTime || !event.description) {
                    throw new Error(`Invalid event structure: ${JSON.stringify(event)}`);
                }
            }

            if (hasStatusChanges && hasManualEvents && hasApiEvents) {
                this.log('AUDIT_TRAIL', true, 'Audit trail validation passed', {
                    totalEvents: events.length,
                    hasStatusChanges,
                    hasManualEvents,
                    hasApiEvents
                });
            } else {
                throw new Error('Audit trail missing required event types or sources');
            }
        } catch (error) {
            this.log('AUDIT_TRAIL', false, 'Failed to validate audit trail', null, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    private async cleanupTestData() {
        try {
            // Delete shipment (will cascade delete events)
            if (this.testShipmentId) {
                await db.delete(shipments).where(eq(shipments.id, this.testShipmentId));
            }

            // Delete lead
            if (this.testLeadId) {
                await db.delete(leads).where(eq(leads.id, this.testLeadId));
            }

            // Only delete test user if we created it (not if we used existing admin)
            const [existingUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, this.testUserId));

            if (existingUser && existingUser.email === 'test-admin@example.com') {
                await db.delete(users).where(eq(users.id, this.testUserId));
            }

            this.log('CLEANUP', true, 'Test data cleaned up successfully');
        } catch (error) {
            this.log('CLEANUP', false, 'Failed to cleanup test data', null, error instanceof Error ? error.message : String(error));
        }
    }

    private printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.step}: ${r.message}`));
        }

        console.log('\n🎯 Workflow Test Complete!');
    }
}

// Main execution
async function main() {
    const tester = new WorkflowTester();
    const results = await tester.runCompleteWorkflowTest();

    // Exit with appropriate code
    const hasFailures = results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { WorkflowTester };