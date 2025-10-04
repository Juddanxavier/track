/** @format */

import { notificationService } from './notificationService';
import { notificationEventHandlers } from './notificationEventHandlers';
import { notificationTemplateManager } from './notificationTemplateManager';

/**
 * Unified notification system that combines all notification functionality
 * This is the main entry point for the notification system
 */
export class NotificationSystem {
    /**
     * Initialize the notification system
     * Sets up default templates and preferences
     */
    async initialize(): Promise<void> {
        try {
            console.log('Initializing notification system...');

            // Initialize default templates
            await notificationTemplateManager.initializeDefaultTemplates();

            console.log('Notification system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize notification system:', error);
            throw error;
        }
    }

    /**
     * Get the notification service instance
     */
    get service() {
        return notificationService;
    }

    /**
     * Get the event handlers instance
     */
    get eventHandlers() {
        return notificationEventHandlers;
    }

    /**
     * Get the template manager instance
     */
    get templateManager() {
        return notificationTemplateManager;
    }

    /**
     * Create a notification with automatic template rendering
     */
    async createNotification(
        userId: string,
        type: string,
        data: Record<string, any> = {},
        options: {
            actionUrl?: string;
            expiresAt?: Date;
            priority?: 'low' | 'normal' | 'high' | 'urgent';
            useTemplate?: boolean;
        } = {}
    ) {
        const { useTemplate = true, ...notificationOptions } = options;

        if (useTemplate) {
            return notificationTemplateManager.createNotificationFromTemplate(
                userId,
                type,
                data,
                notificationOptions
            );
        } else {
            // Direct creation without template
            return notificationService.createNotification({
                userId,
                type,
                data,
                ...notificationOptions,
            });
        }
    }

    /**
     * Create notifications for multiple users with automatic template rendering
     */
    async createNotificationsForUsers(
        userIds: string[],
        type: string,
        data: Record<string, any> = {},
        options: {
            actionUrl?: string;
            expiresAt?: Date;
            priority?: 'low' | 'normal' | 'high' | 'urgent';
            useTemplate?: boolean;
        } = {}
    ) {
        const { useTemplate = true, ...notificationOptions } = options;

        if (useTemplate) {
            return notificationTemplateManager.createNotificationsFromTemplate(
                userIds,
                type,
                data,
                notificationOptions
            );
        } else {
            // Direct creation without template
            return notificationService.createNotificationsForUsers({
                userIds,
                type,
                data,
                ...notificationOptions,
            });
        }
    }

    /**
     * Setup default preferences for a new user
     */
    async setupUserDefaults(userId: string, userRole: string): Promise<void> {
        try {
            // Create default preferences
            await notificationService.createDefaultPreferences(userId, userRole);

            // Send welcome notification for customers
            if (userRole === 'customer') {
                // We'll get user data from the database or pass it in
                // For now, we'll create a basic welcome notification
                await this.createNotification(
                    userId,
                    'welcome',
                    { userName: 'User' }, // This should be passed from the calling code
                    { actionUrl: '/dashboard' }
                );
            }

            console.log(`Setup notification defaults for user ${userId} with role ${userRole}`);
        } catch (error) {
            console.error(`Failed to setup notification defaults for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Clean up expired notifications
     */
    async cleanupExpiredNotifications(): Promise<{ deletedCount: number }> {
        return notificationService.cleanupExpiredNotifications();
    }

    /**
     * Get notification statistics
     */
    async getNotificationStats(): Promise<{
        totalNotifications: number;
        unreadNotifications: number;
        notificationsByType: Record<string, number>;
    }> {
        // This would require additional queries to the database
        // For now, return a placeholder
        return {
            totalNotifications: 0,
            unreadNotifications: 0,
            notificationsByType: {},
        };
    }
}

// Export singleton instance
export const notificationSystem = new NotificationSystem();

// Export individual components for direct access if needed
export {
    notificationService,
    notificationEventHandlers,
    notificationTemplateManager,
};