/** @format */

import { db } from '@/database/db';
import { notifications, notificationPreferences, notificationTemplates, users } from '@/database/schema';
import { and, eq, desc, count, isNull, or, inArray, gt, lt, not } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
    Notification,
    NotificationPreference,
    NotificationTemplate,
    CreateNotificationRequest,
    NotificationListResponse,
    NotificationType,
    NotificationPriority,
} from '@/types/notification';
import {
    NOTIFICATION_TYPES,
    ADMIN_NOTIFICATION_TYPES,
    CUSTOMER_NOTIFICATION_TYPES,
    ALL_USER_NOTIFICATION_TYPES,
} from '@/types/notification';


export class NotificationService {
    /**
     * Create a new notification
     */
    async createNotification(request: CreateNotificationRequest): Promise<Notification> {
        const id = nanoid();

        // If userIds array is provided, create notifications for multiple users
        if (request.userIds && request.userIds.length > 0) {
            // For multiple users, we'll create the first one and return it
            // The caller should handle multiple notifications if needed
            const userId = request.userIds[0];
            return this.createSingleNotification({ ...request, userId, userIds: undefined });
        }

        if (!request.userId) {
            throw new Error('Either userId or userIds must be provided');
        }

        return this.createSingleNotification({ ...request, userId: request.userId });
    }

    /**
     * Create notifications for multiple users
     */
    async createNotificationsForUsers(request: CreateNotificationRequest): Promise<Notification[]> {
        if (!request.userIds || request.userIds.length === 0) {
            if (request.userId) {
                const notification = await this.createSingleNotification({ ...request, userId: request.userId });
                return [notification];
            }
            throw new Error('Either userId or userIds must be provided');
        }

        const notifications: Notification[] = [];

        for (const userId of request.userIds) {
            try {
                const notification = await this.createSingleNotification({
                    ...request,
                    userId,
                    userIds: undefined,
                });
                notifications.push(notification);
            } catch (error) {
                console.error(`Failed to create notification for user ${userId}:`, error);
                // Continue with other users even if one fails
            }
        }

        return notifications;
    }

    /**
     * Create a single notification for a user
     */
    private async createSingleNotification(request: CreateNotificationRequest & { userId: string }): Promise<Notification> {
        const id = nanoid();

        // Get template if title/message not provided
        let title = request.title;
        let message = request.message;
        let priority = request.priority || 'normal';

        if (!title || !message) {
            const template = await this.getTemplate(request.type);
            if (template) {
                title = title || template.title;
                message = message || template.message;
                priority = request.priority || template.defaultPriority;
            }
        }

        if (!title || !message) {
            throw new Error(`Title and message are required for notification type: ${request.type}`);
        }

        // Check user preferences
        const userPreference = await this.getUserPreference(request.userId, request.type);
        if (userPreference && !userPreference.enabled) {
            // User has disabled this notification type, skip creation
            throw new Error(`User has disabled notifications of type: ${request.type}`);
        }

        const notificationData = {
            id,
            userId: request.userId,
            type: request.type,
            title,
            message,
            data: request.data ? JSON.stringify(request.data) : null,
            read: false,
            readAt: null,
            actionUrl: request.actionUrl || null,
            priority,
            expiresAt: request.expiresAt || null,
            createdAt: new Date(),
        };

        await db.insert(notifications).values(notificationData);

        const notification = {
            ...notificationData,
            data: request.data,
        };

        // Note: Real-time updates now handled by polling system



        return notification;
    }

