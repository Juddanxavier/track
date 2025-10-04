/** @format */

import { notificationSystem } from './notificationSystem';
import { notificationService } from './notificationService';
import { NOTIFICATION_TYPES } from '@/types/notification';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Service for handling assignment-related notifications
 * Integrates with the existing notification system to send notifications
 * for user assignments, tracking assignments, and signup workflows
 */
export class AssignmentNotificationService {
    /**
     * Notify when a user is assigned to a shipment
     */
    async notifyUserAssignment(
        shipmentId: string,
        assignedUserId: string,
        adminId?: string
    ): Promise<void> {
        try {
            // Get shipment and user details
            const [shipment] = await db
                .select()
                .from(shipments)
                .where(eq(shipments.id, shipmentId));

            if (!shipment) {
                throw new Error(`Shipment with ID ${shipmentId} not found`);
            }

            const [assignedUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, assignedUserId));

            if (!assignedUser) {
                throw new Error(`User with ID ${assignedUserId} not found`);
            }

            let adminName = 'System';
            if (adminId) {
                const [admin] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, adminId));
                if (admin) {
                    adminName = admin.name || admin.email;
                }
            }

            // Notify the assigned user
            await notificationSystem.createNotification(
                assignedUserId,
                NOTIFICATION_TYPES.SHIPMENT_USER_ASSIGNED,
                {
                    trackingCode: shipment.trackingCode,
                    customerName: shipment.customerName,
                    assignedBy: adminName,
                },
                {
                    actionUrl: `/dashboard/shipments/${shipmentId}`,
                    priority: 'high',
                }
            );

            // Notify admins about the assignment completion
            const adminUsers = await notificationService.getAdminUsers();
            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.USER_ASSIGNMENT_COMPLETED,
                    {
                        userName: assignedUser.name || assignedUser.email,
                        userEmail: assignedUser.email,
                        trackingCode: shipment.trackingCode,
                        customerName: shipment.customerName,
                        assignedBy: adminName,
                    },
                    {
                        actionUrl: `/admin/shipments/${shipmentId}`,
                        priority: 'normal',
                    }
                );
            }

            console.log(`Sent user assignment notifications for shipment ${shipmentId}`);
        } catch (error) {
            console.error('Failed to send user assignment notifications:', error);
            throw error;
        }
    }

    /**
     * Notify when tracking number is assigned to a shipment
     */
    async notifyTrackingAssignment(
        shipmentId: string,
        trackingDetails: {
            courier: string;
            trackingNumber: string;
            shippingMethod?: string;
        },
        adminId?: string
    ): Promise<void> {
        try {
            // Get shipment details
            const [shipment] = await db
                .select()
                .from(shipments)
                .where(eq(shipments.id, shipmentId));

            if (!shipment) {
                throw new Error(`Shipment with ID ${shipmentId} not found`);
            }

            let adminName = 'System';
            if (adminId) {
                const [admin] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, adminId));
                if (admin) {
                    adminName = admin.name || admin.email;
                }
            }

            // Notify admins about the tracking assignment completion
            const adminUsers = await notificationService.getAdminUsers();
            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.TRACKING_ASSIGNMENT_COMPLETED,
                    {
                        trackingNumber: trackingDetails.trackingNumber,
                        courier: trackingDetails.courier,
                        trackingCode: shipment.trackingCode,
                        customerName: shipment.customerName,
                        assignedBy: adminName,
                        shippingMethod: trackingDetails.shippingMethod,
                    },
                    {
                        actionUrl: `/admin/shipments/${shipmentId}`,
                        priority: 'normal',
                    }
                );
            }

            // If the shipment has an assigned user, notify them about tracking assignment
            if (shipment.assignedUserId) {
                await notificationSystem.createNotification(
                    shipment.assignedUserId,
                    NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED,
                    {
                        trackingCode: shipment.trackingCode,
                        oldStatus: 'pending',
                        newStatus: 'tracking assigned',
                        trackingNumber: trackingDetails.trackingNumber,
                        courier: trackingDetails.courier,
                    },
                    {
                        actionUrl: `/dashboard/shipments/${shipmentId}`,
                        priority: 'normal',
                    }
                );
            }

            console.log(`Sent tracking assignment notifications for shipment ${shipmentId}`);
        } catch (error) {
            console.error('Failed to send tracking assignment notifications:', error);
            throw error;
        }
    }

    /**
     * Notify when signup link is sent to a customer
     */
    async notifySignupLinkSent(
        shipmentId: string,
        customerEmail: string,
        signupLink: string,
        adminId?: string
    ): Promise<void> {
        try {
            // Get shipment details
            const [shipment] = await db
                .select()
                .from(shipments)
                .where(eq(shipments.id, shipmentId));

            if (!shipment) {
                throw new Error(`Shipment with ID ${shipmentId} not found`);
            }

            let adminName = 'System';
            if (adminId) {
                const [admin] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, adminId));
                if (admin) {
                    adminName = admin.name || admin.email;
                }
            }

            // Send signup invitation email to customer
            await this.sendSignupInvitationEmail(
                customerEmail,
                shipment.customerName,
                shipment.trackingCode,
                signupLink
            );

            // Notify admins about the signup link being sent
            const adminUsers = await notificationService.getAdminUsers();
            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.SIGNUP_LINK_SENT,
                    {
                        customerEmail,
                        trackingCode: shipment.trackingCode,
                        customerName: shipment.customerName,
                        sentBy: adminName,
                    },
                    {
                        actionUrl: `/admin/shipments/${shipmentId}`,
                        priority: 'normal',
                    }
                );
            }

            console.log(`Sent signup link notifications for shipment ${shipmentId}`);
        } catch (error) {
            console.error('Failed to send signup link notifications:', error);
            throw error;
        }
    }

    /**
     * Notify when a user completes signup from a shipment invitation
     */
    async notifySignupCompleted(
        shipmentId: string,
        newUserId: string,
        adminId?: string
    ): Promise<void> {
        try {
            // Get shipment and user details
            const [shipment] = await db
                .select()
                .from(shipments)
                .where(eq(shipments.id, shipmentId));

            if (!shipment) {
                throw new Error(`Shipment with ID ${shipmentId} not found`);
            }

            const [newUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, newUserId));

            if (!newUser) {
                throw new Error(`User with ID ${newUserId} not found`);
            }

            // Send welcome notification to the new user
            await notificationSystem.createNotification(
                newUserId,
                NOTIFICATION_TYPES.SHIPMENT_SIGNUP_WELCOME,
                {
                    userName: newUser.name || newUser.email,
                    trackingCode: shipment.trackingCode,
                    customerName: shipment.customerName,
                },
                {
                    actionUrl: `/dashboard/shipments/${shipmentId}`,
                    priority: 'high',
                }
            );

            // Notify admins about the signup completion
            const adminUsers = await notificationService.getAdminUsers();
            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.SHIPMENT_SIGNUP_COMPLETED,
                    {
                        userName: newUser.name || newUser.email,
                        userEmail: newUser.email,
                        trackingCode: shipment.trackingCode,
                        customerName: shipment.customerName,
                    },
                    {
                        actionUrl: `/admin/shipments/${shipmentId}`,
                        priority: 'normal',
                    }
                );
            }

            console.log(`Sent signup completion notifications for shipment ${shipmentId}`);
        } catch (error) {
            console.error('Failed to send signup completion notifications:', error);
            throw error;
        }
    }

    /**
     * Send reminder notifications for pending signup links
     */
    async sendSignupReminders(): Promise<{ remindersSent: number; errors: string[] }> {
        const result = {
            remindersSent: 0,
            errors: [] as string[],
        };

        try {
            // Find shipments with signup links sent more than 3 days ago
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

            const pendingSignups = await db
                .select()
                .from(shipments)
                .where(
                    and(
                        eq(shipments.userAssignmentStatus, 'signup_sent'),
                        isNull(shipments.assignedUserId)
                    )
                );

            for (const shipment of pendingSignups) {
                try {
                    if (shipment.signupLinkSentAt && shipment.signupLinkSentAt < threeDaysAgo) {
                        // Send reminder email to customer
                        await this.sendSignupReminderEmail(
                            shipment.customerEmail,
                            shipment.customerName,
                            shipment.trackingCode
                        );

                        // Notify admins about reminder needed
                        const adminUsers = await notificationService.getAdminUsers();
                        if (adminUsers.length > 0) {
                            const daysSent = Math.floor(
                                (Date.now() - shipment.signupLinkSentAt.getTime()) / (24 * 60 * 60 * 1000)
                            );

                            await notificationSystem.createNotificationsForUsers(
                                adminUsers,
                                NOTIFICATION_TYPES.SIGNUP_REMINDER_NEEDED,
                                {
                                    customerEmail: shipment.customerEmail,
                                    trackingCode: shipment.trackingCode,
                                    daysSent: daysSent.toString(),
                                },
                                {
                                    actionUrl: `/admin/shipments/${shipment.id}`,
                                    priority: 'normal',
                                }
                            );
                        }

                        result.remindersSent++;
                    }
                } catch (error: any) {
                    result.errors.push(`Shipment ${shipment.id}: ${error.message}`);
                }
            }

            console.log(`Sent ${result.remindersSent} signup reminders`);
        } catch (error: any) {
            result.errors.push(`Failed to process signup reminders: ${error.message}`);
        }

        return result;
    }

    /**
     * Send signup invitation email to customer
     */
    private async sendSignupInvitationEmail(
        customerEmail: string,
        customerName: string,
        trackingCode: string,
        signupLink: string
    ): Promise<void> {
        // This would integrate with your email service
        // For now, we'll create a notification that could be processed by an email worker
        console.log(`Sending signup invitation email to ${customerEmail} for shipment ${trackingCode}`);
        console.log(`Signup link: ${signupLink}`);

        // In a real implementation, you would:
        // 1. Use an email service like SendGrid, AWS SES, etc.
        // 2. Send a properly formatted HTML email with the signup link
        // 3. Include shipment context and benefits of creating an account

        // Example email content structure:
        const emailContent = {
            to: customerEmail,
            subject: `Track Your Shipment ${trackingCode} - Create Your Account`,
            html: `
                <h2>Your Shipment is Ready to Track!</h2>
                <p>Hello ${customerName},</p>
                <p>Your shipment ${trackingCode} is being processed. Create your account to:</p>
                <ul>
                    <li>Track your package in real-time</li>
                    <li>Receive delivery notifications</li>
                    <li>Set delivery preferences</li>
                    <li>View delivery history</li>
                </ul>
                <p><a href="${signupLink}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Create Account & Track Shipment</a></p>
                <p>If you prefer not to create an account, you can still track your shipment using code ${trackingCode} on our public tracking page.</p>
            `,
        };

        // TODO: Implement actual email sending
        // await emailService.send(emailContent);
    }

    /**
     * Send signup reminder email to customer
     */
    private async sendSignupReminderEmail(
        customerEmail: string,
        customerName: string,
        trackingCode: string
    ): Promise<void> {
        // This would integrate with your email service
        console.log(`Sending signup reminder email to ${customerEmail} for shipment ${trackingCode}`);

        // Example reminder email content:
        const emailContent = {
            to: customerEmail,
            subject: `Reminder: Complete Your Account Setup for Shipment ${trackingCode}`,
            html: `
                <h2>Don't Miss Your Delivery Updates!</h2>
                <p>Hello ${customerName},</p>
                <p>You have a shipment ${trackingCode} that's ready to track, but you haven't completed your account setup yet.</p>
                <p>Complete your account to receive:</p>
                <ul>
                    <li>Real-time delivery notifications</li>
                    <li>SMS and email alerts</li>
                    <li>Delivery preference settings</li>
                </ul>
                <p><a href="/auth/signup-from-shipment?token=${trackingCode}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Complete Account Setup</a></p>
                <p>You can also track without an account using code ${trackingCode} on our tracking page.</p>
            `,
        };

        // TODO: Implement actual email sending
        // await emailService.send(emailContent);
    }

    /**
     * Notify about bulk assignment operations
     */
    async notifyBulkAssignmentCompleted(
        operation: 'user_assignment' | 'tracking_assignment' | 'signup_links',
        results: {
            successful: number;
            failed: number;
            total: number;
            errors?: string[];
        },
        adminId?: string
    ): Promise<void> {
        try {
            let adminName = 'System';
            if (adminId) {
                const [admin] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, adminId));
                if (admin) {
                    adminName = admin.name || admin.email;
                }
            }

            const operationNames = {
                user_assignment: 'User Assignment',
                tracking_assignment: 'Tracking Assignment',
                signup_links: 'Signup Link Sending',
            };

            // Notify admins about bulk operation completion
            const adminUsers = await notificationService.getAdminUsers();
            if (adminUsers.length > 0) {
                await notificationSystem.createNotificationsForUsers(
                    adminUsers,
                    NOTIFICATION_TYPES.BULK_ACTION_COMPLETED,
                    {
                        action: operationNames[operation],
                        successCount: results.successful.toString(),
                        totalCount: results.total.toString(),
                        errorCount: results.failed.toString(),
                        hasErrors: results.failed > 0,
                        performedBy: adminName,
                    },
                    {
                        actionUrl: '/admin/shipments',
                        priority: results.failed > 0 ? 'high' : 'normal',
                    }
                );
            }

            console.log(`Sent bulk ${operation} completion notifications`);
        } catch (error) {
            console.error('Failed to send bulk assignment notifications:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const assignmentNotificationService = new AssignmentNotificationService();