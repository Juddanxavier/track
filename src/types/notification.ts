/** @format */

export interface Notification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    read: boolean;
    readAt?: Date | null;
    actionUrl?: string | null;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    expiresAt?: Date | null;
    createdAt: Date;
}

export interface NotificationPreference {
    id: string;
    userId: string;
    type: string;
    enabled: boolean;
    emailEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationTemplate {
    id: string;
    type: string;
    title: string;
    message: string;
    defaultPriority: 'low' | 'normal' | 'high' | 'urgent';
    roles?: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateNotificationRequest {
    userId?: string;
    userIds?: string[];
    type: string;
    title?: string;
    message?: string;
    data?: any;
    actionUrl?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    expiresAt?: Date;
}

export interface NotificationListResponse {
    notifications: Notification[];
    unreadCount: number;
    pagination?: {
        page: number;
        perPage: number;
        total: number;
        hasNext: boolean;
    };
}

// Notification type constants
export const NOTIFICATION_TYPES = {
    // Admin notifications
    USER_REGISTERED: 'user_registered',
    LEAD_CONVERTED: 'lead_converted',
    LEAD_ASSIGNED: 'lead_assigned',
    SYSTEM_CLEANUP_COMPLETED: 'system_cleanup_completed',
    USER_BANNED: 'user_banned',
    USER_UNBANNED: 'user_unbanned',
    SYSTEM_ERROR: 'system_error',
    BULK_ACTION_COMPLETED: 'bulk_action_completed',

    // Shipment notifications (Admin)
    SHIPMENT_CREATED: 'shipment_created',
    SHIPMENT_SIGNUP_COMPLETED: 'shipment_signup_completed',
    SHIPMENT_EXCEPTION: 'shipment_exception',
    SHIPMENT_DELAYED: 'shipment_delayed',
    SHIPMENT_DELIVERY_FAILED: 'shipment_delivery_failed',

    // Assignment notifications (Admin)
    USER_ASSIGNMENT_COMPLETED: 'user_assignment_completed',
    TRACKING_ASSIGNMENT_COMPLETED: 'tracking_assignment_completed',
    SIGNUP_LINK_SENT: 'signup_link_sent',
    SIGNUP_REMINDER_NEEDED: 'signup_reminder_needed',

    // Customer notifications
    ACCOUNT_UPDATED: 'account_updated',
    ACCOUNT_STATUS_CHANGED: 'account_status_changed',
    LEAD_STATUS_UPDATED: 'lead_status_updated',
    SYSTEM_MAINTENANCE: 'system_maintenance',
    WELCOME: 'welcome',

    // Shipment notifications (Customer)
    SHIPMENT_ASSIGNED: 'shipment_assigned',
    SHIPMENT_SIGNUP_INVITATION: 'shipment_signup_invitation',
    SHIPMENT_STATUS_UPDATED: 'shipment_status_updated',
    SHIPMENT_DELIVERED: 'shipment_delivered',
    SHIPMENT_OUT_FOR_DELIVERY: 'shipment_out_for_delivery',
    SHIPMENT_IN_TRANSIT: 'shipment_in_transit',

    // Assignment notifications (Customer)
    SHIPMENT_USER_ASSIGNED: 'shipment_user_assigned',
    SHIPMENT_SIGNUP_WELCOME: 'shipment_signup_welcome',
    SHIPMENT_SIGNUP_REMINDER: 'shipment_signup_reminder',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Priority levels
export const NOTIFICATION_PRIORITIES = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent',
} as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[keyof typeof NOTIFICATION_PRIORITIES];

// Role-based notification mapping
export const ADMIN_NOTIFICATION_TYPES = [
    NOTIFICATION_TYPES.USER_REGISTERED,
    NOTIFICATION_TYPES.LEAD_CONVERTED,
    NOTIFICATION_TYPES.LEAD_ASSIGNED,
    NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
    NOTIFICATION_TYPES.USER_BANNED,
    NOTIFICATION_TYPES.USER_UNBANNED,
    NOTIFICATION_TYPES.SYSTEM_ERROR,
    NOTIFICATION_TYPES.BULK_ACTION_COMPLETED,
    NOTIFICATION_TYPES.SHIPMENT_CREATED,
    NOTIFICATION_TYPES.SHIPMENT_SIGNUP_COMPLETED,
    NOTIFICATION_TYPES.SHIPMENT_EXCEPTION,
    NOTIFICATION_TYPES.SHIPMENT_DELAYED,
    NOTIFICATION_TYPES.SHIPMENT_DELIVERY_FAILED,
    NOTIFICATION_TYPES.USER_ASSIGNMENT_COMPLETED,
    NOTIFICATION_TYPES.TRACKING_ASSIGNMENT_COMPLETED,
    NOTIFICATION_TYPES.SIGNUP_LINK_SENT,
    NOTIFICATION_TYPES.SIGNUP_REMINDER_NEEDED,
] as const;

export const CUSTOMER_NOTIFICATION_TYPES = [
    NOTIFICATION_TYPES.ACCOUNT_UPDATED,
    NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGED,
    NOTIFICATION_TYPES.LEAD_STATUS_UPDATED,
    NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    NOTIFICATION_TYPES.WELCOME,
    NOTIFICATION_TYPES.SHIPMENT_ASSIGNED,
    NOTIFICATION_TYPES.SHIPMENT_SIGNUP_INVITATION,
    NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED,
    NOTIFICATION_TYPES.SHIPMENT_DELIVERED,
    NOTIFICATION_TYPES.SHIPMENT_OUT_FOR_DELIVERY,
    NOTIFICATION_TYPES.SHIPMENT_IN_TRANSIT,
    NOTIFICATION_TYPES.SHIPMENT_USER_ASSIGNED,
    NOTIFICATION_TYPES.SHIPMENT_SIGNUP_WELCOME,
    NOTIFICATION_TYPES.SHIPMENT_SIGNUP_REMINDER,
] as const;

export const ALL_USER_NOTIFICATION_TYPES = [
    NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
] as const;