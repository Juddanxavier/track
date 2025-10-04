/** @format */

import { notificationService } from './notificationService';
import type { CreateNotificationRequest } from '@/types/notification';
import { NOTIFICATION_TYPES } from '@/types/notification';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { number } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { number } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';
import { string } from 'zod';

/**
 * Event handlers for creating notifications based on system events
 */
export class NotificationEventHandlers {
    /**
     * Handle user registration event
     * Creates notifications for admin users when a new user registers
     */
    async handleUserRegistration(userData: {
        id: string;
        name: string;
        email: string;
        role: string;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about user registration');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.USER_REGISTERED,
                title: 'New User Registration',
                message: `A new user ${userData.name} (${userData.email}) has registered as ${userData.role}`,
                data: {
                    userId: userData.id,
                    userName: userData.name,
                    userEmail: userData.email,
                    userRole: userData.role,
                },
                actionUrl: `/admin/users/${userData.id}`,
                priority: 'normal',
            });

            console.log(`Created user registration notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle user registration notification:', error);
        }
    }

    /**
     * Handle lead conversion event
     * Creates notifications for admin users when a lead is converted
     */
    async handleLeadConversion(leadData: {
        id: string;
        customerName: string;
        customerEmail: string;
        customerId?: string | null;
        assignedTo?: string | null;
        convertedAt: Date;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about lead conversion');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.LEAD_CONVERTED,
                title: 'Lead Converted',
                message: `Lead for ${leadData.customerName} (${leadData.customerEmail}) has been converted to a customer`,
                data: {
                    leadId: leadData.id,
                    customerName: leadData.customerName,
                    customerEmail: leadData.customerEmail,
                    customerId: leadData.customerId,
                    assignedTo: leadData.assignedTo,
                    convertedAt: leadData.convertedAt,
                },
                actionUrl: `/admin/leads/${leadData.id}`,
                priority: 'high',
            });

            console.log(`Created lead conversion notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle lead conversion notification:', error);
        }
    }

    /**
     * Handle lead assignment event
     * Creates notifications for admin users when a lead is assigned
     */
    async handleLeadAssignment(leadData: {
        id: string;
        customerName: string;
        customerEmail: string;
        assignedTo: string;
        assignedBy: string;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about lead assignment');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
                title: 'Lead Assigned',
                message: `Lead for ${leadData.customerName} has been assigned to an admin`,
                data: {
                    leadId: leadData.id,
                    customerName: leadData.customerName,
                    customerEmail: leadData.customerEmail,
                    assignedTo: leadData.assignedTo,
                    assignedBy: leadData.assignedBy,
                },
                actionUrl: `/admin/leads/${leadData.id}`,
                priority: 'normal',
            });

            console.log(`Created lead assignment notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle lead assignment notification:', error);
        }
    }

    /**
     * Handle user ban event
     * Creates notifications for admin users when a user is banned
     */
    async handleUserBan(userData: {
        id: string;
        name: string;
        email: string;
        banReason?: string | null;
        bannedBy: string;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about user ban');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.USER_BANNED,
                title: 'User Banned',
                message: `User ${userData.name} (${userData.email}) has been banned${userData.banReason ? `: ${userData.banReason}` : ''}`,
                data: {
                    userId: userData.id,
                    userName: userData.name,
                    userEmail: userData.email,
                    banReason: userData.banReason,
                    bannedBy: userData.bannedBy,
                },
                actionUrl: `/admin/users/${userData.id}`,
                priority: 'high',
            });

            console.log(`Created user ban notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle user ban notification:', error);
        }
    }

    /**
     * Handle user unban event
     * Creates notifications for admin users when a user is unbanned
     */
    async handleUserUnban(userData: {
        id: string;
        name: string;
        email: string;
        unbannedBy: string;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about user unban');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.USER_UNBANNED,
                title: 'User Unbanned',
                message: `User ${userData.name} (${userData.email}) has been unbanned`,
                data: {
                    userId: userData.id,
                    userName: userData.name,
                    userEmail: userData.email,
                    unbannedBy: userData.unbannedBy,
                },
                actionUrl: `/admin/users/${userData.id}`,
                priority: 'normal',
            });

            console.log(`Created user unban notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle user unban notification:', error);
        }
    }

    /**
     * Handle system cleanup completion event
     * Creates notifications for admin users when cleanup operations complete
     */
    async handleSystemCleanupCompleted(cleanupData: {
        deletedCount: number;
        archivedCount: number;
        errors: string[];
        runAt: Date;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about system cleanup');
                return;
            }

            const hasErrors = cleanupData.errors.length > 0;
            const priority = hasErrors ? 'high' : 'normal';

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
                title: 'System Cleanup Completed',
                message: `Lead cleanup completed: ${cleanupData.deletedCount} deleted, ${cleanupData.archivedCount} archived${hasErrors ? ` with ${cleanupData.errors.length} errors` : ''}`,
                data: {
                    deletedCount: cleanupData.deletedCount,
                    archivedCount: cleanupData.archivedCount,
                    errors: cleanupData.errors,
                    runAt: cleanupData.runAt,
                },
                actionUrl: '/admin/system/cleanup',
                priority,
            });

            console.log(`Created system cleanup notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle system cleanup notification:', error);
        }
    }

    /**
     * Handle system error event
     * Creates urgent notifications for admin users when system errors occur
     */
    async handleSystemError(errorData: {
        message: string;
        stack?: string;
        context?: any;
        timestamp: Date;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about system error');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.SYSTEM_ERROR,
                title: 'System Error',
                message: `A system error occurred: ${errorData.message}`,
                data: {
                    error: errorData.message,
                    stack: errorData.stack,
                    context: errorData.context,
                    timestamp: errorData.timestamp,
                },
                actionUrl: '/admin/system/logs',
                priority: 'urgent',
            });

            console.log(`Created system error notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle system error notification:', error);
        }
    }

    /**
     * Handle bulk action completion event
     * Creates notifications for admin users when bulk operations complete
     */
    async handleBulkActionCompleted(actionData: {
        action: string;
        totalCount: number;
        successCount: number;
        errorCount: number;
        performedBy: string;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about bulk action');
                return;
            }

            const hasErrors = actionData.errorCount > 0;
            const priority = hasErrors ? 'high' : 'normal';

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.BULK_ACTION_COMPLETED,
                title: 'Bulk Action Completed',
                message: `Bulk ${actionData.action} completed: ${actionData.successCount}/${actionData.totalCount} successful${hasErrors ? `, ${actionData.errorCount} errors` : ''}`,
                data: {
                    action: actionData.action,
                    totalCount: actionData.totalCount,
                    successCount: actionData.successCount,
                    errorCount: actionData.errorCount,
                    performedBy: actionData.performedBy,
                },
                actionUrl: '/admin/users',
                priority,
            });

            console.log(`Created bulk action notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle bulk action notification:', error);
        }
    }

    /**
     * Handle account update event
     * Creates notifications for the user when their account is updated by an admin
     */
    async handleAccountUpdate(userData: {
        id: string;
        name: string;
        email: string;
        updatedBy: string;
        changes: string[];
    }): Promise<void> {
        try {
            // Create notification for the user
            await notificationService.createNotification({
                userId: userData.id,
                type: NOTIFICATION_TYPES.ACCOUNT_UPDATED,
                title: 'Account Updated',
                message: `Your account has been updated by an administrator. Changes: ${userData.changes.join(', ')}`,
                data: {
                    updatedBy: userData.updatedBy,
                    changes: userData.changes,
                },
                actionUrl: '/profile',
                priority: 'normal',
            });

            console.log(`Created account update notification for user ${userData.id}`);
        } catch (error) {
            console.error('Failed to handle account update notification:', error);
        }
    }

    /**
     * Handle account status change event
     * Creates notifications for the user when their account status changes
     */
    async handleAccountStatusChange(userData: {
        id: string;
        name: string;
        email: string;
        oldStatus: string;
        newStatus: string;
        changedBy: string;
    }): Promise<void> {
        try {
            // Create notification for the user
            await notificationService.createNotification({
                userId: userData.id,
                type: NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGED,
                title: 'Account Status Changed',
                message: `Your account status has been changed from ${userData.oldStatus} to ${userData.newStatus}`,
                data: {
                    oldStatus: userData.oldStatus,
                    newStatus: userData.newStatus,
                    changedBy: userData.changedBy,
                },
                actionUrl: '/profile',
                priority: 'high',
            });

            console.log(`Created account status change notification for user ${userData.id}`);
        } catch (error) {
            console.error('Failed to handle account status change notification:', error);
        }
    }

    /**
     * Handle lead status update event
     * Creates notifications for the customer when their lead status changes
     */
    async handleLeadStatusUpdate(leadData: {
        id: string;
        customerName: string;
        customerEmail: string;
        customerId?: string | null;
        oldStatus: string;
        newStatus: string;
        updatedBy: string;
    }): Promise<void> {
        try {
            // Only notify if there's a customer ID (lead is associated with a user)
            if (!leadData.customerId) {
                console.log('Lead has no associated customer ID, skipping notification');
                return;
            }

            // Create notification for the customer
            await notificationService.createNotification({
                userId: leadData.customerId,
                type: NOTIFICATION_TYPES.LEAD_STATUS_UPDATED,
                title: 'Lead Status Updated',
                message: `Your shipping inquiry status has been updated from ${leadData.oldStatus} to ${leadData.newStatus}`,
                data: {
                    leadId: leadData.id,
                    oldStatus: leadData.oldStatus,
                    newStatus: leadData.newStatus,
                    updatedBy: leadData.updatedBy,
                },
                actionUrl: `/leads/${leadData.id}`,
                priority: 'normal',
            });

            console.log(`Created lead status update notification for customer ${leadData.customerId}`);
        } catch (error) {
            console.error('Failed to handle lead status update notification:', error);
        }
    }

    /**
     * Handle system maintenance announcement
     * Creates notifications for all users about system maintenance
     */
    async handleSystemMaintenance(maintenanceData: {
        title: string;
        message: string;
        scheduledAt?: Date;
        duration?: string;
    }): Promise<void> {
        try {
            // Get all users (both admin and customer)
            const adminUserIds = await notificationService.getAdminUsers();
            const customerUserIds = await notificationService.getUsersByRole('customer');
            const allUserIds = [...adminUserIds, ...customerUserIds];

            if (allUserIds.length === 0) {
                console.log('No users found to notify about system maintenance');
                return;
            }

            // Create notification for all users
            await notificationService.createNotificationsForUsers({
                userIds: allUserIds,
                type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
                title: maintenanceData.title,
                message: maintenanceData.message,
                data: {
                    scheduledAt: maintenanceData.scheduledAt,
                    duration: maintenanceData.duration,
                },
                priority: 'high',
            });

            console.log(`Created system maintenance notifications for ${allUserIds.length} users`);
        } catch (error) {
            console.error('Failed to handle system maintenance notification:', error);
        }
    }

    /**
     * Handle welcome message for new users
     * Creates a welcome notification for newly registered users
     */
    async handleWelcomeMessage(userData: {
        id: string;
        name: string;
        email: string;
        role: string;
    }): Promise<void> {
        try {
            // Create welcome notification for the new user
            await notificationService.createNotification({
                userId: userData.id,
                type: NOTIFICATION_TYPES.WELCOME,
                title: 'Welcome to Our Platform!',
                message: `Welcome ${userData.name}! Thank you for joining our platform. We're excited to help you with your shipping needs.`,
                data: {
                    userName: userData.name,
                    userRole: userData.role,
                },
                actionUrl: '/dashboard',
                priority: 'normal',
            });

            console.log(`Created welcome notification for user ${userData.id}`);
        } catch (error) {
            console.error('Failed to handle welcome notification:', error);
        }
    }

    /**
     * Handle shipment creation event
     * Creates notifications for admin users when a new shipment is created
     */
    async handleShipmentCreated(shipmentData: {
        id: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        courier: string;
        status: string;
        createdBy?: string | null;
        leadId?: string | null;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about shipment creation');
                return;
            }

            const creationMethod = shipmentData.leadId ? 'converted from lead' : 'created directly';

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.SHIPMENT_CREATED,
                title: 'New Shipment Created',
                message: `Shipment ${shipmentData.trackingCode} for ${shipmentData.customerName} has been ${creationMethod} via ${shipmentData.courier}`,
                data: {
                    shipmentId: shipmentData.id,
                    trackingCode: shipmentData.trackingCode,
                    customerName: shipmentData.customerName,
                    customerEmail: shipmentData.customerEmail,
                    courier: shipmentData.courier,
                    status: shipmentData.status,
                    createdBy: shipmentData.createdBy,
                    leadId: shipmentData.leadId,
                    creationMethod,
                },
                actionUrl: `/admin/shipments/${shipmentData.id}`,
                priority: 'normal',
            });

            console.log(`Created shipment creation notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle shipment creation notification:', error);
        }
    }

    /**
     * Handle shipment status update event
     * Creates notifications for customers when their shipment status changes
     */
    async handleShipmentStatusUpdate(shipmentData: {
        id: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        customerId?: string | null;
        oldStatus: string;
        newStatus: string;
        courier: string;
        estimatedDelivery?: Date | null;
        location?: string | null;
        updatedBy?: string | null;
    }): Promise<void> {
        try {
            // Only notify if there's a customer ID (shipment is associated with a user)
            if (!shipmentData.customerId) {
                console.log('Shipment has no associated customer ID, skipping customer notification');
                return;
            }

            // Create notification for the customer
            await notificationService.createNotification({
                userId: shipmentData.customerId,
                type: NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED,
                title: 'Shipment Status Updated',
                message: `Your shipment ${shipmentData.trackingCode} status has been updated from ${shipmentData.oldStatus} to ${shipmentData.newStatus}`,
                data: {
                    shipmentId: shipmentData.id,
                    trackingCode: shipmentData.trackingCode,
                    oldStatus: shipmentData.oldStatus,
                    newStatus: shipmentData.newStatus,
                    courier: shipmentData.courier,
                    estimatedDelivery: shipmentData.estimatedDelivery,
                    location: shipmentData.location,
                    updatedBy: shipmentData.updatedBy,
                },
                actionUrl: `/tracking/${shipmentData.trackingCode}`,
                priority: 'normal',
            });

            console.log(`Created shipment status update notification for customer ${shipmentData.customerId}`);
        } catch (error) {
            console.error('Failed to handle shipment status update notification:', error);
        }
    }

    /**
     * Handle shipment delivery event
     * Creates notifications for customers when their shipment is delivered
     */
    async handleShipmentDelivered(shipmentData: {
        id: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        customerId?: string | null;
        courier: string;
        deliveryDate: Date;
        location?: string | null;
    }): Promise<void> {
        try {
            // Only notify if there's a customer ID (shipment is associated with a user)
            if (!shipmentData.customerId) {
                console.log('Shipment has no associated customer ID, skipping delivery notification');
                return;
            }

            // Create notification for the customer
            await notificationService.createNotification({
                userId: shipmentData.customerId,
                type: NOTIFICATION_TYPES.SHIPMENT_DELIVERED,
                title: 'Package Delivered!',
                message: `Your shipment ${shipmentData.trackingCode} has been successfully delivered${shipmentData.location ? ` at ${shipmentData.location}` : ''}`,
                data: {
                    shipmentId: shipmentData.id,
                    trackingCode: shipmentData.trackingCode,
                    courier: shipmentData.courier,
                    deliveryDate: shipmentData.deliveryDate,
                    location: shipmentData.location,
                },
                actionUrl: `/tracking/${shipmentData.trackingCode}`,
                priority: 'high',
            });

            console.log(`Created shipment delivery notification for customer ${shipmentData.customerId}`);
        } catch (error) {
            console.error('Failed to handle shipment delivery notification:', error);
        }
    }

    /**
     * Handle shipment out for delivery event
     * Creates notifications for customers when their shipment is out for delivery
     */
    async handleShipmentOutForDelivery(shipmentData: {
        id: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        customerId?: string | null;
        courier: string;
        estimatedDelivery?: Date | null;
        location?: string | null;
    }): Promise<void> {
        try {
            // Only notify if there's a customer ID (shipment is associated with a user)
            if (!shipmentData.customerId) {
                console.log('Shipment has no associated customer ID, skipping out for delivery notification');
                return;
            }

            // Create notification for the customer
            await notificationService.createNotification({
                userId: shipmentData.customerId,
                type: NOTIFICATION_TYPES.SHIPMENT_OUT_FOR_DELIVERY,
                title: 'Out for Delivery',
                message: `Your shipment ${shipmentData.trackingCode} is out for delivery${shipmentData.estimatedDelivery ? ` and expected today` : ''}`,
                data: {
                    shipmentId: shipmentData.id,
                    trackingCode: shipmentData.trackingCode,
                    courier: shipmentData.courier,
                    estimatedDelivery: shipmentData.estimatedDelivery,
                    location: shipmentData.location,
                },
                actionUrl: `/tracking/${shipmentData.trackingCode}`,
                priority: 'high',
            });

            console.log(`Created out for delivery notification for customer ${shipmentData.customerId}`);
        } catch (error) {
            console.error('Failed to handle out for delivery notification:', error);
        }
    }

    /**
     * Handle shipment assignment event
     * Creates notifications for customers when they are assigned to a shipment
     */
    async handleShipmentAssigned(shipmentData: {
        shipmentId: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        assignedUserId: string;
        assignedUserName: string;
        assignedUserEmail: string;
        assignedBy: string;
        courier: string;
        status: string;
    }): Promise<void> {
        try {
            // Create notification for the assigned user
            await notificationService.createNotification({
                userId: shipmentData.assignedUserId,
                type: NOTIFICATION_TYPES.SHIPMENT_ASSIGNED,
                title: 'Shipment Assigned to You',
                message: `You have been assigned to shipment ${shipmentData.trackingCode} for ${shipmentData.customerName}. You can now track this shipment and receive updates.`,
                data: {
                    shipmentId: shipmentData.shipmentId,
                    trackingCode: shipmentData.trackingCode,
                    customerName: shipmentData.customerName,
                    customerEmail: shipmentData.customerEmail,
                    assignedBy: shipmentData.assignedBy,
                    courier: shipmentData.courier,
                    status: shipmentData.status,
                },
                actionUrl: `/tracking/${shipmentData.trackingCode}`,
                priority: 'high',
            });

            console.log(`Created shipment assignment notification for user ${shipmentData.assignedUserId}`);
        } catch (error) {
            console.error('Failed to handle shipment assignment notification:', error);
        }
    }

    /**
     * Handle shipment signup invitation event
     * Sends signup invitation email to customer
     */
    async handleShipmentSignupInvitation(invitationData: {
        shipmentId: string;
        trackingCode: string;
        customerName: string;
        customerEmail: string;
        signupLink: string;
        signupToken: string;
        tokenExpiry: Date;
        customMessage?: string;
        sentBy: string;
        courier: string;
        estimatedDelivery?: Date | null;
    }): Promise<void> {
        try {
            // This would integrate with your email service
            // For now, we'll log the invitation details
            console.log(`Sending signup invitation email to ${invitationData.customerEmail}`);
            console.log(`Signup link: ${invitationData.signupLink}`);
            console.log(`Token expires: ${invitationData.tokenExpiry}`);

            // In a real implementation, you would:
            // 1. Use an email service like SendGrid, AWS SES, etc.
            // 2. Send a properly formatted HTML email with the signup link
            // 3. Include shipment context and benefits of creating an account

            console.log(`Sent signup invitation for shipment ${invitationData.trackingCode}`);
        } catch (error) {
            console.error('Failed to handle shipment signup invitation:', error);
            throw error;
        }
    }

    /**
     * Handle shipment signup completion event
     * Creates notifications for admins when a customer completes signup from shipment invitation
     */
    async handleShipmentSignupCompleted(completionData: {
        shipmentId: string;
        trackingCode: string;
        customerName: string;
        newUserId: string;
        newUserName: string;
        newUserEmail: string;
        completedAt: Date;
    }): Promise<void> {
        try {
            // Get all admin users
            const adminUserIds = await notificationService.getAdminUsers();

            if (adminUserIds.length === 0) {
                console.log('No admin users found to notify about signup completion');
                return;
            }

            // Create notification for all admin users
            await notificationService.createNotificationsForUsers({
                userIds: adminUserIds,
                type: NOTIFICATION_TYPES.SHIPMENT_SIGNUP_COMPLETED,
                title: 'Customer Signup Completed',
                message: `${completionData.newUserName} (${completionData.newUserEmail}) completed signup and was assigned to shipment ${completionData.trackingCode}`,
                data: {
                    shipmentId: completionData.shipmentId,
                    trackingCode: completionData.trackingCode,
                    customerName: completionData.customerName,
                    newUserId: completionData.newUserId,
                    newUserName: completionData.newUserName,
                    newUserEmail: completionData.newUserEmail,
                    completedAt: completionData.completedAt,
                },
                actionUrl: `/admin/shipments/${completionData.shipmentId}`,
                priority: 'normal',
            });

            console.log(`Created signup completion notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
            console.error('Failed to handle signup completion notification:', error);
        }
    }ustomerEmail,
    courier: shipmentData.courier,
    status: shipmentData.status,
    assignedBy: shipmentData.assignedBy,
},
actionUrl: `/tracking/${shipmentData.trackingCode}`,
    priority: 'normal',
            });

