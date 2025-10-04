#!/usr/bin/env tsx
/** @format */

import { notificationEventHandlers } from '../src/lib/notificationEventHandlers';
import { notificationTemplateManager } from '../src/lib/notificationTemplateManager';
import { NOTIFICATION_TYPES } from '../src/types/notification';

async function testShipmentNotifications() {
    console.log('🔄 Testing shipment notification handlers...');

    try {
        // Initialize notification templates first
        console.log('📝 Initializing notification templates...');
        await notificationTemplateManager.initializeDefaultTemplates();
        console.log('✅ Templates initialized successfully');

        // Test shipment creation notification
        console.log('📝 Testing shipment creation notification...');
        await notificationEventHandlers.handleShipmentCreated({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            courier: 'FedEx',
            status: 'pending',
            createdBy: 'admin-user-1',
            leadId: 'lead-123',
        });
        console.log('✅ Shipment creation notification sent');

        // Test shipment status update notification
        console.log('📝 Testing shipment status update notification...');
        await notificationEventHandlers.handleShipmentStatusUpdate({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerId: 'customer-user-1',
            oldStatus: 'pending',
            newStatus: 'in-transit',
            courier: 'FedEx',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            location: 'Memphis, TN',
            updatedBy: 'api-sync',
        });
        console.log('✅ Shipment status update notification sent');

        // Test shipment delivered notification
        console.log('📝 Testing shipment delivered notification...');
        await notificationEventHandlers.handleShipmentDelivered({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerId: 'customer-user-1',
            courier: 'FedEx',
            deliveryDate: new Date(),
            location: 'Front door',
        });
        console.log('✅ Shipment delivered notification sent');

        // Test shipment out for delivery notification
        console.log('📝 Testing shipment out for delivery notification...');
        await notificationEventHandlers.handleShipmentOutForDelivery({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerId: 'customer-user-1',
            courier: 'FedEx',
            estimatedDelivery: new Date(),
            location: 'Local facility',
        });
        console.log('✅ Shipment out for delivery notification sent');

        // Test shipment in transit notification
        console.log('📝 Testing shipment in transit notification...');
        await notificationEventHandlers.handleShipmentInTransit({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerId: 'customer-user-1',
            courier: 'FedEx',
            estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            location: 'Chicago, IL',
        });
        console.log('✅ Shipment in transit notification sent');

        // Test shipment exception notification
        console.log('📝 Testing shipment exception notification...');
        await notificationEventHandlers.handleShipmentException({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            courier: 'FedEx',
            exceptionReason: 'Weather delay',
            location: 'Denver, CO',
            eventTime: new Date(),
        });
        console.log('✅ Shipment exception notification sent');

        // Test shipment delayed notification
        console.log('📝 Testing shipment delayed notification...');
        await notificationEventHandlers.handleShipmentDelayed({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            courier: 'FedEx',
            delayReason: 'Severe weather conditions',
            originalDelivery: new Date(),
            newEstimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            location: 'Denver, CO',
        });
        console.log('✅ Shipment delayed notification sent');

        // Test shipment delivery failed notification
        console.log('📝 Testing shipment delivery failed notification...');
        await notificationEventHandlers.handleShipmentDeliveryFailed({
            id: 'test-shipment-1',
            trackingCode: 'SC123456789',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            courier: 'FedEx',
            failureReason: 'No one available to receive package',
            attemptNumber: 1,
            nextAttemptDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            location: 'Customer address',
        });
        console.log('✅ Shipment delivery failed notification sent');

        console.log('🎉 All shipment notification tests completed successfully!');

        // Test template rendering
        console.log('📝 Testing template rendering...');
        const renderedNotification = await notificationTemplateManager.getRenderedNotification(
            NOTIFICATION_TYPES.SHIPMENT_CREATED,
            {
                trackingCode: 'SC123456789',
                customerName: 'John Doe',
                creationMethod: 'converted from lead',
                courier: 'FedEx',
            }
        );

        if (renderedNotification) {
            console.log('✅ Template rendered successfully:');
            console.log(`   Title: ${renderedNotification.title}`);
            console.log(`   Message: ${renderedNotification.message}`);
            console.log(`   Priority: ${renderedNotification.priority}`);
        } else {
            console.log('❌ Failed to render template');
        }

    } catch (error) {
        console.error('❌ Error testing shipment notifications:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    testShipmentNotifications().then(() => {
        console.log('✅ Test completed');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

export { testShipmentNotifications };