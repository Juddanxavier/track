'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, Filter, Search, Loader2, ExternalLink, Trash2, Users, Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/contexts/NotificationContext';
import { Notification, NOTIFICATION_TYPES } from '@/types/notification';

interface NotificationFilters {
    type: string;
    read: string;
    search: string;
    user: string;
}

interface NotificationStats {
    totalNotifications: number;
    unreadNotifications: number;
    notificationsByType: Record<string, number>;
    activeUsers: number;
}

export default function AdminNotificationsPage() {
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
    const [stats, setStats] = useState<NotificationStats | null>(null);
    const [filters, setFilters] = useState<NotificationFilters>({
        type: 'all',
        read: 'all',
        search: '',
        user: 'all',
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
    const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
    const [bulkMarkingAsRead, setBulkMarkingAsRead] = useState(false);
    const [deletingNotification, setDeletingNotification] = useState<string | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Fetch all notifications for admin view
    const fetchAllNotifications = async () => {
        try {
            const response = await fetch('/api/notifications?admin=true&limit=100');
            if (response.ok) {
                const data = await response.json();
                setAllNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch admin notifications:', error);
        }
    };

    // Fetch notification statistics
    const fetchStats = async () => {
        try {
            setLoadingStats(true);
            const response = await fetch('/api/notifications/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch notification stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    // Initialize admin data
    useEffect(() => {
        fetchAllNotifications();
        fetchStats();
    }, []);

    // Filter notifications based on current filters
    useEffect(() => {
        let filtered = [...allNotifications];

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

        // Filter by user (if implemented)
        if (filters.user !== 'all') {
            filtered = filtered.filter(notification => notification.userId === filters.user);
        }

        setFilteredNotifications(filtered);
    }, [allNotifications, filters]);

    const handleMarkAsRead = async (notificationId: string) => {
        setMarkingAsRead(notificationId);
        try {
            await markAsRead(notificationId);
            // Update local state
            setAllNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n)
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        } finally {
            setMarkingAsRead(null);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        setDeletingNotification(notificationId);
        try {
            await deleteNotification(notificationId);
            // Update local state
            setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
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

    const handleBulkMarkAsRead = async () => {
        if (selectedNotifications.size === 0) return;

        setBulkMarkingAsRead(true);
        try {
            const promises = Array.from(selectedNotifications).map(id => markAsRead(id));
            await Promise.all(promises);
            // Update local state
            setAllNotifications(prev =>
                prev.map(n => selectedNotifications.has(n.id) ? { ...n, read: true, readAt: new Date() } : n)
            );
            setSelectedNotifications(new Set());
        } catch (error) {
            console.error('Failed to mark selected notifications as read:', error);
        } finally {
            setBulkMarkingAsRead(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedNotifications.size === 0) return;

        setBulkDeleting(true);
        try {
            const promises = Array.from(selectedNotifications).map(id => deleteNotification(id));
            await Promise.all(promises);
            // Update local state
            setAllNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
            setSelectedNotifications(new Set());
        } catch (error) {
            console.error('Failed to delete selected notifications:', error);
        } finally {
            setBulkDeleting(false);
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
            setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
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
        // Convert type to readable label
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const allSelected = filteredNotifications.length > 0 &&
        filteredNotifications.every(n => selectedNotifications.has(n.id));
    const someSelected = selectedNotifications.size > 0 && !allSelected;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Admin Notifications</h1>
                    <p className="text-muted-foreground">
                        Manage and monitor all system notifications
                    </p>
                </div>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Notification
                </Button>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="notifications">All Notifications</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
                                <Bell className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {loadingStats ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        stats?.totalNotifications || 0
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Unread</CardTitle>
                                <Bell className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-500">
                                    {loadingStats ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        stats?.unreadNotifications || 0
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {loadingStats ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        stats?.activeUsers || 0
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                                <div className="h-4 w-4 bg-green-500 rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-500">
                                    Healthy
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Notifications Preview */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Notifications</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
                                </div>
                            ) : allNotifications.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No notifications found
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {allNotifications.slice(0, 5).map((notification) => (
                                        <div key={notification.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(notification.priority)}`} />
                                            <div className="flex-1">
                                                <p className="font-medium">{notification.title}</p>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                            </div>
                                            <Badge variant="secondary">
                                                {getNotificationTypeLabel(notification.type)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-6">
                    {/* Filters */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Filter className="h-5 w-5" />
                                Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                            {Object.entries(NOTIFICATION_TYPES).map(([key, value]) => (
                                                <SelectItem key={value} value={value}>
                                                    {getNotificationTypeLabel(value)}
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

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">User</label>
                                    <Select
                                        value={filters.user}
                                        onValueChange={(value) => setFilters(prev => ({ ...prev, user: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Users</SelectItem>
                                            {/* Add user options here */}
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
                                <CardTitle>
                                    Notifications ({filteredNotifications.length})
                                </CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                    />
                                    <span className="text-sm text-muted-foreground">Select all</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">No notifications found</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Try adjusting your filters
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-0">
                                    {filteredNotifications.map((notification, index) => (
                                        <div key={notification.id}>
                                            <div className={`p-4 hover:bg-muted/50 transition-colors ${!notification.read ? 'bg-muted/30' : ''}`}>
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
                                                                        User: {notification.userId}
                                                                    </span>
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
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Analytics</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8 text-muted-foreground">
                                Analytics dashboard coming soon...
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}