    /**
     * Get notifications for a user with pagination
     */
    async getUserNotifications(
        userId: string,
        options: {
            page?: number;
            perPage?: number;
            unreadOnly?: boolean;
            type?: string;
        } = {}
    ): Promise<NotificationListResponse> {
        const { page = 1, perPage = 20, unreadOnly = false, type } = options;
        const offset = (page - 1) * perPage;

        // Build where conditions - start with userId and expiration check
        let whereClause = and(
            eq(notifications.userId, userId),
            or(
                isNull(notifications.expiresAt),
                gt(notifications.expiresAt, new Date()) // Greater than current time
            )
        );

        if (unreadOnly) {
            whereClause = and(whereClause, eq(notifications.read, false));
        }

        if (type) {
            whereClause = and(whereClause, eq(notifications.type, type));
        }

        // Get total count
        const totalQuery = db
            .select({ total: count() })
            .from(notifications);

        const [{ total }] = await totalQuery.where(whereClause);

        // Get notifications
        const notificationsQuery = db
            .select()
            .from(notifications);

        const userNotifications = await notificationsQuery
            .where(whereClause)
            .orderBy(desc(notifications.createdAt))
            .limit(perPage)
            .offset(offset);

        // Get unread count
        const [{ unreadCount }] = await db
            .select({ unreadCount: count() })
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, userId),
                    eq(notifications.read, false),
                    or(
                        isNull(notifications.expiresAt),
                        gt(notifications.expiresAt, new Date())
                    )
                )
            );

        return {
            notifications: userNotifications.map(n => ({
                ...n,
                read: n.read || false,
                data: n.data ? JSON.parse(n.data) : undefined,
                priority: n.priority as NotificationPriority,
            })),
            unreadCount,
            pagination: {
                page,
                perPage,
                total,
                hasNext: offset + perPage < total,
            },
        };
    }

    /**
     * Get all notifications (admin only)
     */
    async getAllNotifications(options: {
        page?: number;
        perPage?: number;
        unreadOnly?: boolean;
        type?: string;
    } = {}): Promise<{
        notifications: Notification[];
        pagination: {
            page: number;
            perPage: number;
            total: number;
            hasNext: boolean;
        };
    }> {
        const { page = 1, perPage = 20, unreadOnly = false, type } = options;
        const offset = (page - 1) * perPage;

        // Build where conditions - only expiration check for admin view
        let whereClause = or(
            isNull(notifications.expiresAt),
            gt(notifications.expiresAt, new Date())
        );

        if (unreadOnly) {
            whereClause = and(whereClause, eq(notifications.read, false));
        }

        if (type) {
            whereClause = and(whereClause, eq(notifications.type, type));
        }

        // Get total count
        const totalQuery = db
            .select({ total: count() })
            .from(notifications);

        const [{ total }] = await totalQuery.where(whereClause);

        // Get notifications
        const notificationsQuery = db
            .select()
            .from(notifications);

        const allNotifications = await notificationsQuery
            .where(whereClause)
            .orderBy(desc(notifications.createdAt))
            .limit(perPage)
            .offset(offset);

        return {
            notifications: allNotifications.map(n => ({
                ...n,
                read: n.read || false,
                data: n.data ? JSON.parse(n.data) : undefined,
                priority: n.priority as NotificationPriority,
            })),
            pagination: {
                page,
                perPage,
                total,
                hasNext: offset + perPage < total,
            },
        };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string, userId: string): Promise<void> {
        await db
            .update(notifications)
            .set({
                read: true,
                readAt: new Date(),
            })
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.userId, userId)
                )
            );

        // Note: Real-time updates now handled by polling system
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<void> {
        await db
            .update(notifications)
            .set({
                read: true,
                readAt: new Date(),
            })
            .where(
                and(
                    eq(notifications.userId, userId),
                    eq(notifications.read, false)
                )
            );

        // Note: Real-time updates now handled by polling system
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        await db
            .delete(notifications)
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.userId, userId)
                )
            );
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
        const [{ unreadCount }] = await db
            .select({ unreadCount: count() })
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, userId),
                    eq(notifications.read, false),
                    or(
                        isNull(notifications.expiresAt),
                        gt(notifications.expiresAt, new Date())
                    )
                )
            );

        return unreadCount;
    }

    /**
     * Get recent notifications for dropdown (last 5)
     */
    async getRecentNotifications(userId: string): Promise<Notification[]> {
        const recentNotifications = await db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, userId),
                    or(
                        isNull(notifications.expiresAt),
                        gt(notifications.expiresAt, new Date())
                    )
                )
            )
            .orderBy(desc(notifications.createdAt))
            .limit(5);

        return recentNotifications.map(n => ({
            ...n,
            read: n.read || false,
            data: n.data ? JSON.parse(n.data) : undefined,
            priority: n.priority as NotificationPriority,
        }));
    }

    /**
     * Get user preference for a notification type
     */
    async getUserPreference(userId: string, type: string): Promise<NotificationPreference | null> {
        const [preference] = await db
            .select()
            .from(notificationPreferences)
            .where(
                and(
                    eq(notificationPreferences.userId, userId),
                    eq(notificationPreferences.type, type)
                )
            );

        return preference ? {
            ...preference,
            enabled: preference.enabled || false,
            emailEnabled: preference.emailEnabled || false,
        } : null;
    }

    /**
     * Get all user preferences
     */
    async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
        const preferences = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId));

        return preferences.map(pref => ({
            ...pref,
            enabled: pref.enabled || false,
            emailEnabled: pref.emailEnabled || false,
        }));
    }

    /**
     * Update user preference for a notification type
     */
    async updateUserPreference(
        userId: string,
        type: string,
        enabled: boolean,
        emailEnabled: boolean = false
    ): Promise<NotificationPreference> {
        const existingPreference = await this.getUserPreference(userId, type);

        if (existingPreference) {
            // Update existing preference
            await db
                .update(notificationPreferences)
                .set({
                    enabled,
                    emailEnabled,
                    updatedAt: new Date(),
                })
                .where(eq(notificationPreferences.id, existingPreference.id));

            return {
                ...existingPreference,
                enabled,
                emailEnabled,
                updatedAt: new Date(),
            };
        } else {
            // Create new preference
            const id = nanoid();
            const newPreference = {
                id,
                userId,
                type,
                enabled,
                emailEnabled,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await db.insert(notificationPreferences).values(newPreference);
            return newPreference;
        }
    }

    /**
     * Create default preferences for a user
     */
    async createDefaultPreferences(userId: string, userRole: string): Promise<void> {
        const defaultPreferences: Array<{
            type: string;
            enabled: boolean;
            emailEnabled: boolean;
        }> = [];

        // Add preferences based on user role
        if (userRole === 'admin') {
            ADMIN_NOTIFICATION_TYPES.forEach(type => {
                defaultPreferences.push({
                    type,
                    enabled: true,
                    emailEnabled: false,
                });
            });
        }

        if (userRole === 'customer') {
            CUSTOMER_NOTIFICATION_TYPES.forEach(type => {
                defaultPreferences.push({
                    type,
                    enabled: true,
                    emailEnabled: false,
                });
            });
        }

        // Add universal notification types
        ALL_USER_NOTIFICATION_TYPES.forEach(type => {
            defaultPreferences.push({
                type,
                enabled: true,
                emailEnabled: false,
            });
        });

        // Insert all preferences
        for (const pref of defaultPreferences) {
            try {
                await this.updateUserPreference(
                    userId,
                    pref.type,
                    pref.enabled,
                    pref.emailEnabled
                );
            } catch (error) {
                console.error(`Failed to create default preference for ${pref.type}:`, error);
            }
        }
    }

    /**
     * Get notification template
     */
    async getTemplate(type: string): Promise<NotificationTemplate | null> {
        const [template] = await db
            .select()
            .from(notificationTemplates)
            .where(eq(notificationTemplates.type, type));

        if (template) {
            return {
                ...template,
                defaultPriority: template.defaultPriority as NotificationPriority,
                roles: template.roles ? JSON.parse(template.roles) : undefined,
            };
        }

        return null;
    }

    /**
     * Create or update notification template
     */
    async upsertTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
        const existingTemplate = await this.getTemplate(template.type);

        if (existingTemplate) {
            // Update existing template
            await db
                .update(notificationTemplates)
                .set({
                    title: template.title,
                    message: template.message,
                    defaultPriority: template.defaultPriority,
                    roles: template.roles ? JSON.stringify(template.roles) : null,
                    updatedAt: new Date(),
                })
                .where(eq(notificationTemplates.id, existingTemplate.id));

            return {
                ...existingTemplate,
                ...template,
                updatedAt: new Date(),
            };
        } else {
            // Create new template
            const id = nanoid();
            const newTemplate = {
                id,
                type: template.type,
                title: template.title,
                message: template.message,
                defaultPriority: template.defaultPriority,
                roles: template.roles ? JSON.stringify(template.roles) : null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await db.insert(notificationTemplates).values(newTemplate);

            return {
                ...newTemplate,
                roles: template.roles,
            };
        }
    }

    /**
     * Get users by role for role-based notifications
     */
    async getUsersByRole(role: string): Promise<string[]> {
        const roleUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.role, role));

        return roleUsers.map(user => user.id);
    }

    /**
     * Get all admin users
     */
    async getAdminUsers(): Promise<string[]> {
        return this.getUsersByRole('admin');
    }

    /**
     * Clean up expired notifications
     */
    async cleanupExpiredNotifications(): Promise<{ deletedCount: number }> {
        const result = await db
            .delete(notifications)
            .where(
                and(
                    not(isNull(notifications.expiresAt)), // Only delete notifications that have an expiration date
                    lt(notifications.expiresAt, new Date()) // Expiration date is less than current time
                )
            );

        return { deletedCount: result.rowCount || 0 };
    }
}

// Export singleton instance
export const notificationService = new NotificationService();