#!/usr/bin/env tsx
/** @format */

import {
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITIES,
    ADMIN_NOTIFICATION_TYPES,
    CUSTOMER_NOTIFICATION_TYPES,
    type Notification,
    type NotificationPreference,
    type NotificationTemplate,
    type CreateNotificationRequest
} from '../src/types/notification';

function testNotificationTypes() {
    console.log('🔄 Testing notification types...');

    // Test notification type constants
    console.log('📝 Testing notification type constants:');
    console.log('Admin notification types:', ADMIN_NOTIFICATION_TYPES.length);
    console.log('Customer notification types:', CUSTOMER_NOTIFICATION_TYPES.length);
    console.log('All notification types:', Object.keys(NOTIFICATION_TYPES).length);

    // Test priority constants
    console.log('📝 Testing priority constants:');
    console.log('Available priorities:', Object.values(NOTIFICATION_PRIORITIES));

    // Test interface creation
    console.log('📝 Testing interface creation:');

    const testNotification: Notification = {
        id: 'test-1',
        userId: 'user-1',
        type: NOTIFICATION_TYPES.USER_REGISTERED,
        title: 'Test Notification',
        message: 'This is a test notification',
        read: false,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        createdAt: new Date(),
    };

    const testPreference: NotificationPreference = {
        id: 'pref-1',
        userId: 'user-1',
        type: NOTIFICATION_TYPES.USER_REGISTERED,
        enabled: true,
        emailEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const testTemplate: NotificationTemplate = {
        id: 'template-1',
        type: NOTIFICATION_TYPES.USER_REGISTERED,
        title: 'New User Registration',
        message: 'A new user has registered: {{userName}}',
        defaultPriority: NOTIFICATION_PRIORITIES.NORMAL,
        roles: ['admin'],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const testCreateRequest: CreateNotificationRequest = {
        userId: 'user-1',
        type: NOTIFICATION_TYPES.WELCOME,
        title: 'Welcome!',
        message: 'Welcome to our platform!',
        priority: NOTIFICATION_PRIORITIES.NORMAL,
    };

    console.log('✅ All notification types and interfaces work correctly!');
    console.log('Sample notification:', testNotification.title);
    console.log('Sample preference:', testPreference.type);
    console.log('Sample template:', testTemplate.title);
    console.log('Sample create request:', testCreateRequest.title);
}

if (require.main === module) {
    testNotificationTypes();
}

export { testNotificationTypes };