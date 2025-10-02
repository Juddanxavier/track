/** @format */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { CleanupLogEntry, CleanupLogResponse } from '@/types/lead';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Archive } from 'lucide-react';

interface CleanupLogViewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CleanupLogView({ open, onOpenChange }: CleanupLogViewProps) {
    const [logEntries, setLogEntries] = useState<CleanupLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        perPage: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
    });

    useEffect(() => {
        if (open) {
            fetchCleanupLog();
        }
    }, [open, pagination.page]);

    const fetchCleanupLog = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                perPage: pagination.perPage.toString(),
            });

            const response = await fetch(`/api/lead/cleanup/log?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch cleanup log');
            }

            const data: CleanupLogResponse = await response.json();
            setLogEntries(data.entries);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error fetching cleanup log:', error);
            toast.error('Failed to load cleanup log');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'deleted':
                return <Trash2 className="h-4 w-4 text-red-500" />;
            case 'archived':
                return <Archive className="h-4 w-4 text-blue-500" />;
            default:
                return null;
        }
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'deleted':
                return <Badge variant="destructive">Deleted</Badge>;
            case 'archived':
                return <Badge variant="secondary">Archived</Badge>;
            default:
                return <Badge variant="outline">{action}</Badge>;
        }
    };

    const columns: ColumnDef<CleanupLogEntry>[] = [
        {
            accessorKey: 'action',
            header: 'Action',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {getActionIcon(row.original.action)}
                    {getActionBadge(row.original.action)}
                </div>
            ),
        },
        {
            accessorKey: 'leadId',
            header: 'Lead ID',
            cell: ({ row }) => (
                <code className="text-sm bg-muted px-2 py-1 rounded">
                    {row.original.leadId}
                </code>
            ),
        },
        {
            accessorKey: 'reason',
            header: 'Reason',
            cell: ({ row }) => (
                <div className="max-w-xs truncate" title={row.original.reason}>
                    {row.original.reason}
                </div>
            ),
        },
        {
            accessorKey: 'performedAt',
            header: 'Performed At',
            cell: ({ row }) => (
                <div>
                    <div className="text-sm">
                        {new Date(row.original.performedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(row.original.performedAt), {
                            addSuffix: true,
                        })}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'leadData',
            header: 'Lead Data',
            cell: ({ row }) => (
                <div>
                    {row.original.leadData ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                try {
                                    const leadData = JSON.parse(row.original.leadData!);
                                    const formattedData = JSON.stringify(leadData, null, 2);
                                    navigator.clipboard.writeText(formattedData);
                                    toast.success('Lead data copied to clipboard');
                                } catch (error) {
                                    toast.error('Failed to parse lead data');
                                }
                            }}
                        >
                            View Data
                        </Button>
                    ) : (
                        <span className="text-muted-foreground text-sm">No data</span>
                    )}
                </div>
            ),
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Cleanup Audit Log</DialogTitle>
                    <DialogDescription>
                        View the history of all lead cleanup actions including deletions and archival.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <DataTable
                        columns={columns}
                        data={logEntries}
                        isLoading={loading}
                        initialPageSize={pagination.perPage}
                        height={400}
                    />

                    {/* Custom Pagination */}
                    <div className="flex items-center justify-between px-2 py-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Showing {((pagination.page - 1) * pagination.perPage) + 1} to{' '}
                            {Math.min(pagination.page * pagination.perPage, pagination.total)} of{' '}
                            {pagination.total} entries
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(1)}
                                disabled={!pagination.hasPrev}
                            >
                                First
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                            >
                                Previous
                            </Button>
                            <span className="text-sm">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasNext}
                            >
                                Next
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.totalPages)}
                                disabled={!pagination.hasNext}
                            >
                                Last
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        Total entries: {pagination.total}
                    </div>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}