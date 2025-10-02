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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { ArchivedLead, ArchivedLeadListResponse } from '@/types/lead';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ArchivedLeadsViewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ArchivedLeadsView({ open, onOpenChange }: ArchivedLeadsViewProps) {
    const [archivedLeads, setArchivedLeads] = useState<ArchivedLead[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
    });
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        fromDate: '',
        toDate: '',
    });

    useEffect(() => {
        if (open) {
            fetchArchivedLeads();
        }
    }, [open, pagination.page, filters]);

    const fetchArchivedLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                perPage: pagination.perPage.toString(),
                ...(filters.search && { search: filters.search }),
                ...(filters.status && { status: filters.status }),
                ...(filters.fromDate && { fromDate: filters.fromDate }),
                ...(filters.toDate && { toDate: filters.toDate }),
            });

            const response = await fetch(`/api/lead/archive?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch archived leads');
            }

            const data: ArchivedLeadListResponse = await response.json();
            setArchivedLeads(data.archivedLeads);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error fetching archived leads:', error);
            toast.error('Failed to load archived leads');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
        }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const columns: ColumnDef<ArchivedLead>[] = [
        {
            accessorKey: 'customerName',
            header: 'Customer',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.customerName}</div>
                    <div className="text-sm text-muted-foreground">
                        {row.original.customerEmail}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'route',
            header: 'Route',
            cell: ({ row }) => (
                <div className="text-sm">
                    {row.original.originCountry} → {row.original.destinationCountry}
                </div>
            ),
        },
        {
            accessorKey: 'weight',
            header: 'Weight',
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <Badge
                    variant={row.original.status === 'converted' ? 'default' : 'secondary'}
                >
                    {row.original.status}
                </Badge>
            ),
        },
        {
            accessorKey: 'archivedAt',
            header: 'Archived',
            cell: ({ row }) => (
                <div className="text-sm">
                    {formatDistanceToNow(new Date(row.original.archivedAt), {
                        addSuffix: true,
                    })}
                </div>
            ),
        },
        {
            accessorKey: 'createdAt',
            header: 'Created',
            cell: ({ row }) => (
                <div className="text-sm">
                    {new Date(row.original.createdAt).toLocaleDateString()}
                </div>
            ),
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Archived Leads</DialogTitle>
                    <DialogDescription>
                        View and search through archived successful leads.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="search">Search</Label>
                            <Input
                                id="search"
                                placeholder="Customer name, email, country..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={filters.status}
                                onValueChange={(value) => handleFilterChange('status', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All statuses</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="converted">Converted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="fromDate">From Date</Label>
                            <Input
                                id="fromDate"
                                type="date"
                                value={filters.fromDate}
                                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="toDate">To Date</Label>
                            <Input
                                id="toDate"
                                type="date"
                                value={filters.toDate}
                                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <DataTable
                            columns={columns}
                            data={archivedLeads}
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
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}