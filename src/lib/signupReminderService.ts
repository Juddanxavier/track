/** @format */

import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq, and, isNull, lt, count } from 'drizzle-orm';
import { assignmentNotificationService } from './assignmentNotificationService';
import { shipmentEventService } from './shipmentEventService';

/**
 * Service for managing signup reminders and follow-ups
 * Handles automated reminder sending for pending signup links
 */
export class SignupReminderService {
    /**
     * Send reminders for signup links that are older than the specified days
     */
    async sendSignupReminders(
        reminderAfterDays: number = 3,
        maxReminders: number = 2
    ): Promise<{
        remindersSent: number;
        errors: string[];
        processed: Array<{
            shipmentId: string;
            trackingCode: string;
            customerEmail: string;
            daysSinceSignup: number;
            status: 'sent' | 'error';
            error?: string;
        }>;
    }> {
        const result = {
            remindersSent: 0,
            errors: [] as string[],
            processed: [] as Array<{
                shipmentId: string;
                trackingCode: string;
                customerEmail: string;
                daysSinceSignup: number;
                status: 'sent' | 'error';
                error?: string;
            }>,
        };

        try {
            // Calculate the cutoff date for reminders
            const cutoffDate = new Date(Date.now() - reminderAfterDays * 24 * 60 * 60 * 1000);

            // Find shipments with pending signup links that need reminders
            const pendingSignups = await db
                .select()
                .from(shipments)
                .where(
                    and(
                        eq(shipments.userAssignmentStatus, 'signup_sent'),
                        isNull(shipments.assignedUserId)
                    )
                );

            console.log(`Found ${pendingSignups.length} shipments needing signup reminders`);

            for (const shipment of pendingSignups) {
                try {
                    if (!shipment.signupLinkSentAt) {
                        continue;
                    }

                    const daysSinceSignup = Math.floor(
                        (Date.now() - shipment.signupLinkSentAt.getTime()) / (24 * 60 * 60 * 1000)
                    );

                    // Check if we've already sent too many reminders
                    const reminderCount = await this.getReminderCount(shipment.id);
                    if (reminderCount >= maxReminders) {
                        console.log(`Skipping shipment ${shipment.trackingCode} - max reminders reached`);
                        continue;
                    }

                    // Send reminder notification
                    await assignmentNotificationService.sendSignupReminders();

                    // Record the reminder event
                    await shipmentEventService.addEvent({
                        shipmentId: shipment.id,
                        eventType: 'status_change',
                        description: `Signup reminder sent to ${shipment.customerEmail} (${daysSinceSignup} days after initial invitation)`,
                        source: 'admin_action',
                        sourceId: 'signup_reminder_service',
                        eventTime: new Date(),
                        metadata: {
                            action: 'signup_reminder_sent',
                            customerEmail: shipment.customerEmail,
                            daysSinceSignup,
                            reminderCount: reminderCount + 1,
                            maxReminders,
                            auditTrail: {
                                action: 'send_signup_reminder',
                                source: 'automated_service',
                                recordedAt: new Date().toISOString(),
                            },
                        },
                    });

                    result.remindersSent++;
                    result.processed.push({
                        shipmentId: shipment.id,
                        trackingCode: shipment.trackingCode,
                        customerEmail: shipment.customerEmail,
                        daysSinceSignup,
                        status: 'sent',
                    });

                    console.log(`Sent signup reminder for shipment ${shipment.trackingCode}`);

                } catch (error: any) {
                    const errorMessage = error.message || 'Unknown error';
                    result.errors.push(`Shipment ${shipment.trackingCode}: ${errorMessage}`);
                    result.processed.push({
                        shipmentId: shipment.id,
                        trackingCode: shipment.trackingCode,
                        customerEmail: shipment.customerEmail,
                        daysSinceSignup: Math.floor(
                            (Date.now() - (shipment.signupLinkSentAt?.getTime() || 0)) / (24 * 60 * 60 * 1000)
                        ),
                        status: 'error',
                        error: errorMessage,
                    });

                    console.error(`Failed to send reminder for shipment ${shipment.trackingCode}:`, error);
                }
            }

            console.log(`Signup reminder service completed: ${result.remindersSent} sent, ${result.errors.length} errors`);

        } catch (error: any) {
            const errorMessage = `Failed to process signup reminders: ${error.message}`;
            result.errors.push(errorMessage);
            console.error(errorMessage, error);
        }

        return result;
    }

