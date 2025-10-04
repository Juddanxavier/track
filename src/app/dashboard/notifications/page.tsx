'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, Filter, Search, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotifications } from '@/contexts/NotificationContext';
import { Notification, NOTIFICATION_TYPES } from '@/types/notification';

interface NotificationFilters {
    type: string;
    read: string;
    search: string;
}

export default function NotificationsPage() {
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<NotificationFilters>({
        type: 'all',
        read: 'all',
        search: '',
    });
    const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
    const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
    const [bulkMarkingAsRead, setBulkMarkingAsRead] = useState(false);
    const [deletingNotification, setDeletingNotification] = useState<string | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Filter notifications based on current filters
    useEffect(() => {
        let filtered = [...notifications];

        // Filter by type
        if (filters.type !== 'all') {
            filtered = filtered.filter(notification => notification.type === filters.type);
        }

        // Filter by read status
        if (filters.read === 'unread') {
            filtered = filtered.filter(notification => !notification.read);
        } else if (filters.read === 'read') {
            filtered = filtered.filter(notification => notification.read);
        }

        // Filter by search term
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(notification =>
                notification.title.toLowerCase().includes(searchTerm) ||
                notification.message.toLowerCase().includes(searchTerm)
            );
        }

        setFilteredNotifications(filtered);
    }, [notifications, filters]);

    const handleMarkAsRead = async (notificationId: string) => {
        setMarkingAsRead(notificationId);
        try {
            await markAsRead(notificationId);
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
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        } finally {
            setMarkingAllAsRead(false);
        }
    };

    const handleBulkMarkAsRead = async () => {
        if (selectedNotifications.size === 0) return;

        setBulkMarkingAsRead(true);
        try {
            // Mark selected notifications as read
            const promises = Array.from(selectedNotifications).map(id => markAsRead(id));
            await Promise.all(promises);
            setSelectedNotifications(new Set());
        } catch (error) {
            console.error('Failed to mark selected notifications as read:', error);
        } finally {
            setBulkMarkingAsRead(false);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        setDeletingNotification(notificationId);
        try {
            await deleteNotification(notificationId);
            // Remove from selected notifications if it was selected
            const newSelected = new Set(selectedNotifications);
            newSelected.delete(notificationId);
            setSelectedNotifications(newSelected);
        } catch (error) {
            console.error('Failed to delete notification:', error);
        } finally {
            setDeletingNotification(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedNotifications.size === 0) return;

        setBulkDeleting(true);
        try {
            // Delete selected notifications
            const promises = Array.from(selectedNotifications).map(id => deleteNotification(id));
            await Promise.all(promises);
            setSelectedNotifications(new Set());
        } catch (error) {
            console.error('Failed to delete selected notifications:', error);
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read if not already read
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }

        // Navigate to action URL if provided
        if (notification.actionUrl) {
            window.open(notification.actionUrl, '_blank');
        }
    };

    const handleSelectNotification = (notificationId: string, checked: boolean) => {
        const newSelected = new Set(selectedNotifications);
        if (checked) {
            newSelected.add(notificationId);
        } else {
            newSelected.delete(notificationId);
        }
        setSelectedNotifications(newSelected);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(filteredNotifications.map(n => n.id));
            setSelectedNotifications(allIds);
        } else {
            setSelectedNotifications(new Set());
        }
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

    const getNotificationTypeLabel = (type: string) => {
        const typeLabels: Record<string, string> = {
            [NOTIFICATION_TYPES.USER_REGISTERED]: 'User Registration',
            [NOTIFICATION_TYPES.LEAD_CONVERTED]: 'Lead Conversion',
            [NOTIFICATION_TYPES.LEAD_ASSIGNED]: 'Lead Assignment',
            [NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED]: 'System Cleanup',
            [NOTIFICATION_TYPES.USER_BANNED]: 'User Banned',
            [NOTIFICATION_TYPES.USER_UNBANNED]: 'User Unbanned',
            [NOTIFICATION_TYPES.SYSTEM_ERROR]: 'System Error',
            [NOTIFICATION_TYPES.BULK_ACTION_COMPLETED]: 'Bulk Action',
            [NOTIFICATION_TYPES.ACCOUNT_UPDATED]: 'Account Update',
            [NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGED]: 'Account Status',
            [NOTIFICATION_TYPES.LEAD_STATUS_UPDATED]: 'Lead Status',
            [NOTIFICATION_TYPES.SYSTEM_MAINTENANCE]: 'Maintenance',
            [NOTIFICATION_TYPES.WELCOME]: 'Welcome',
        };
        return typeLabels[type] || type;
    };

    const allSelected = filteredNotifications.length > 0 &&
        filteredNotifications.every(n => selectedNotifications.has(n.id));
    const someSelected = selectedNotifications.size > 0 && !allSelected;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Notifications</h1>
                    <p className="text-muted-foreground">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
                    </p>
                </div>

                {unreadCount > 0 && (
                    <Button
                        onClick={handleMarkAllAsRead}
                        disabled={markingAllAsRead}
                        className="gap-2"
                    >
                        {markingAllAsRead ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCheck className="h-4 w-4" />
                        )}
                        Mark All Read
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search notifications..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <Select
                                value={filters.type}
                                onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {Object.values(NOTIFICATION_TYPES).map(type => (
                                        <SelectItem key={type} value={type}>
                                            {getNotificationTypeLabel(type)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select
                                value={filters.read}
                                onValueChange={(value) => setFilters(prev => ({ ...prev, read: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="unread">Unread</SelectItem>
                                    <SelectItem value="read">Read</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedNotifications.size > 0 && (
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {selectedNotifications.size} notification{selectedNotifications.size === 1 ? '' : 's'} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkMarkAsRead}
                                    disabled={bulkMarkingAsRead || bulkDeleting}
                                    className="gap-2"
                                >
                                    {bulkMarkingAsRead ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                    Mark as Read
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkDelete}
                                    disabled={bulkDeleting || bulkMarkingAsRead}
                                    className="gap-2 text-destructive hover:text-destructive"
                                >
                                    {bulkDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Notifications List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            {filteredNotifications.length} Notification{filteredNotifications.length === 1 ? '' : 's'}
                        </CardTitle>

                        {filteredNotifications.length > 0 && (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                                <span className="text-sm text-muted-foreground">Select All</span>
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="ml-3 text-muted-foreground">Loading notifications...</span>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No notifications found</h3>
                            <p className="text-muted-foreground">
                                {filters.search || filters.type !== 'all' || filters.read !== 'all'
                                    ? 'Try adjusting your filters to see more notifications.'
                                    : 'You\'ll see notifications here when they arrive.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {filteredNotifications.map((notification, index) => (
                                <div key={notification.id}>
                                    <div
                                        className={`p-4 hover:bg-muted/50 transition-colors ${!notification.read ? 'bg-muted/30' : ''
                                            }`}
                                    >
                                        <div className="flex items-start space-x-4">
                                            <Checkbox
                                                checked={selectedNotifications.has(notification.id)}
                                                onCheckedChange={(checked) =>
                                                    handleSelectNotification(notification.id, checked as boolean)
                                                }
                                                className="mt-1"
                                            />

                                            <div className="flex-shrink-0 mt-1">
                                                <div className={`w-3 h-3 rounded-full ${getPriorityColor(notification.priority)}`} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                                                                {notification.title}
                                                            </h3>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {getNotificationTypeLabel(notification.type)}
                                                            </Badge>
                                                            {notification.priority !== 'normal' && (
                                                                <Badge
                                                                    variant={notification.priority === 'urgent' ? 'destructive' : 'outline'}
                                                                    className="text-xs"
                                                                >
                                                                    {notification.priority}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {notification.message}
                                                        </p>

                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span>
                                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                            </span>
                                                            {notification.read && notification.readAt && (
                                                                <span>
                                                                    Read {formatDistanceToNow(new Date(notification.readAt), { addSuffix: true })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-2 ml-4">
                                                        {!notification.read && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                disabled={markingAsRead === notification.id}
                                                                className="h-8 px-2"
                                                            >
                                                                {markingAsRead === notification.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Check className="h-4 w-4 mr-1" />
                                                                        Mark Read
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}

                                                        {notification.actionUrl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleNotificationClick(notification)}
                                                                className="h-8 px-2"
                                                            >
                                                                <ExternalLink className="h-4 w-4 mr-1" />
                                                                View
                                                            </Button>
                                                        )}

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteNotification(notification.id)}
                                                            disabled={deletingNotification === notification.id}
                                                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            {deletingNotification === notification.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                                    Delete
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {index < filteredNotifications.length - 1 && <Separator />}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}