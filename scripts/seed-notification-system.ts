#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { db } from '../src/database/db';
import { users } from '../src/database/schema';
import { notificationService } from '../src/lib/notificationService';
import { notificationTemplateManager } from '../src/lib/notificationTemplateManager';
import { eq } from 'drizzle-orm';

/**
 * Seed the notification system with default templates and user preferences
 */
async function seedNotificationSystem() {
    try {
        console.log('🌱 Starting notification system seeding...');

        // Step 1: Initialize default notification templates
        console.log('📝 Initializing default notification templates...');
        await notificationTemplateManager.initializeDefaultTemplates();

        // Step 2: Get all existing users
        console.log('👥 Getting existing users...');
        const existingUsers = await db.select().from(users);
        console.log(`Found ${existingUsers.length} existing users`);

        // Step 3: Create default notification preferences for existing users
        console.log('⚙️ Creating default notification preferences for existing users...');
        let preferencesCreated = 0;

        for (const user of existingUsers) {
            try {
                await notificationService.createDefaultPreferences(user.id, user.role || 'customer');
                preferencesCreated++;
                console.log(`✅ Created preferences for user: ${user.email} (${user.role})`);
            } catch (error) {
                console.error(`❌ Failed to create preferences for user ${user.email}:`, error);
            }
        }

        console.log(`📊 Created default preferences for ${preferencesCreated}/${existingUsers.length} users`);

        // Step 4: Create some sample notifications for testing (optional)
        if (process.env.NODE_ENV === 'development') {
            console.log('🧪 Creating sample notifications for development...');
            await createSampleNotifications(existingUsers);
        }

        console.log('✅ Notification system seeding completed successfully!');
        console.log('📋 Summary:');
        console.log(`   - Templates initialized: ✅`);
        console.log(`   - User preferences created: ${preferencesCreated}/${existingUsers.length}`);
        if (process.env.NODE_ENV === 'development') {
            console.log(`   - Sample notifications created: ✅`);
        }

    } catch (error) {
        console.error('❌ Error seeding notification system:', error);
        throw error;
    }
}

/**
 * Create sample notifications for development and testing
 */
async function createSampleNotifications(users: any[]) {
    try {
        // Find admin and customer users
        const adminUsers = users.filter(u => u.role === 'admin');
        const customerUsers = users.filter(u => u.role === 'customer');

        // Create sample admin notifications
        if (adminUsers.length > 0) {
            const adminUser = adminUsers[0];

            // Sample user registration notification
            await notificationTemplateManager.createNotificationFromTemplate(
                adminUser.id,
                'user_registered',
                {
                    userName: 'John Doe',
                    userEmail: 'john.doe@example.com',
                    userRole: 'customer'
                },
                {
                    actionUrl: '/admin/users',
                    priority: 'normal'
                }
            );

            // Sample system cleanup notification
            await notificationTemplateManager.createNotificationFromTemplate(
                adminUser.id,
                'system_cleanup_completed',
                {
                    deletedCount: 15,
                    archivedCount: 8,
                    hasErrors: false
                },
                {
                    priority: 'normal'
                }
            );

            // Sample lead converted notification
            await notificationTemplateManager.createNotificationFromTemplate(
                adminUser.id,
                'lead_converted',
                {
                    customerName: 'Jane Smith',
                    customerEmail: 'jane.smith@example.com'
                },
                {
                    actionUrl: '/admin/leads',
                    priority: 'high'
                }
            );

            console.log(`✅ Created sample admin notifications for ${adminUser.email}`);
        }

        // Create sample customer notifications
        if (customerUsers.length > 0) {
            const customerUser = customerUsers[0];

            // Sample welcome notification
            await notificationTemplateManager.createNotificationFromTemplate(
                customerUser.id,
                'welcome',
                {
                    userName: customerUser.name || 'Customer'
                },
                {
                    priority: 'normal'
                }
            );

            // Sample account updated notification
            await notificationTemplateManager.createNotificationFromTemplate(
                customerUser.id,
                'account_updated',
                {
                    changes: 'Profile information and contact details'
                },
                {
                    actionUrl: '/dashboard/profile',
                    priority: 'normal'
                }
            );

            console.log(`✅ Created sample customer notifications for ${customerUser.email}`);
        }

        // Create system maintenance notification for all users
        if (users.length > 0) {
            const allUserIds = users.map(u => u.id);
            await notificationTemplateManager.createNotificationsFromTemplate(
                allUserIds,
                'system_maintenance',
                {
                    scheduledAt: 'January 15, 2025 at 2:00 AM UTC',
                    duration: '2 hours'
                },
                {
                    priority: 'high',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
                }
            );

            console.log(`✅ Created system maintenance notification for all ${users.length} users`);
        }

    } catch (error) {
        console.error('❌ Error creating sample notifications:', error);
        // Don't throw error for sample notifications - they're optional
    }
}

/**
 * Verify notification system setup
 */
async function verifyNotificationSystem() {
    try {
        console.log('🔍 Verifying notification system setup...');

        // Check if templates exist
        const sampleTemplate = await notificationService.getTemplate('user_registered');
        if (!sampleTemplate) {
            throw new Error('Templates not found - seeding may have failed');
        }

        // Check if preferences exist for at least one user
        const sampleUsers = await db.select().from(users).limit(1);
        if (sampleUsers.length > 0) {
            const preferences = await notificationService.getUserPreferences(sampleUsers[0].id);
            if (preferences.length === 0) {
                console.warn('⚠️ No preferences found for sample user - this may be expected for new users');
            }
        }

        console.log('✅ Notification system verification completed');
        return true;

    } catch (error) {
        console.error('❌ Notification system verification failed:', error);
        return false;
    }
}

// Main execution
if (require.main === module) {
    seedNotificationSystem()
        .then(() => verifyNotificationSystem())
        .then((success) => {
            if (success) {
                console.log('🎉 Notification system is ready to use!');
                process.exit(0);
            } else {
                console.error('💥 Notification system setup incomplete');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('💥 Fatal error during seeding:', error);
            process.exit(1);
        });
}

export { seedNotificationSystem, createSampleNotifications, verifyNotificationSystem };