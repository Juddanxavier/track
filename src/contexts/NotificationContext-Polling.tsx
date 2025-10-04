/** @format */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Notification } from '@/types/notification';
import { authClient } from '@/lib/auth-client';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    isConnected: boolean;
    isConnecting: boolean;
    isLoading: boolean;
    error: string | null;
    reconnectAttempts: number;
    connectionId: string | null;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refreshNotifications: () => Promise<void>;
    forceReconnect: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}

interface NotificationProviderProps {
    children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Polling state
    const [isPolling, setIsPolling] = useState(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const mountedRef = useRef(true);

    // Get current user session
    const { data: session, isPending: sessionLoading } = authClient.useSession();
    const userId = session?.user?.id;

    // Fetch notifications and unread count
    const fetchNotifications = useCallback(async (showLoading = true) => {
        if (!mountedRef.current || !userId) return;

        try {
            if (showLoading) {
                setIsLoading(true);
            }
            setError(null);

            // Fetch both notifications and unread count in parallel
            const [notificationsResponse, unreadResponse] = await Promise.all([
                fetch('/api/notifications/recent?limit=10'),
                fetch('/api/notifications/unread-count')
            ]);

            if (!notificationsResponse.ok || !unreadResponse.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const [notificationsData, unreadData] = await Promise.all([
                notificationsResponse.json(),
                unreadResponse.json()
            ]);

            if (mountedRef.current) {
                setNotifications(notificationsData.notifications || []);
                setUnreadCount(unreadData.unreadCount || 0);
                lastUpdateRef.current = Date.now();
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
            }
        } finally {
            if (mountedRef.current && showLoading) {
                setIsLoading(false);
            }
        }
    }, [userId]);

    // Start polling
    const startPolling = useCallback(() => {
        if (!userId || isPolling || pollingIntervalRef.current) {
            return;
        }

        console.log('🔄 Starting notification polling');
        setIsPolling(true);

        // Initial fetch
        fetchNotifications(false);

        // Set up polling interval
        pollingIntervalRef.current = setInterval(() => {
            if (mountedRef.current && !document.hidden) {
                fetchNotifications(false);
            }
        }, 15000); // Poll every 15 seconds
    }, [userId, isPolling, fetchNotifications]);

    // Stop polling
    const stopPolling = useCallback(() => {
        console.log('⏹️ Stopping notification polling');
        setIsPolling(false);

        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            // Optimistic update
            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, read: true, readAt: new Date() }
                        : notification
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));

            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ read: true }),
            });

            if (!response.ok) {
                // Revert optimistic update on failure
                setNotifications(prev =>
                    prev.map(notification =>
                        notification.id === notificationId
                            ? { ...notification, read: false, readAt: undefined }
                            : notification
                    )
                );
                setUnreadCount(prev => prev + 1);
                throw new Error('Failed to mark notification as read');
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            // Optimistic update
            const originalNotifications = notifications;
            const originalUnreadCount = unreadCount;

            setNotifications(prev =>
                prev.map(notification => ({
                    ...notification,
                    read: true,
                    readAt: new Date()
                }))
            );
            setUnreadCount(0);

            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
            });

            if (!response.ok) {
                // Revert optimistic update on failure
                setNotifications(originalNotifications);
                setUnreadCount(originalUnreadCount);
                throw new Error('Failed to mark all notifications as read');
            }
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    }, [notifications, unreadCount]);

    // Refresh notifications (force fetch)
    const refreshNotifications = useCallback(async () => {
        await fetchNotifications(true);
    }, [fetchNotifications]);

    // Force reconnect (restart polling)
    const forceReconnect = useCallback(() => {
        console.log('🔄 Restarting notification polling');
        stopPolling();
        setTimeout(() => {
            if (mountedRef.current && userId) {
                startPolling();
            }
        }, 1000);
    }, [stopPolling, startPolling, userId]);

    // Initialize on mount
    useEffect(() => {
        if (sessionLoading) return;

        console.log('🚀 Initializing notification polling system');

        if (userId) {
            fetchNotifications(true).then(() => {
                startPolling();
            });
        } else {
            setIsLoading(false);
        }

        return () => {
            stopPolling();
        };
    }, [sessionLoading, userId, fetchNotifications, startPolling, stopPolling]);

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && mountedRef.current && userId) {
                // Refresh when tab becomes active
                fetchNotifications(false);

                // Restart polling if it's not running
                if (!isPolling) {
                    startPolling();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [userId, isPolling, startPolling, fetchNotifications]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('🧹 Cleaning up notification polling');
            mountedRef.current = false;
            stopPolling();
        };
    }, [stopPolling]);

    const value: NotificationContextType = {
        notifications,
        unreadCount,
        isConnected: isPolling, // Consider polling as "connected"
        isConnecting: false,
        isLoading,
        error,
        reconnectAttempts: 0,
        connectionId: null,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
        forceReconnect,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}