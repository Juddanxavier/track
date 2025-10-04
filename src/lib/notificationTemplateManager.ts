/** @format */

import { notificationService } from './notificationService';
import { NOTIFICATION_TYPES } from '@/types/notification';
import type { NotificationTemplate } from '@/types/notification';

/**
 * Template manager for notification templates
 * Handles template rendering with dynamic data injection and role-based filtering
 */
export class NotificationTemplateManager {
    /**
     * Initialize default notification templates
     */
    async initializeDefaultTemplates(): Promise<void> {
        const defaultTemplates = this.getDefaultTemplates();

        for (const template of defaultTemplates) {
            try {
                await notificationService.upsertTemplate(template);
                console.log(`Initialized template for type: ${template.type}`);
            } catch (error) {
                console.error(`Failed to initialize template for type ${template.type}:`, error);
            }
        }

        console.log(`Initialized ${defaultTemplates.length} notification templates`);
    }

    /**
     * Get default notification templates
     */
    private getDefaultTemplates(): Array<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>> {
        return [
            // Admin notification templates
            {
                type: NOTIFICATION_TYPES.USER_REGISTERED,
                title: 'New User Registration',
                message: 'A new user {{userName}} ({{userEmail}}) has registered as {{userRole}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.LEAD_CONVERTED,
                title: 'Lead Converted',
                message: 'Lead for {{customerName}} ({{customerEmail}}) has been converted to a customer',
                defaultPriority: 'high',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
                title: 'Lead Assigned',
                message: 'Lead for {{customerName}} has been assigned to an admin',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.USER_BANNED,
                title: 'User Banned',
                message: 'User {{userName}} ({{userEmail}}) has been banned{{#banReason}}: {{banReason}}{{/banReason}}',
                defaultPriority: 'high',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.USER_UNBANNED,
                title: 'User Unbanned',
                message: 'User {{userName}} ({{userEmail}}) has been unbanned',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
                title: 'System Cleanup Completed',
                message: 'Lead cleanup completed: {{deletedCount}} deleted, {{archivedCount}} archived{{#hasErrors}} with {{errorCount}} errors{{/hasErrors}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SYSTEM_ERROR,
                title: 'System Error',
                message: 'A system error occurred: {{error}}',
                defaultPriority: 'urgent',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.BULK_ACTION_COMPLETED,
                title: 'Bulk Action Completed',
                message: 'Bulk {{action}} completed: {{successCount}}/{{totalCount}} successful{{#hasErrors}}, {{errorCount}} errors{{/hasErrors}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },

            // Customer notification templates
            {
                type: NOTIFICATION_TYPES.ACCOUNT_UPDATED,
                title: 'Account Updated',
                message: 'Your account has been updated by an administrator. Changes: {{changes}}',
                defaultPriority: 'normal',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGED,
                title: 'Account Status Changed',
                message: 'Your account status has been changed from {{oldStatus}} to {{newStatus}}',
                defaultPriority: 'high',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.LEAD_STATUS_UPDATED,
                title: 'Lead Status Updated',
                message: 'Your shipping inquiry status has been updated from {{oldStatus}} to {{newStatus}}',
                defaultPriority: 'normal',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.WELCOME,
                title: 'Welcome to Our Platform!',
                message: 'Welcome {{userName}}! Thank you for joining our platform. We\'re excited to help you with your shipping needs.',
                defaultPriority: 'normal',
                roles: ['customer'],
            },

            // Shipment notification templates (Admin)
            {
                type: NOTIFICATION_TYPES.SHIPMENT_CREATED,
                title: 'New Shipment Created',
                message: 'Shipment {{trackingCode}} for {{customerName}} has been {{creationMethod}} via {{courier}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_EXCEPTION,
                title: 'Shipment Exception',
                message: 'Shipment {{trackingCode}} for {{customerName}} has an exception: {{exceptionReason}}{{#location}} at {{location}}{{/location}}',
                defaultPriority: 'high',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_DELAYED,
                title: 'Shipment Delayed',
                message: 'Shipment {{trackingCode}} for {{customerName}} is delayed: {{delayReason}}{{#newEstimatedDelivery}}. New estimated delivery: {{newEstimatedDelivery}}{{/newEstimatedDelivery}}',
                defaultPriority: 'high',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_DELIVERY_FAILED,
                title: 'Delivery Attempt Failed',
                message: 'Delivery attempt {{attemptNumber}} failed for shipment {{trackingCode}} ({{customerName}}): {{failureReason}}{{#nextAttemptDate}}. Next attempt: {{nextAttemptDate}}{{/nextAttemptDate}}',
                defaultPriority: 'high',
                roles: ['admin'],
            },

            // Shipment notification templates (Customer)
            {
                type: NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED,
                title: 'Shipment Status Updated',
                message: 'Your shipment {{trackingCode}} status has been updated from {{oldStatus}} to {{newStatus}}{{#location}} at {{location}}{{/location}}',
                defaultPriority: 'normal',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_DELIVERED,
                title: 'Package Delivered!',
                message: 'Your shipment {{trackingCode}} has been successfully delivered{{#location}} at {{location}}{{/location}}',
                defaultPriority: 'high',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_OUT_FOR_DELIVERY,
                title: 'Out for Delivery',
                message: 'Your shipment {{trackingCode}} is out for delivery{{#estimatedDelivery}} and expected today{{/estimatedDelivery}}',
                defaultPriority: 'high',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_IN_TRANSIT,
                title: 'Shipment In Transit',
                message: 'Your shipment {{trackingCode}} is now in transit{{#location}} from {{location}}{{/location}}',
                defaultPriority: 'normal',
                roles: ['customer'],
            },

            // Assignment notification templates (Admin)
            {
                type: NOTIFICATION_TYPES.USER_ASSIGNMENT_COMPLETED,
                title: 'User Assignment Completed',
                message: 'User {{userName}} ({{userEmail}}) has been assigned to shipment {{trackingCode}} for {{customerName}}{{#assignedBy}} by {{assignedBy}}{{/assignedBy}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.TRACKING_ASSIGNMENT_COMPLETED,
                title: 'Tracking Assignment Completed',
                message: 'Tracking number {{trackingNumber}} ({{courier}}) has been assigned to shipment {{trackingCode}} for {{customerName}}{{#assignedBy}} by {{assignedBy}}{{/assignedBy}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SIGNUP_LINK_SENT,
                title: 'Signup Link Sent',
                message: 'Signup invitation sent to {{customerEmail}} for shipment {{trackingCode}} ({{customerName}}){{#sentBy}} by {{sentBy}}{{/sentBy}}',
                defaultPriority: 'normal',
                roles: ['admin'],
            },
            {
                type: NOTIFICATION_TYPES.SIGNUP_REMINDER_NEEDED,
                title: 'Signup Reminder Needed',
                message: 'Signup link for {{customerEmail}} (shipment {{trackingCode}}) was sent {{daysSent}} days ago and may need a reminder',
                defaultPriority: 'normal',
                roles: ['admin'],
            },

            // Assignment notification templates (Customer)
            {
                type: NOTIFICATION_TYPES.SHIPMENT_USER_ASSIGNED,
                title: 'Shipment Assigned to You',
                message: 'You have been assigned to track shipment {{trackingCode}} for {{customerName}}. You can now receive notifications and manage delivery preferences.',
                defaultPriority: 'high',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_SIGNUP_WELCOME,
                title: 'Welcome! Your Shipment is Ready to Track',
                message: 'Welcome {{userName}}! Your account has been created and you can now track your shipment {{trackingCode}}. Set up your delivery preferences to stay updated.',
                defaultPriority: 'high',
                roles: ['customer'],
            },
            {
                type: NOTIFICATION_TYPES.SHIPMENT_SIGNUP_REMINDER,
                title: 'Complete Your Account Setup',
                message: 'You have a pending shipment {{trackingCode}} waiting for you. Complete your account setup to track your package and receive delivery updates.',
                defaultPriority: 'normal',
                roles: ['customer'],
            },

            // Universal notification templates
            {
                type: NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
                title: 'System Maintenance Scheduled',
                message: 'System maintenance is scheduled{{#scheduledAt}} for {{scheduledAt}}{{/scheduledAt}}{{#duration}} (Duration: {{duration}}){{/duration}}',
                defaultPriority: 'high',
                roles: ['admin', 'customer'],
            },
        ];
    }

    /**
     * Render a notification template with dynamic data
     */
    renderTemplate(template: string, data: Record<string, any>): string {
        let rendered = template;

        // Simple template rendering - replace {{variable}} with data values
        rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });

