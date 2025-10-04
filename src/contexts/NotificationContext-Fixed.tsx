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
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [connectionId, setConnectionId] = useState<string | null>(null);

    // Use refs to prevent multiple connections
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);
    const mountedRef = useRef(true);

    // Get current user session
    const { data: session, isPending: sessionLoading } = authClient.useSession();
    const userId = session?.user?.id;

    // Fetch initial notifications
    const fetchNotifications = useCallback(async () => {
        if (!mountedRef.current) return;

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/notifications/recent');
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const data = await response.json();
            if (mountedRef.current) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    // Clean up existing connection
    const cleanupConnection = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (eventSourceRef.current) {
            console.log('🧹 Cleaning up existing SSE connection');
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setIsConnected(false);
        setIsConnecting(false);
        setConnectionId(null);
    }, []);

    // Setup SSE connection
    const setupSSEConnection = useCallback(() => {
        if (!userId || !mountedRef.current) {
            console.log('⚠️ No userId or component unmounted, skipping SSE setup');
            return;
        }

        if (eventSourceRef.current) {
            console.log('⚠️ SSE connection already exists, skipping duplicate setup');
            return;
        }

        console.log('🔧 Setting up SSE connection for user:', userId);

        setIsConnecting(true);
        setError(null);

        try {
            const eventSource = new EventSource(`/api/notifications/sse?userId=${encodeURIComponent(userId)}`);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('✅ SSE connection opened');
                if (mountedRef.current) {
                    setIsConnected(true);
                    setIsConnecting(false);
                    setReconnectAttempts(0);
                    setError(null);
                }
            };

            eventSource.onmessage = (event) => {
                if (!mountedRef.current) return;

                try {
                    const message = JSON.parse(event.data);
                    console.log('📨 SSE message received:', message.type);

                    switch (message.type) {
                        case 'connection_established':
                            setConnectionId(message.data?.connectionId || null);
                            break;

                        case 'notification':
                            const newNotification = message.data as Notification;
                            setNotifications(prev => [newNotification, ...prev.slice(0, 4)]);
                            setUnreadCount(prev => prev + 1);
                            break;

                        case 'unread_count_update':
                            setUnreadCount(message.data.unreadCount);
                            break;

                        case 'notification_read':
                            const { notificationId } = message.data;
                            setNotifications(prev =>
                                prev.map(notification =>
                                    notification.id === notificationId
                                        ? { ...notification, read: true, readAt: new Date() }
                                        : notification
                                )
                            );
                            break;

                        case 'heartbeat':
                            // Just acknowledge heartbeat
                            break;
                    }
                } catch (err) {
                    console.error('❌ Failed to parse SSE message:', err);
                }
            };

            eventSource.onerror = (event) => {
                console.error('❌ SSE connection error:', event);

                if (!mountedRef.current) return;

                setIsConnected(false);
                setIsConnecting(false);

                // Only attempt reconnection if we haven't exceeded max attempts
                if (reconnectAttempts < 5) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                    console.log(`🔄 Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);

                    setReconnectAttempts(prev => prev + 1);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current && !eventSourceRef.current) {
                            setupSSEConnection();
                        }
                    }, delay);
                } else {
                    setError('Max reconnection attempts reached');
                    console.error('❌ Max SSE reconnection attempts reached');
                }
            };

        } catch (err) {
            console.error('❌ Failed to create SSE connection:', err);
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to create SSE connection');
                setIsConnecting(false);
            }
        }
    }, [userId, reconnectAttempts]);

    // Force reconnect function
    const forceReconnect = useCallback(() => {
        console.log('🔄 Force reconnecting SSE...');
        setReconnectAttempts(0);
        cleanupConnection();
        if (userId && mountedRef.current) {
            setTimeout(() => setupSSEConnection(), 1000);
        }
    }, [userId, cleanupConnection, setupSSEConnection]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const response = await fetch(`/api/notifications/${notificationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ read: true }),
            });

            if (!response.ok) {
                throw new Error('Failed to mark notification as read');
            }

            // Update local state
            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, read: true, readAt: new Date() }
                        : notification
                )
            );

            // Update unread count
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to mark all notifications as read');
            }

            // Update local state
            setNotifications(prev =>
                prev.map(notification => ({
                    ...notification,
                    read: true,
                    readAt: new Date()
                }))
            );
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    }, []);

    // Refresh notifications
    const refreshNotifications = useCallback(async () => {
        await fetchNotifications();
    }, [fetchNotifications]);

    // Initialize on mount
    useEffect(() => {
        if (sessionLoading || isInitializedRef.current) return;

        console.log('🚀 Initializing notification system');
        isInitializedRef.current = true;

        fetchNotifications();

        if (userId) {
            // Delay SSE setup to avoid React strict mode issues
            setTimeout(() => {
                if (mountedRef.current && !eventSourceRef.current) {
                    setupSSEConnection();
                }
            }, 1000);
        }
    }, [sessionLoading, userId, fetchNotifications, setupSSEConnection]);

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && mountedRef.current) {
                if (!isConnected && userId && !eventSourceRef.current) {
                    console.log('🔄 Tab became active, reconnecting SSE...');
                    setupSSEConnection();
                }
                refreshNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isConnected, userId, setupSSEConnection, refreshNotifications]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('🧹 Cleaning up notification context');
            mountedRef.current = false;
            cleanupConnection();
        };
    }, [cleanupConnection]);

    const value: NotificationContextType = {
        notifications,
        unreadCount,
        isConnected,
        isConnecting,
        isLoading,
        error,
        reconnectAttempts,
        connectionId,
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