console.log(`Created shipment assignment notification for user ${shipmentData.assignedUserId}`);
        } catch (error) {
    console.error('Failed to handle shipment assignment notification:', error);
}
    }

    /**
     * Handle shipment signup invitation event
     * Sends signup invitation emails to customers for shipment access
     */
    async handleShipmentSignupInvitation(invitationData: {
    shipmentId: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
    signupLink: string;
    signupToken: string;
    tokenExpiry: Date;
    customMessage?: string;
    sentBy: string;
    courier: string;
    estimatedDelivery?: Date | null;
}): Promise < void> {
    try {
        // For signup invitations, we don't have a user ID yet, so we'll send an email directly
        // This would typically integrate with an email service like SendGrid, Mailgun, etc.

        // For now, we'll log the invitation details
        console.log('Sending signup invitation email:', {
            to: invitationData.customerEmail,
            subject: `Create Your Account to Track Shipment ${invitationData.trackingCode}`,
            signupLink: invitationData.signupLink,
            trackingCode: invitationData.trackingCode,
            customerName: invitationData.customerName,
            courier: invitationData.courier,
            estimatedDelivery: invitationData.estimatedDelivery,
            customMessage: invitationData.customMessage,
            tokenExpiry: invitationData.tokenExpiry,
        });

        // TODO: Integrate with actual email service
        // Example:
        // await emailService.sendSignupInvitation({
        //     to: invitationData.customerEmail,
        //     templateData: {
        //         customerName: invitationData.customerName,
        //         trackingCode: invitationData.trackingCode,
        //         signupLink: invitationData.signupLink,
        //         courier: invitationData.courier,
        //         estimatedDelivery: invitationData.estimatedDelivery,
        //         customMessage: invitationData.customMessage,
        //         tokenExpiry: invitationData.tokenExpiry,
        //     }
        // });

        console.log(`Signup invitation email sent to ${invitationData.customerEmail} for shipment ${invitationData.trackingCode}`);
    } catch(error) {
        console.error('Failed to send shipment signup invitation:', error);
        throw error; // Re-throw to allow caller to handle the failure
    }
}

    /**
     * Handle shipment in transit event
     * Creates notifications for customers when their shipment is in transit
     */
    async handleShipmentInTransit(shipmentData: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
    customerId?: string | null;
    courier: string;
    estimatedDelivery?: Date | null;
    location?: string | null;
}): Promise < void> {
    try {
        // Only notify if there's a customer ID (shipment is associated with a user)
        if(!shipmentData.customerId) {
    console.log('Shipment has no associated customer ID, skipping in transit notification');
    return;
}

// Create notification for the customer
await notificationService.createNotification({
    userId: shipmentData.customerId,
    type: NOTIFICATION_TYPES.SHIPMENT_IN_TRANSIT,
    title: 'Shipment In Transit',
    message: `Your shipment ${shipmentData.trackingCode} is now in transit${shipmentData.location ? ` from ${shipmentData.location}` : ''}`,
    data: {
        shipmentId: shipmentData.id,
        trackingCode: shipmentData.trackingCode,
        courier: shipmentData.courier,
        estimatedDelivery: shipmentData.estimatedDelivery,
        location: shipmentData.location,
    },
    actionUrl: `/tracking/${shipmentData.trackingCode}`,
    priority: 'normal',
});

console.log(`Created in transit notification for customer ${shipmentData.customerId}`);
        } catch (error) {
    console.error('Failed to handle in transit notification:', error);
}
    }

    /**
     * Handle shipment exception event
     * Creates notifications for admin users when a shipment has an exception
     */
    async handleShipmentException(shipmentData: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
    courier: string;
    exceptionReason: string;
    location?: string | null;
    eventTime: Date;
}): Promise < void> {
    try {
        // Get all admin users
        const adminUserIds = await notificationService.getAdminUsers();

        if(adminUserIds.length === 0) {
    console.log('No admin users found to notify about shipment exception');
    return;
}

// Create notification for all admin users
await notificationService.createNotificationsForUsers({
    userIds: adminUserIds,
    type: NOTIFICATION_TYPES.SHIPMENT_EXCEPTION,
    title: 'Shipment Exception',
    message: `Shipment ${shipmentData.trackingCode} for ${shipmentData.customerName} has an exception: ${shipmentData.exceptionReason}`,
    data: {
        shipmentId: shipmentData.id,
        trackingCode: shipmentData.trackingCode,
        customerName: shipmentData.customerName,
        customerEmail: shipmentData.customerEmail,
        courier: shipmentData.courier,
        exceptionReason: shipmentData.exceptionReason,
        location: shipmentData.location,
        eventTime: shipmentData.eventTime,
    },
    actionUrl: `/admin/shipments/${shipmentData.id}`,
    priority: 'high',
});

console.log(`Created shipment exception notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
    console.error('Failed to handle shipment exception notification:', error);
}
    }

    /**
     * Handle shipment delayed event
     * Creates notifications for admin users when a shipment is delayed
     */
    async handleShipmentDelayed(shipmentData: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
    courier: string;
    delayReason: string;
    originalDelivery?: Date | null;
    newEstimatedDelivery?: Date | null;
    location?: string | null;
}): Promise < void> {
    try {
        // Get all admin users
        const adminUserIds = await notificationService.getAdminUsers();

        if(adminUserIds.length === 0) {
    console.log('No admin users found to notify about shipment delay');
    return;
}

const delayMessage = shipmentData.newEstimatedDelivery
    ? `New estimated delivery: ${shipmentData.newEstimatedDelivery.toLocaleDateString()}`
    : 'No new delivery estimate available';

// Create notification for all admin users
await notificationService.createNotificationsForUsers({
    userIds: adminUserIds,
    type: NOTIFICATION_TYPES.SHIPMENT_DELAYED,
    title: 'Shipment Delayed',
    message: `Shipment ${shipmentData.trackingCode} for ${shipmentData.customerName} is delayed: ${shipmentData.delayReason}. ${delayMessage}`,
    data: {
        shipmentId: shipmentData.id,
        trackingCode: shipmentData.trackingCode,
        customerName: shipmentData.customerName,
        customerEmail: shipmentData.customerEmail,
        courier: shipmentData.courier,
        delayReason: shipmentData.delayReason,
        originalDelivery: shipmentData.originalDelivery,
        newEstimatedDelivery: shipmentData.newEstimatedDelivery,
        location: shipmentData.location,
    },
    actionUrl: `/admin/shipments/${shipmentData.id}`,
    priority: 'high',
});

console.log(`Created shipment delay notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
    console.error('Failed to handle shipment delay notification:', error);
}
    }

    /**
     * Handle shipment delivery failed event
     * Creates notifications for admin users when a delivery attempt fails
     */
    async handleShipmentDeliveryFailed(shipmentData: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
    courier: string;
    failureReason: string;
    attemptNumber: number;
    nextAttemptDate?: Date | null;
    location?: string | null;
}): Promise < void> {
    try {
        // Get all admin users
        const adminUserIds = await notificationService.getAdminUsers();

        if(adminUserIds.length === 0) {
    console.log('No admin users found to notify about delivery failure');
    return;
}

const nextAttemptMessage = shipmentData.nextAttemptDate
    ? `Next attempt scheduled for ${shipmentData.nextAttemptDate.toLocaleDateString()}`
    : 'No next attempt scheduled';

// Create notification for all admin users
await notificationService.createNotificationsForUsers({
    userIds: adminUserIds,
    type: NOTIFICATION_TYPES.SHIPMENT_DELIVERY_FAILED,
    title: 'Delivery Attempt Failed',
    message: `Delivery attempt ${shipmentData.attemptNumber} failed for shipment ${shipmentData.trackingCode} (${shipmentData.customerName}): ${shipmentData.failureReason}. ${nextAttemptMessage}`,
    data: {
        shipmentId: shipmentData.id,
        trackingCode: shipmentData.trackingCode,
        customerName: shipmentData.customerName,
        customerEmail: shipmentData.customerEmail,
        courier: shipmentData.courier,
        failureReason: shipmentData.failureReason,
        attemptNumber: shipmentData.attemptNumber,
        nextAttemptDate: shipmentData.nextAttemptDate,
        location: shipmentData.location,
    },
    actionUrl: `/admin/shipments/${shipmentData.id}`,
    priority: 'high',
});

console.log(`Created delivery failure notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
    console.error('Failed to handle delivery failure notification:', error);
}
    }

    /**
     * Handle shipment signup completion event
     * Creates notifications for admin users when a customer completes signup from shipment invitation
     */
    async handleShipmentSignupCompleted(signupData: {
    shipmentId: string;
    trackingCode: string;
    customerName: string;
    newUserId: string;
    newUserName: string;
    newUserEmail: string;
    completedAt: Date;
}): Promise < void> {
    try {
        // Get all admin users
        const adminUserIds = await notificationService.getAdminUsers();

        if(adminUserIds.length === 0) {
    console.log('No admin users found to notify about signup completion');
    return;
}

// Create notification for all admin users
await notificationService.createNotificationsForUsers({
    userIds: adminUserIds,
    type: NOTIFICATION_TYPES.SHIPMENT_SIGNUP_COMPLETED,
    title: 'Customer Signup Completed',
    message: `${signupData.newUserName} (${signupData.newUserEmail}) completed signup and was assigned to shipment ${signupData.trackingCode}`,
    data: {
        shipmentId: signupData.shipmentId,
        trackingCode: signupData.trackingCode,
        customerName: signupData.customerName,
        newUserId: signupData.newUserId,
        newUserName: signupData.newUserName,
        newUserEmail: signupData.newUserEmail,
        completedAt: signupData.completedAt,
    },
    actionUrl: `/admin/shipments/${signupData.shipmentId}`,
    priority: 'normal',
});

console.log(`Created signup completion notifications for ${adminUserIds.length} admin users`);
        } catch (error) {
    console.error('Failed to handle shipment signup completion notification:', error);
}
    }
}

// Export singleton instance
export const notificationEventHandlers = new NotificationEventHandlers();