        // Handle conditional blocks {{#condition}}...{{/condition}}
        rendered = rendered.replace(/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/g, (_, condition, content) => {
            const value = data[condition];
            // Show content if condition is truthy
            if (value && value !== false && value !== 0 && value !== '') {
                return content;
            }
            return '';
        });

        // Handle inverted conditional blocks {{^condition}}...{{/condition}}
        rendered = rendered.replace(/\{\{\^(\w+)\}\}(.*?)\{\{\/\1\}\}/g, (_, condition, content) => {
            const value = data[condition];
            // Show content if condition is falsy
            if (!value || value === false || value === 0 || value === '') {
                return content;
            }
            return '';
        });

        return rendered;
    }

    /**
     * Get rendered notification content from template
     */
    async getRenderedNotification(
        type: string,
        data: Record<string, any>
    ): Promise<{ title: string; message: string; priority: string } | null> {
        try {
            const template = await notificationService.getTemplate(type);

            if (!template) {
                console.warn(`No template found for notification type: ${type}`);
                return null;
            }

            const renderedTitle = this.renderTemplate(template.title, data);
            const renderedMessage = this.renderTemplate(template.message, data);

            return {
                title: renderedTitle,
                message: renderedMessage,
                priority: template.defaultPriority,
            };
        } catch (error) {
            console.error(`Failed to render template for type ${type}:`, error);
            return null;
        }
    }

    /**
     * Check if a notification type is allowed for a specific role
     */
    async isNotificationAllowedForRole(type: string, userRole: string): Promise<boolean> {
        try {
            const template = await notificationService.getTemplate(type);

            if (!template || !template.roles) {
                // If no template or no role restrictions, allow all
                return true;
            }

            return template.roles.includes(userRole);
        } catch (error) {
            console.error(`Failed to check role permission for type ${type}:`, error);
            // Default to allowing if there's an error
            return true;
        }
    }

    /**
     * Get notification types allowed for a specific role
     */
    async getNotificationTypesForRole(userRole: string): Promise<string[]> {
        try {
            const allowedTypes: string[] = [];

            // Check each notification type
            for (const type of Object.values(NOTIFICATION_TYPES)) {
                const isAllowed = await this.isNotificationAllowedForRole(type, userRole);
                if (isAllowed) {
                    allowedTypes.push(type);
                }
            }

            return allowedTypes;
        } catch (error) {
            console.error(`Failed to get notification types for role ${userRole}:`, error);
            return [];
        }
    }

    /**
     * Create a notification using template rendering
     */
    async createNotificationFromTemplate(
        userId: string,
        type: string,
        data: Record<string, any>,
        options: {
            actionUrl?: string;
            expiresAt?: Date;
            priority?: 'low' | 'normal' | 'high' | 'urgent';
        } = {}
    ): Promise<void> {
        try {
            const rendered = await this.getRenderedNotification(type, data);

            if (!rendered) {
                throw new Error(`Failed to render template for type: ${type}`);
            }

            await notificationService.createNotification({
                userId,
                type,
                title: rendered.title,
                message: rendered.message,
                data,
                actionUrl: options.actionUrl,
                expiresAt: options.expiresAt,
                priority: options.priority || rendered.priority as any,
            });

            console.log(`Created notification from template for user ${userId}, type ${type}`);
        } catch (error) {
            console.error(`Failed to create notification from template:`, error);
            throw error;
        }
    }

    /**
     * Create notifications for multiple users using template rendering
     */
    async createNotificationsFromTemplate(
        userIds: string[],
        type: string,
        data: Record<string, any>,
        options: {
            actionUrl?: string;
            expiresAt?: Date;
            priority?: 'low' | 'normal' | 'high' | 'urgent';
        } = {}
    ): Promise<void> {
        try {
            const rendered = await this.getRenderedNotification(type, data);

            if (!rendered) {
                throw new Error(`Failed to render template for type: ${type}`);
            }

            await notificationService.createNotificationsForUsers({
                userIds,
                type,
                title: rendered.title,
                message: rendered.message,
                data,
                actionUrl: options.actionUrl,
                expiresAt: options.expiresAt,
                priority: options.priority || rendered.priority as any,
            });

            console.log(`Created notifications from template for ${userIds.length} users, type ${type}`);
        } catch (error) {
            console.error(`Failed to create notifications from template:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const notificationTemplateManager = new NotificationTemplateManager();