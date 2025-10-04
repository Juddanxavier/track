/** @format */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Package,
    Truck,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    RefreshCw,
    Clock,
    Activity
} from 'lucide-react';
import { useShipmentStats } from '@/hooks/useShipmentStats';

interface ShipmentStatsDashboardProps {
    onFilterChange?: (filter: string, value: string) => void;
}

export function ShipmentStatsDashboard({ onFilterChange }: ShipmentStatsDashboardProps) {
    const { stats, loading, error, refetch } = useShipmentStats();

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 w-16" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={refetch}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    if (!stats) return null;

    const getCompletionPercentage = (completed: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    };

    const deliveryRate = getCompletionPercentage(stats.delivered, stats.total);
    const activeShipments = stats.total - stats.delivered - stats.cancelled;

    const statCards = [
        {
            title: 'Total Shipments',
            value: stats.total,
            icon: Package,
            description: 'All shipments in system',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            onClick: () => onFilterChange?.('all', 'true'),
        },
        {
            title: 'Active Shipments',
            value: activeShipments,
            icon: Truck,
            description: 'In transit & pending',
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            onClick: () => onFilterChange?.('status', 'active'),
        },
        {
            title: 'Delivered',
            value: stats.delivered,
            icon: CheckCircle,
            description: 'Successfully delivered',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            onClick: () => onFilterChange?.('status', 'delivered'),
        },
        {
            title: 'Needs Review',
            value: stats.needsReview,
            icon: AlertCircle,
            description: 'API sync failures',
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            onClick: () => onFilterChange?.('needsReview', 'true'),
            urgent: true,
        },
        {
            title: 'Recent Activity',
            value: stats.recentCount,
            icon: Activity,
            description: 'Last 24 hours',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            onClick: () => onFilterChange?.('recent', 'true'),
        },
        {
            title: 'Exceptions',
            value: stats.exception,
            icon: AlertCircle,
            description: 'Delivery exceptions',
            color: stats.exception > 0 ? 'text-red-600' : 'text-gray-600',
            bgColor: stats.exception > 0 ? 'bg-red-50' : 'bg-gray-50',
            onClick: () => onFilterChange?.('status', 'exception'),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map((stat) => (
                    <Card
                        key={stat.title}
                        className={`cursor-pointer transition-all hover:shadow-md ${stat.urgent && stat.value > 0 ? 'ring-2 ring-red-200 animate-pulse' : ''
                            }`}
                        onClick={stat.onClick}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                {stat.title}
                                {stat.urgent && stat.value > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        Urgent
                                    </Badge>
                                )}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-md ${stat.bgColor}`}>
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                                <div className={`text-2xl font-bold ${stat.color}`}>
                                    {stat.value}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-yellow-600">
                                {stats.pending}
                            </div>
                            <Clock className="h-4 w-4 text-yellow-600" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Awaiting pickup
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">In Transit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.inTransit}
                            </div>
                            <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            On the way
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-green-600">
                                {deliveryRate}%
                            </div>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${deliveryRate}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.delivered} of {stats.total} delivered
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-gray-600">
                                {stats.cancelled}
                            </div>
                            <AlertCircle className="h-4 w-4 text-gray-600" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Cancelled shipments
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity Feed */}
            {stats.recentActivity && stats.recentActivity.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Recent Activity
                        </CardTitle>
                        <CardDescription>
                            Latest shipment events from the past 7 days
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.recentActivity.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="flex-shrink-0">
                                        {activity.type === 'created' && (
                                            <div className="p-1 bg-blue-100 rounded-full">
                                                <Package className="h-3 w-3 text-blue-600" />
                                            </div>
                                        )}
                                        {activity.type === 'delivered' && (
                                            <div className="p-1 bg-green-100 rounded-full">
                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                            </div>
                                        )}
                                        {activity.type === 'status_change' && (
                                            <div className="p-1 bg-orange-100 rounded-full">
                                                <Truck className="h-3 w-3 text-orange-600" />
                                            </div>
                                        )}
                                        {activity.type === 'api_sync' && (
                                            <div className="p-1 bg-purple-100 rounded-full">
                                                <RefreshCw className="h-3 w-3 text-purple-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {activity.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">
                                                {activity.internalTrackingCode}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                                {new Date(activity.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-shrink-0 h-8 w-8 p-0"
                                        onClick={() => onFilterChange?.('shipment', activity.shipmentId)}
                                    >
                                        <Package className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {stats.recentActivity.length === 10 && (
                            <div className="mt-4 text-center">
                                <Button variant="outline" size="sm">
                                    View All Activity
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Refresh Button */}
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Stats
                </Button>
            </div>
        </div>
    );
}