#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Apply the notification system seeding migration
 */
async function applyNotificationSeeding() {
    try {
        console.log('🌱 Applying notification system seeding migration...');

        // Read the seeding migration file
        const migrationPath = join(process.cwd(), 'migrations', '0008_seed_notification_system.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        console.log('📝 Executing seeding migration...');

        // Execute the migration
        await db.execute(sql.raw(migrationSQL));

        console.log('✅ Notification system seeding migration applied successfully!');

        // Verify the seeding
        console.log('🔍 Verifying seeding results...');

        // Check templates
        const templateCount = await db.execute(sql`SELECT COUNT(*) as count FROM notification_templates`);
        console.log(`📋 Templates created: ${templateCount.rows[0].count}`);

        // Check preferences
        const preferenceCount = await db.execute(sql`SELECT COUNT(*) as count FROM notification_preferences`);
        console.log(`⚙️ Preferences created: ${preferenceCount.rows[0].count}`);

        // Check users
        const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        console.log(`👥 Total users: ${userCount.rows[0].count}`);

        console.log('✅ Seeding verification completed!');

    } catch (error) {
        console.error('❌ Error applying notification seeding:', error);
        throw error;
    }
}

/**
 * Check if seeding has already been applied
 */
async function checkSeedingStatus() {
    try {
        // Check if templates exist
        const templateCount = await db.execute(sql`SELECT COUNT(*) as count FROM notification_templates`);
        const hasTemplates = Number(templateCount.rows[0].count) > 0;

        // Check if preferences exist
        const preferenceCount = await db.execute(sql`SELECT COUNT(*) as count FROM notification_preferences`);
        const hasPreferences = Number(preferenceCount.rows[0].count) > 0;

        return {
            hasTemplates,
            hasPreferences,
            templateCount: Number(templateCount.rows[0].count),
            preferenceCount: Number(preferenceCount.rows[0].count),
        };

    } catch (error) {
        console.error('❌ Error checking seeding status:', error);
        return {
            hasTemplates: false,
            hasPreferences: false,
            templateCount: 0,
            preferenceCount: 0,
        };
    }
}

/**
 * Main function with status checking
 */
async function main() {
    try {
        console.log('🔍 Checking current seeding status...');
        const status = await checkSeedingStatus();

        console.log(`📊 Current status:`);
        console.log(`   Templates: ${status.templateCount}`);
        console.log(`   Preferences: ${status.preferenceCount}`);

        if (status.hasTemplates && status.hasPreferences) {
            console.log('ℹ️ Notification system appears to be already seeded.');
            console.log('🔄 Re-running seeding to ensure all templates and preferences are up to date...');
        }

        await applyNotificationSeeding();

        // Check final status
        const finalStatus = await checkSeedingStatus();
        console.log(`\n📊 Final status:`);
        console.log(`   Templates: ${finalStatus.templateCount}`);
        console.log(`   Preferences: ${finalStatus.preferenceCount}`);

        console.log('🎉 Notification system seeding completed successfully!');

    } catch (error) {
        console.error('💥 Seeding failed:', error);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    main()
        .then(() => {
            console.log('✨ Seeding completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Seeding failed:', error);
            process.exit(1);
        });
}

export { applyNotificationSeeding, checkSeedingStatus };