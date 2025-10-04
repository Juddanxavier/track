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
    deleteNotification: (notificationId: string) => Promise<void>;
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

    // Fallback to clear loading state after maximum time
    useEffect(() => {
        const maxLoadingTimeout = setTimeout(() => {
            if (isLoading) {
                console.warn('⚠️ Maximum loading time exceeded, clearing loading state');
                setIsLoading(false);
            }
        }, 20000); // 20 second maximum loading time

        return () => clearTimeout(maxLoadingTimeout);
    }, [isLoading]);

    // Fetch notifications and unread count
    const fetchNotifications = useCallback(async (showLoading = true) => {
        if (!mountedRef.current || !userId) return;

        try {
            if (showLoading) {
                setIsLoading(true);
            }
            setError(null);

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            // Fetch both notifications and unread count in parallel
            const [notificationsResponse, unreadResponse] = await Promise.all([
                fetch('/api/notifications/recent?limit=10', { signal: controller.signal }),
                fetch('/api/notifications/unread-count', { signal: controller.signal })
            ]);

            clearTimeout(timeoutId);

            if (!notificationsResponse.ok || !unreadResponse.ok) {
                throw new Error(`Failed to fetch notifications: ${notificationsResponse.status} ${unreadResponse.status}`);
            }

            const [notificationsData, unreadData] = await Promise.all([
                notificationsResponse.json(),
                unreadResponse.json()
            ]);

            if (mountedRef.current) {
                setNotifications(notificationsData.notifications || []);
                setUnreadCount(unreadData.unreadCount || 0);
                lastUpdateRef.current = Date.now();
                console.log(`📱 Fetched ${notificationsData.notifications?.length || 0} notifications, ${unreadData.unreadCount || 0} unread`);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false); // Always set loading to false
            }
        }
    }, [userId]);

    // Start polling
    const startPolling = useCallback(() => {
        console.log('🔄 startPolling called');
        console.log('   User ID:', userId);
        console.log('   Existing interval:', !!pollingIntervalRef.current);
        console.log('   Component mounted:', mountedRef.current);

        if (!userId) {
            console.log('❌ No user ID, cannot start polling');
            return;
        }

        if (pollingIntervalRef.current) {
            console.log('⚠️ Polling already active, skipping');
            return;
        }

        console.log('✅ Starting notification polling');
        setIsPolling(true);

        // Initial fetch
        fetchNotifications(false);

        // Set up polling interval
        pollingIntervalRef.current = setInterval(() => {
            if (mountedRef.current && !document.hidden) {
                console.log('📡 Polling for notifications...');
                fetchNotifications(false);
            }
        }, 15000); // Poll every 15 seconds

        console.log('✅ Polling interval set up successfully');
    }, [userId, fetchNotifications]);

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

    // Delete notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            // Optimistic update
            const originalNotifications = notifications;
            const deletedNotification = notifications.find(n => n.id === notificationId);

            setNotifications(prev => prev.filter(n => n.id !== notificationId));

            // Update unread count if the deleted notification was unread
            if (deletedNotification && !deletedNotification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }

            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                // Revert optimistic update on failure
                setNotifications(originalNotifications);
                if (deletedNotification && !deletedNotification.read) {
                    setUnreadCount(prev => prev + 1);
                }
                throw new Error('Failed to delete notification');
            }
        } catch (err) {
            console.error('Error deleting notification:', err);
            throw err; // Re-throw so UI can handle the error
        }
    }, [notifications]);

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
        if (sessionLoading) {
            console.log('⏳ Waiting for session to load...');
            // Add timeout to prevent infinite loading if session never loads
            const sessionTimeout = setTimeout(() => {
                console.warn('⚠️ Session loading timeout, disabling notifications');
                setIsLoading(false);
                setError('Session loading timeout');
            }, 15000); // 15 second timeout

            return () => clearTimeout(sessionTimeout);
        }

        console.log('🚀 Initializing notification polling system');
        console.log('   User ID:', userId);
        console.log('   Session loading:', sessionLoading);

        if (userId) {
            console.log('✅ User found, starting notification system');
            fetchNotifications(true).then(() => {
                console.log('📱 Initial notifications fetched, starting polling');
                startPolling();
            }).catch((error) => {
                console.error('❌ Failed to fetch initial notifications:', error);
                setIsLoading(false);
                setError('Failed to load notifications');
            });
        } else {
            console.log('⚠️ No user ID found, notifications disabled');
            setIsLoading(false);
        }

        return () => {
            console.log('🧹 Cleaning up notification system');
            stopPolling();
        };
    }, [sessionLoading, userId]);

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && mountedRef.current && userId) {
                // Refresh when tab becomes active
                fetchNotifications(false);

                // Restart polling if it's not running
                if (!pollingIntervalRef.current) {
                    startPolling();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [userId]);

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
        deleteNotification,
        refreshNotifications,
        forceReconnect,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}