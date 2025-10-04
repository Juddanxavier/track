/** @format */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Package,
    Users,
    UserCheck,
    UserX,
    Link,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    RefreshCw,
    Clock
} from 'lucide-react';
import { useAssignmentStats } from '@/hooks/useAssignmentStats';
import { AssignmentStats } from '@/types/shipment';

interface AssignmentStatsDashboardProps {
    onFilterChange?: (filter: string, value: string) => void;
}

export function AssignmentStatsDashboard({ onFilterChange }: AssignmentStatsDashboardProps) {
    const { stats, loading, error, refetch } = useAssignmentStats();

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

    const trackingCompletionRate = getCompletionPercentage(
        stats.totalShipments - stats.unassignedTracking,
        stats.totalShipments
    );

    const userAssignmentRate = getCompletionPercentage(
        stats.totalShipments - stats.unassignedUsers,
        stats.totalShipments
    );

    const overallCompletionRate = getCompletionPercentage(
        stats.fullyAssigned,
        stats.totalShipments
    );

    const needsAttention = stats.unassignedTracking + stats.unassignedUsers;

    const statCards = [
        {
            title: 'Total Shipments',
            value: stats.totalShipments,
            icon: Package,
            description: 'All shipments in system',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            onClick: () => onFilterChange?.('all', 'true'),
        },
        {
            title: 'Needs Attention',
            value: needsAttention,
            icon: AlertCircle,
            description: 'Missing assignments',
            color: needsAttention > 0 ? 'text-red-600' : 'text-green-600',
            bgColor: needsAttention > 0 ? 'bg-red-50' : 'bg-green-50',
            onClick: () => onFilterChange?.('assignmentPriority', 'needs_attention'),
            urgent: needsAttention > 0,
        },
        {
            title: 'Missing Tracking',
            value: stats.unassignedTracking,
            icon: Package,
            description: 'No tracking numbers',
            color: stats.unassignedTracking > 0 ? 'text-orange-600' : 'text-green-600',
            bgColor: stats.unassignedTracking > 0 ? 'bg-orange-50' : 'bg-green-50',
            onClick: () => onFilterChange?.('assignmentPriority', 'unassigned_tracking'),
        },
        {
            title: 'Missing Users',
            value: stats.unassignedUsers,
            icon: UserX,
            description: 'No user assignments',
            color: stats.unassignedUsers > 0 ? 'text-orange-600' : 'text-green-600',
            bgColor: stats.unassignedUsers > 0 ? 'bg-orange-50' : 'bg-green-50',
            onClick: () => onFilterChange?.('assignmentPriority', 'unassigned_users'),
        },
        {
            title: 'Pending Signups',
            value: stats.pendingSignups,
            icon: Link,
            description: 'Signup links sent',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            onClick: () => onFilterChange?.('assignmentPriority', 'pending_signups'),
        },
        {
            title: 'Fully Assigned',
            value: stats.fullyAssigned,
            icon: CheckCircle,
            description: 'Complete assignments',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            onClick: () => onFilterChange?.('assignmentPriority', 'fully_assigned'),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map((stat) => (
                    <Card
                        key={stat.title}
                        className={`cursor-pointer transition-all hover:shadow-md ${stat.urgent ? 'ring-2 ring-red-200 animate-pulse' : ''
                            }`}
                        onClick={stat.onClick}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                {stat.title}
                                {stat.urgent && (
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

            {/* Completion Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Tracking Assignment Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-blue-600">
                                {trackingCompletionRate}%
                            </div>
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${trackingCompletionRate}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalShipments - stats.unassignedTracking} of {stats.totalShipments} assigned
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">User Assignment Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-green-600">
                                {userAssignmentRate}%
                            </div>
                            <Users className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${userAssignmentRate}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalShipments - stats.unassignedUsers} of {stats.totalShipments} assigned
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Overall Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-purple-600">
                                {overallCompletionRate}%
                            </div>
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${overallCompletionRate}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.fullyAssigned} of {stats.totalShipments} fully assigned
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            {stats.recentlyIngested > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Recent Activity (Last 24 Hours)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-sm">
                                {stats.recentlyIngested} new shipments ingested
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onFilterChange?.('recent', 'true')}
                            >
                                View Recent
                            </Button>
                        </div>
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