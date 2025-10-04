#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { applyNotificationMigration } from './apply-notification-migration';
import { seedNotificationSystem, verifyNotificationSystem } from './seed-notification-system';

/**
 * Complete setup of the notification system including migration and seeding
 */
async function setupNotificationSystem() {
    try {
        console.log('🚀 Starting complete notification system setup...');
        console.log('=====================================');

        // Step 1: Apply database migration
        console.log('📊 Step 1: Applying database migration...');
        await applyNotificationMigration();
        console.log('✅ Database migration completed\n');

        // Step 2: Seed the system with templates and preferences
        console.log('🌱 Step 2: Seeding notification system...');
        await seedNotificationSystem();
        console.log('✅ Seeding completed\n');

        // Step 3: Verify everything is working
        console.log('🔍 Step 3: Verifying setup...');
        const isValid = await verifyNotificationSystem();

        if (isValid) {
            console.log('✅ Verification completed\n');
            console.log('🎉 Notification system setup completed successfully!');
            console.log('=====================================');
            console.log('📋 What was set up:');
            console.log('   ✅ Database tables and indexes');
            console.log('   ✅ Default notification templates');
            console.log('   ✅ User notification preferences');
            console.log('   ✅ Sample notifications (development only)');
            console.log('');
            console.log('🔧 Next steps:');
            console.log('   1. The notification system is ready to use');
            console.log('   2. Users will automatically get default preferences');
            console.log('   3. Templates can be customized via the NotificationTemplateManager');
            console.log('   4. Real-time notifications work via Server-Sent Events');
        } else {
            throw new Error('Setup verification failed');
        }

    } catch (error) {
        console.error('❌ Error during notification system setup:', error);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('   1. Check database connection');
        console.log('   2. Ensure all dependencies are installed');
        console.log('   3. Verify environment variables are set');
        console.log('   4. Check for any conflicting database state');
        throw error;
    }
}

// Main execution
if (require.main === module) {
    setupNotificationSystem()
        .then(() => {
            console.log('✨ Setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Setup failed:', error);
            process.exit(1);
        });
}

export { setupNotificationSystem };