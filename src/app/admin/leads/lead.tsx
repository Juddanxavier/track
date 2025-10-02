/** @format */

'use client';

import { Lead } from '@/types/lead';
import { User } from '@/types/user';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import DataTable from '@/components/table/DataTable';
import { leadApi } from '@/lib/leadApi';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { AddLeadDialog } from './components/AddLeadDialog';
import { EditLeadDialog } from './components/EditLeadDialog';
import { DeleteLeadDialog } from './components/DeleteLeadDialog';
import { ConvertLeadDialog } from './components/ConvertLeadDialog';
import { CustomerSyncDialog } from './components/CustomerSyncDialog';
import { ViewLeadDialog } from './components/ViewLeadDialog';
import { CleanupConfigDialog } from './components/CleanupConfigDialog';
import { ArchivedLeadsView } from './components/ArchivedLeadsView';
import { CleanupLogView } from './components/CleanupLogView';
import { ManualCleanupDialog } from './components/ManualCleanupDialog';
import { createLeadColumns } from './leadColumns';
import LeadFilters, { LeadFilters as LeadFiltersType } from './components/LeadFilters';
import { Button } from '@/components/ui/button';
import { Settings, Archive, FileText, Trash2 } from 'lucide-react';

export default function LeadManagement() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [operationLoading] = useState<string | null>(null);
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [filters, setFilters] = useState<LeadFiltersType>({
        search: '',
        status: [],
        originCountry: '',
        destinationCountry: '',
        assignedTo: '',
        dateFrom: undefined,
        dateTo: undefined,
    });

    // Debounce search to avoid excessive API calls
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({
        page: 1,
        perPage: 50,
        total: 0,
        totalPages: 0,
    });

    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [viewingLead, setViewingLead] = useState<Lead | null>(null);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);

    // Cleanup management dialog states
    const [showCleanupConfig, setShowCleanupConfig] = useState(false);
    const [showArchivedLeads, setShowArchivedLeads] = useState(false);
    const [showCleanupLog, setShowCleanupLog] = useState(false);
    const [showManualCleanup, setShowManualCleanup] = useState(false);
    const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
    const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
    const [syncingLead, setSyncingLead] = useState<Lead | null>(null);

    const loadUsers = async () => {
        // Skip if already loaded to avoid unnecessary API calls
        if (usersLoaded) return;

        try {
            const response = await userApi.getUsers({ perPage: 100 }); // Get first 100 users

            // Create user map for quick lookup
            const map = new Map<string, string>();
            response.users.forEach(user => {
                map.set(user.id, user.name);
            });
            setUserMap(map);
            setUsersLoaded(true);
        } catch (error) {
            console.error('Failed to load users:', error);
            toast.error('Failed to load user information', {
                description: 'Some features may not work properly. Please refresh the page.',
            });
        }
    };

    const loadLeads = useCallback(async (page = 1, currentFilters = filters) => {
        try {
            setLoading(true);
            const params: any = {
                page,
                perPage: pagination.perPage,
                sortBy: 'createdAt',
                sortDir: 'desc',
            };

            // Add search query
            if (currentFilters.search) {
                params.q = currentFilters.search;
            }

            // Add status filter
            if (currentFilters.status.length > 0) {
                params.status = currentFilters.status.join(',');
            }

            // Add country filters
            if (currentFilters.originCountry) {
                params.originCountry = currentFilters.originCountry;
            }
            if (currentFilters.destinationCountry) {
                params.destinationCountry = currentFilters.destinationCountry;
            }

            // Add assigned to filter
            if (currentFilters.assignedTo) {
                if (currentFilters.assignedTo === 'unassigned') {
                    params.assignedTo = 'null'; // Special value to indicate unassigned leads
                } else {
                    params.assignedTo = currentFilters.assignedTo;
                }
            }

            // Add date range filters
            if (currentFilters.dateFrom) {
                params.dateFrom = currentFilters.dateFrom.toISOString().split('T')[0];
            }
            if (currentFilters.dateTo) {
                params.dateTo = currentFilters.dateTo.toISOString().split('T')[0];
            }

            const response = await leadApi.getLeads(params);

            setLeads(response.leads);
            setPagination(response.pagination);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            toast.error('Failed to load leads', {
                description: errorMessage.includes('Unauthorized')
                    ? 'You do not have permission to view leads'
                    : 'Please try again or contact support if the problem persists',
            });
            console.error('Error loading leads:', error);

            // Reset to empty state on error
            setLeads([]);
            setPagination({
                page: 1,
                perPage: pagination.perPage,
                total: 0,
                totalPages: 0,
            });
        } finally {
            setLoading(false);
        }
    }, [pagination.perPage]);

    useEffect(() => {
        loadLeads();
        loadUsers();
    }, []);

    // Reload leads when debounced search changes
    useEffect(() => {
        // Only reload if the debounced search is different from current search
        // and we're not on the initial load
        if (debouncedSearch !== filters.search && usersLoaded) {
            const updatedFilters = { ...filters, search: debouncedSearch };
            loadLeads(1, updatedFilters);
        }
    }, [debouncedSearch, usersLoaded]);



    const handleFiltersChange = useCallback((newFilters: LeadFiltersType) => {
        setFilters(newFilters);

        // If only search changed, let debounce handle it
        if (newFilters.search !== filters.search &&
            JSON.stringify({ ...newFilters, search: '' }) === JSON.stringify({ ...filters, search: '' })) {
            return;
        }

        // For other filter changes, reload immediately
        loadLeads(1, newFilters);
    }, [loadLeads]);

    const handleViewLead = (lead: Lead) => {
        setViewingLead(lead);
    };

    const handleEditLead = (lead: Lead) => {
        setEditingLead(lead);
    };

    const handleDeleteLead = (lead: Lead) => {
        setDeletingLead(lead);
    };

    const handleConvertLead = (lead: Lead) => {
        setConvertingLead(lead);
    };

    const handleSyncCustomer = (lead: Lead) => {
        setSyncingLead(lead);
    };

    const columns = useMemo(() => createLeadColumns({
        onView: handleViewLead,
        onEdit: handleEditLead,
        onDelete: handleDeleteLead,
        onConvert: handleConvertLead,
        onSyncCustomer: handleSyncCustomer,
        operationLoading,
        userMap,
    }), [operationLoading, userMap]);

    return (
        <div className='w-full flex flex-col items-start gap-4'>
            <div className='w-full'>
                <LeadFilters
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onAdd={() => setShowAddDialog(true)}
                    addLabel='Add Lead'
                    title={`Leads (${pagination.total})`}
                    isLoading={loading}
                />
            </div>

            {/* Cleanup Management Section */}
            <div className='w-full'>
                <div className='rounded-md border border-border bg-card p-3 shadow-sm'>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <h4 className='text-sm font-medium text-muted-foreground'>
                            Lead Lifecycle Management
                        </h4>
                        <div className='flex items-center gap-2 flex-wrap'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setShowCleanupConfig(true)}
                            >
                                <Settings className='h-4 w-4 mr-2' />
                                Configuration
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setShowArchivedLeads(true)}
                            >
                                <Archive className='h-4 w-4 mr-2' />
                                Archived Leads
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setShowCleanupLog(true)}
                            >
                                <FileText className='h-4 w-4 mr-2' />
                                Cleanup Log
                            </Button>
                            <Button
                                variant='destructive'
                                size='sm'
                                onClick={() => setShowManualCleanup(true)}
                            >
                                <Trash2 className='h-4 w-4 mr-2' />
                                Manual Cleanup
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <DataTable<Lead, unknown>
                data={leads}
                columns={columns as any}
                initialPageSize={pagination.perPage}
                height={600}
                headerClassName='bg-muted'
                globalFilter={filters.search}
                onGlobalFilterChange={(value) => handleFiltersChange({ ...filters, search: value })}
                isLoading={loading}
            />

            {/* Lead Management Dialogs */}
            <AddLeadDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setShowAddDialog(false);
                    // Then reload data
                    loadLeads(pagination.page, filters);
                }}
            />

            <ViewLeadDialog
                lead={viewingLead}
                open={!!viewingLead}
                onOpenChange={(open) => !open && setViewingLead(null)}
                userMap={userMap}
            />

            <EditLeadDialog
                lead={editingLead}
                open={!!editingLead}
                onOpenChange={(open) => !open && setEditingLead(null)}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setEditingLead(null);
                    // Then reload data
                    loadLeads(pagination.page, filters);
                }}
            />

            <DeleteLeadDialog
                lead={deletingLead}
                open={!!deletingLead}
                onOpenChange={(open) => !open && setDeletingLead(null)}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setDeletingLead(null);
                    // Then reload data
                    loadLeads(pagination.page, filters);
                }}
            />

            <ConvertLeadDialog
                lead={convertingLead}
                open={!!convertingLead}
                onOpenChange={(open) => !open && setConvertingLead(null)}
                onSuccess={() => {
                    loadLeads(pagination.page, filters);
                    setConvertingLead(null);
                }}
            />

            <CustomerSyncDialog
                lead={syncingLead}
                open={!!syncingLead}
                onOpenChange={(open) => !open && setSyncingLead(null)}
                onSuccess={() => {
                    loadLeads(pagination.page, filters);
                    setSyncingLead(null);
                }}
            />

            {/* Cleanup Management Dialogs */}
            <CleanupConfigDialog
                open={showCleanupConfig}
                onOpenChange={setShowCleanupConfig}
                onConfigUpdated={() => {
                    // Optionally refresh data or show success message
                    toast.success('Cleanup configuration updated');
                }}
            />

            <ArchivedLeadsView
                open={showArchivedLeads}
                onOpenChange={setShowArchivedLeads}
            />

            <CleanupLogView
                open={showCleanupLog}
                onOpenChange={setShowCleanupLog}
            />

            <ManualCleanupDialog
                open={showManualCleanup}
                onOpenChange={setShowManualCleanup}
                onCleanupCompleted={() => {
                    // Refresh leads data after cleanup
                    loadLeads(pagination.page, filters);
                    toast.success('Cleanup completed successfully');
                }}
            />
        </div>
    );
}