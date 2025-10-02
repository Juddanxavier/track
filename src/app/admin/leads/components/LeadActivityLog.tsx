/** @format */

'use client';

import { useState, useEffect } from 'react';
import { LeadActivity } from '@/types/lead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Activity,
    User,
    Edit,
    ArrowRightLeft,
    CheckCircle,
    Trash2,
    Plus,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LeadActivityLogProps {
    leadId: string;
    className?: string;
}

export function LeadActivityLog({ leadId, className }: LeadActivityLogProps) {
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        perPage: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
    });

    const loadActivities = async (page = 1) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/lead/${leadId}/activities?page=${page}&perPage=${pagination.perPage}`);

            if (!response.ok) {
                throw new Error('Failed to fetch activities');
            }

            const data = await response.json();
            setActivities(data.activities);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error loading activities:', error);
            toast.error('Failed to load activity log');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (leadId) {
            loadActivities();
        }
    }, [leadId]);

    const handlePageChange = (newPage: number) => {
        loadActivities(newPage);
    };

    const getActivityIcon = (action: string) => {
        switch (action) {
            case 'created':
                return <Plus className='h-4 w-4 text-green-600' />;
            case 'updated':
                return <Edit className='h-4 w-4 text-blue-600' />;
            case 'status_changed':
                return <ArrowRightLeft className='h-4 w-4 text-orange-600' />;
            case 'assigned':
                return <User className='h-4 w-4 text-purple-600' />;
            case 'converted':
                return <CheckCircle className='h-4 w-4 text-green-600' />;
            case 'deleted':
                return <Trash2 className='h-4 w-4 text-red-600' />;
            default:
                return <Activity className='h-4 w-4 text-gray-600' />;
        }
    };

    const getActivityBadgeVariant = (action: string) => {
        switch (action) {
            case 'created':
                return 'default';
            case 'updated':
                return 'secondary';
            case 'status_changed':
                return 'outline';
            case 'assigned':
                return 'secondary';
            case 'converted':
                return 'default';
            case 'deleted':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    const formatActivityAction = (action: string) => {
        switch (action) {
            case 'created':
                return 'Created';
            case 'updated':
                return 'Updated';
            case 'status_changed':
                return 'Status Changed';
            case 'assigned':
                return 'Assigned';
            case 'converted':
                return 'Converted';
            case 'deleted':
                return 'Deleted';
            default:
                return action;
        }
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(new Date(date));
    };

    if (loading && activities.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        <Activity className='h-5 w-5' />
                        Activity Log
                    </CardTitle>
                    <CardDescription>
                        Track all changes and actions performed on this lead
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className='flex items-center justify-center py-8'>
                        <Loader2 className='h-6 w-6 animate-spin' />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Activity Log
                </CardTitle>
                <CardDescription>
                    Track all changes and actions performed on this lead ({pagination.total} total activities)
                </CardDescription>
            </CardHeader>
            <CardContent>
                {activities.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                        No activities found for this lead
                    </div>
                ) : (
                    <>
                        <ScrollArea className='h-[400px] pr-4'>
                            <div className='space-y-4'>
                                {activities.map((activity, index) => (
                                    <div key={activity.id}>
                                        <div className='flex items-start gap-3'>
                                            <div className='flex-shrink-0 mt-1'>
                                                {getActivityIcon(activity.action)}
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2 mb-1'>
                                                    <Badge variant={getActivityBadgeVariant(activity.action) as any}>
                                                        {formatActivityAction(activity.action)}
                                                    </Badge>
                                                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                                                        <Clock className='h-3 w-3' />
                                                        {formatDate(activity.createdAt)}
                                                    </div>
                                                </div>
                                                <p className='text-sm text-foreground mb-1'>
                                                    {activity.description}
                                                </p>
                                                {activity.user && (
                                                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                                                        <User className='h-3 w-3' />
                                                        <span>by {activity.user.name}</span>
                                                    </div>
                                                )}
                                                {activity.field && activity.oldValue && activity.newValue && (
                                                    <div className='mt-2 p-2 bg-muted rounded-md text-xs'>
                                                        <div className='font-medium mb-1'>Field: {activity.field}</div>
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-red-600'>- {activity.oldValue}</span>
                                                            <ArrowRightLeft className='h-3 w-3 text-muted-foreground' />
                                                            <span className='text-green-600'>+ {activity.newValue}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {activity.metadata && (
                                                    <details className='mt-2'>
                                                        <summary className='text-xs text-muted-foreground cursor-pointer hover:text-foreground'>
                                                            View metadata
                                                        </summary>
                                                        <pre className='mt-1 p-2 bg-muted rounded-md text-xs overflow-x-auto'>
                                                            {JSON.stringify(JSON.parse(activity.metadata), null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                        {index < activities.length - 1 && (
                                            <Separator className='my-4' />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className='flex items-center justify-between mt-4 pt-4 border-t'>
                                <div className='text-sm text-muted-foreground'>
                                    Page {pagination.page} of {pagination.totalPages}
                                </div>
                                <div className='flex items-center gap-2'>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={!pagination.hasPrev || loading}
                                    >
                                        <ChevronLeft className='h-4 w-4' />
                                        Previous
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={!pagination.hasNext || loading}
                                    >
                                        Next
                                        <ChevronRight className='h-4 w-4' />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}