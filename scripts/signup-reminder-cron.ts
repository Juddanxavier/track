#!/usr/bin/env tsx
/** @format */

/**
 * Automated signup reminder cron job
 * 
 * This script should be run daily to:
 * 1. Send reminders for pending signup links
 * 2. Clean up expired signup tokens
 * 3. Report signup statistics
 * 
 * Usage:
 *   npx tsx scripts/signup-reminder-cron.ts
 * 
 * Cron schedule (daily at 9 AM):
 *   0 9 * * * cd /path/to/project && npx tsx scripts/signup-reminder-cron.ts
 */

import { signupReminderService } from '../src/lib/signupReminderService';
import { notificationSystem } from '../src/lib/notificationSystem';
import { notificationService } from '../src/lib/notificationService';
import { NOTIFICATION_TYPES } from '../src/types/notification';

async function runSignupReminderCron() {
    console.log('🔄 Starting signup reminder cron job...');
    const startTime = Date.now();

    try {
        // 1. Send signup reminders
        console.log('📧 Sending signup reminders...');
        const reminderResults = await signupReminderService.sendSignupReminders(3, 2);

        console.log(`✅ Signup reminders completed:`);
        console.log(`   - Reminders sent: ${reminderResults.remindersSent}`);
        console.log(`   - Errors: ${reminderResults.errors.length}`);

        if (reminderResults.errors.length > 0) {
            console.log('❌ Reminder errors:');
            reminderResults.errors.forEach(error => console.log(`   - ${error}`));
        }

        // 2. Clean up expired signup tokens
        console.log('🧹 Cleaning up expired signup tokens...');
        const cleanupResults = await signupReminderService.cleanupExpiredSignupTokens();

        console.log(`✅ Token cleanup completed:`);
        console.log(`   - Tokens cleaned up: ${cleanupResults.cleanedUp}`);
        console.log(`   - Errors: ${cleanupResults.errors.length}`);

        if (cleanupResults.errors.length > 0) {
            console.log('❌ Cleanup errors:');
            cleanupResults.errors.forEach(error => console.log(`   - ${error}`));
        }

        // 3. Get signup statistics
        console.log('📊 Gathering signup statistics...');
        const stats = await signupReminderService.getSignupStats();

        console.log(`📈 Signup Statistics:`);
        console.log(`   - Total pending signups: ${stats.totalPendingSignups}`);
        console.log(`   - Expired tokens: ${stats.expiredTokens}`);
        console.log(`   - Recent signups (7 days): ${stats.recentSignups}`);
        console.log(`   - Completed signups: ${stats.completedSignups}`);
        console.log(`   - Average days to complete: ${stats.averageDaysToComplete}`);

        // 4. Send admin notification about cron job results
        try {
            const adminUsers = await notificationService.getAdminUsers();

            if (adminUsers.length > 0 && (reminderResults.remindersSent > 0 || cleanupResults.cleanedUp > 0)) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
                    {
                        deletedCount: cleanupResults.cleanedUp.toString(),
                        archivedCount: reminderResults.remindersSent.toString(),
                        hasErrors: (reminderResults.errors.length + cleanupResults.errors.length) > 0,
                        errorCount: (reminderResults.errors.length + cleanupResults.errors.length).toString(),
                        operation: 'Signup Reminder Maintenance',
                        details: `Sent ${reminderResults.remindersSent} reminders, cleaned up ${cleanupResults.cleanedUp} expired tokens`,
                    },
                    {
                        actionUrl: '/admin/shipments?filter=signup_sent',
                        priority: 'normal',
                    }
                );
            }
        } catch (notificationError) {
            console.error('Failed to send admin notification:', notificationError);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Signup reminder cron job completed in ${duration}ms`);

        // Exit with success
        process.exit(0);

    } catch (error) {
        console.error('❌ Signup reminder cron job failed:', error);

        // Try to send error notification to admins
        try {
            const adminUsers = await notificationService.getAdminUsers();

            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.SYSTEM_ERROR,
                    {
                        error: `Signup reminder cron job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        service: 'signup-reminder-cron',
                        timestamp: new Date().toISOString(),
                    },
                    {
                        priority: 'urgent',
                    }
                );
            }
        } catch (notificationError) {
            console.error('Failed to send error notification:', notificationError);
        }

        // Exit with error
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Signup reminder cron job interrupted');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('🛑 Signup reminder cron job terminated');
    process.exit(1);
});

// Run the cron job
runSignupReminderCron();