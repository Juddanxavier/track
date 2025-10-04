/** @format */

import { apiIngestionService } from '@/lib/apiIngestionService';
import { assignmentService } from '@/lib/assignmentService';
import type { APIShipmentData } from '@/types/shipment';
import { UserAssignmentStatus, TrackingAssignmentStatus } from '@/types/shipment';

async function testAPIIngestion() {
    console.log('🧪 Testing API Ingestion Service...\n');

    // Test data
    const testShipmentData: APIShipmentData = {
        customerName: 'John Doe',
        customerEmail: 'john.doe@example.com',
        customerPhone: '+1-555-0123',
        originAddress: {
            name: 'Acme Corp',
            addressLine1: '123 Business St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
        },
        destinationAddress: {
            name: 'John Doe',
            addressLine1: '456 Home Ave',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
        },
        packageDescription: 'Test package for API ingestion',
        weight: '2.5 lbs',
        value: '$50.00',
        specialInstructions: 'Handle with care',
        externalId: 'TEST-001',
        externalSource: 'test-system',
    };

    try {
        // Test 1: Validate API payload
        console.log('1️⃣ Testing payload validation...');
        const validation = await apiIngestionService.validateAPIPayload(testShipmentData);
        console.log('✅ Validation result:', validation);

        if (!validation.valid) {
            console.log('❌ Validation failed:', validation.errors);
            return;
        }

        // Test 2: Ingest single shipment
        console.log('\n2️⃣ Testing single shipment ingestion...');
        const createdShipment = await apiIngestionService.ingestFromAPI(testShipmentData, 'test-api');
        console.log('✅ Shipment created:', {
            id: createdShipment.id,
            trackingCode: createdShipment.trackingCode,
            customerName: createdShipment.customerName,
            userAssignmentStatus: createdShipment.userAssignmentStatus,
            trackingAssignmentStatus: createdShipment.trackingAssignmentStatus,
        });

        // Test 3: Test assignment service
        console.log('\n3️⃣ Testing assignment service...');

        // Update user assignment status
        await assignmentService.updateUserAssignmentStatus(
            createdShipment.id,
            UserAssignmentStatus.SIGNUP_SENT,
            'test-admin'
        );
        console.log('✅ User assignment status updated to SIGNUP_SENT');

        // Update tracking assignment status
        await assignmentService.updateTrackingAssignmentStatus(
            createdShipment.id,
            TrackingAssignmentStatus.ASSIGNED,
            'test-admin',
            {
                courier: 'FedEx',
                trackingNumber: 'FDX123456789',
                shippingMethod: 'Ground',
            }
        );
        console.log('✅ Tracking assignment status updated to ASSIGNED');

        // Test 4: Get assignment statistics
        console.log('\n4️⃣ Testing assignment statistics...');
        const stats = await assignmentService.getAssignmentStats();
        console.log('✅ Assignment stats:', stats);

        // Test 5: Test bulk ingestion
        console.log('\n5️⃣ Testing bulk ingestion...');
        const bulkData = [
            { ...testShipmentData, customerEmail: 'customer1@example.com', externalId: 'BULK-001' },
            { ...testShipmentData, customerEmail: 'customer2@example.com', externalId: 'BULK-002' },
        ];

        const bulkResult = await apiIngestionService.bulkIngest(bulkData, 'bulk-test-api');
        console.log('✅ Bulk ingestion result:', {
            totalProcessed: bulkResult.totalProcessed,
            successful: bulkResult.successful,
            failed: bulkResult.failed,
            createdShipments: bulkResult.createdShipments.length,
        });

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    }
}

// Run the test
if (require.main === module) {
    testAPIIngestion().catch(console.error);
}

export { testAPIIngestion };