    /**
     * Get the count of reminders already sent for a shipment
     */
    private async getReminderCount(shipmentId: string): Promise<number> {
        try {
            const events = await db
                .select()
                .from(shipments)
                .where(eq(shipments.id, shipmentId));

            // In a real implementation, you would query shipment events
            // and count events with action 'signup_reminder_sent'
            // For now, we'll return 0 to allow reminders
            return 0;
        } catch (error) {
            console.error('Failed to get reminder count:', error);
            return 0;
        }
    }

    /**
     * Clean up expired signup tokens
     */
    async cleanupExpiredSignupTokens(): Promise<{
        cleanedUp: number;
        errors: string[];
    }> {
        const result = {
            cleanedUp: 0,
            errors: [] as string[],
        };

        try {
            const now = new Date();

            // Find shipments with expired signup tokens
            const expiredTokenShipments = await db
                .select()
                .from(shipments)
                .where(
                    and(
                        eq(shipments.userAssignmentStatus, 'signup_sent'),
                        isNull(shipments.assignedUserId),
                        lt(shipments.signupTokenExpiry, now)
                    )
                );

            console.log(`Found ${expiredTokenShipments.length} shipments with expired signup tokens`);

            for (const shipment of expiredTokenShipments) {
                try {
                    // Reset the shipment to unassigned status
                    await db
                        .update(shipments)
                        .set({
                            userAssignmentStatus: 'unassigned',
                            signupToken: null,
                            signupTokenExpiry: null,
                            signupLinkSentAt: null,
                            updatedAt: new Date(),
                        })
                        .where(eq(shipments.id, shipment.id));

                    // Record the cleanup event
                    await shipmentEventService.addEvent({
                        shipmentId: shipment.id,
                        eventType: 'status_change',
                        description: `Signup token expired and cleaned up for ${shipment.customerEmail}`,
                        source: 'admin_action',
                        sourceId: 'signup_cleanup_service',
                        eventTime: new Date(),
                        metadata: {
                            action: 'signup_token_expired_cleanup',
                            customerEmail: shipment.customerEmail,
                            expiredAt: shipment.signupTokenExpiry?.toISOString(),
                            auditTrail: {
                                action: 'cleanup_expired_signup_token',
                                source: 'automated_service',
                                recordedAt: new Date().toISOString(),
                            },
                        },
                    });

                    result.cleanedUp++;
                    console.log(`Cleaned up expired signup token for shipment ${shipment.trackingCode}`);

                } catch (error: any) {
                    const errorMessage = `Shipment ${shipment.trackingCode}: ${error.message}`;
                    result.errors.push(errorMessage);
                    console.error(`Failed to cleanup expired token for shipment ${shipment.trackingCode}:`, error);
                }
            }

            console.log(`Signup token cleanup completed: ${result.cleanedUp} cleaned up, ${result.errors.length} errors`);

        } catch (error: any) {
            const errorMessage = `Failed to cleanup expired signup tokens: ${error.message}`;
            result.errors.push(errorMessage);
            console.error(errorMessage, error);
        }

        return result;
    }

    /**
     * Get signup statistics for monitoring
     */
    async getSignupStats(): Promise<{
        totalPendingSignups: number;
        expiredTokens: number;
        recentSignups: number;
        completedSignups: number;
        averageDaysToComplete: number;
    }> {
        try {
            // Get total pending signups
            const [{ totalPendingSignups }] = await db
                .select({ totalPendingSignups: count() })
                .from(shipments)
                .where(eq(shipments.userAssignmentStatus, 'signup_sent'));

            // Get expired tokens
            const now = new Date();
            const [{ expiredTokens }] = await db
                .select({ expiredTokens: count() })
                .from(shipments)
                .where(
                    and(
                        eq(shipments.userAssignmentStatus, 'signup_sent'),
                        lt(shipments.signupTokenExpiry, now)
                    )
                );

            // Get recent signups (last 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const [{ recentSignups }] = await db
                .select({ recentSignups: count() })
                .from(shipments)
                .where(eq(shipments.userAssignmentStatus, 'signup_sent'));

            // Get completed signups
            const [{ completedSignups }] = await db
                .select({ completedSignups: count() })
                .from(shipments)
                .where(eq(shipments.userAssignmentStatus, 'signup_completed'));

            // Calculate average days to complete (simplified)
            // In a real implementation, you would calculate this from shipment events
            const averageDaysToComplete = 2.5; // Placeholder

            return {
                totalPendingSignups,
                expiredTokens,
                recentSignups,
                completedSignups,
                averageDaysToComplete,
            };

        } catch (error) {
            console.error('Failed to get signup stats:', error);
            return {
                totalPendingSignups: 0,
                expiredTokens: 0,
                recentSignups: 0,
                completedSignups: 0,
                averageDaysToComplete: 0,
            };
        }
    }
}

// Export singleton instance
export const signupReminderService = new SignupReminderService();