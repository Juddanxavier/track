'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { Notification } from '@/types/notification';

interface NotificationDropdownProps {
    onClose: () => void;
    onNotificationRead?: () => void;
}

export function NotificationDropdown({ onClose, onNotificationRead }: NotificationDropdownProps) {
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
    const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
    const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

    // Show only the 5 most recent notifications
    const recentNotifications = notifications.slice(0, 5);

    const handleMarkAsRead = async (notificationId: string) => {
        setMarkingAsRead(notificationId);
        try {
            await markAsRead(notificationId);
            onNotificationRead?.();
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        } finally {
            setMarkingAsRead(null);
        }
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAllAsRead(true);
        try {
            await markAllAsRead();
            onNotificationRead?.();
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        } finally {
            setMarkingAllAsRead(false);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read if not already read
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }

        // Navigate to action URL if provided
        if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
        }

        onClose();
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'bg-red-500';
            case 'high':
                return 'bg-orange-500';
            case 'normal':
                return 'bg-blue-500';
            case 'low':
                return 'bg-gray-500';
            default:
                return 'bg-blue-500';
        }
    };

    const getNotificationIcon = (type: string) => {
        // You can expand this with specific icons for different notification types
        return <Bell className="h-4 w-4" />;
    };

    return (
        <Card className="absolute right-0 top-full mt-2 w-80 shadow-lg border z-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            disabled={markingAllAsRead}
                            className="h-7 px-2 text-xs"
                        >
                            {markingAllAsRead ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Mark all read
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
                    </div>
                ) : recentNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            You'll see notifications here when they arrive
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-80">
                        <div className="space-y-0">
                            {recentNotifications.map((notification, index) => (
                                <div key={notification.id}>
                                    <div
                                        className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${!notification.read ? 'bg-muted/30' : ''
                                            }`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <div className="flex-shrink-0 mt-0.5">
                                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className={`text-sm ${!notification.read ? 'font-medium' : 'font-normal'}`}>
                                                            {notification.title}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center space-x-1 ml-2">
                                                        {!notification.read && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMarkAsRead(notification.id);
                                                                }}
                                                                disabled={markingAsRead === notification.id}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                {markingAsRead === notification.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Check className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                        )}

                                                        {notification.actionUrl && (
                                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {index < recentNotifications.length - 1 && <Separator />}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}

                {recentNotifications.length > 0 && (
                    <>
                        <Separator />
                        <div className="p-3">
                            <Link href="/notifications" onClick={onClose}>
                                <Button variant="ghost" className="w-full justify-center text-sm">
                                    View All Notifications
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}