/** @format */

'use client';

import { Shipment } from '@/types/shipment';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import DataTable from '@/components/table/DataTable';
import { shipmentApi } from '@/lib/shipmentApi';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { AddShipmentDialog } from './components/AddShipmentDialog';
import { EditShipmentDialog } from './components/EditShipmentDialog';
import { DeleteShipmentDialog } from './components/DeleteShipmentDialog';
import { ManualStatusUpdateDialog } from './components/ManualStatusUpdateDialog';
import { ShipmentDetailsModal } from './components/ShipmentDetailsModal';

import { createShipmentColumns } from './shipmentColumns';
import ShipmentFilters, { ShipmentFilters as ShipmentFiltersType } from './components/ShipmentFilters';
import { ShipmentStatsDashboard } from './components/ShipmentStatsDashboard';

export default function ShipmentManagement() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [operationLoading] = useState<string | null>(null);
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    const [usersLoaded, setUsersLoaded] = useState(false);

    // Initialize filters from URL parameters
    const [filters, setFilters] = useState<ShipmentFiltersType>(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlStatus = searchParams.get('status')?.split(',').filter(Boolean) || [];
        const urlCarrier = searchParams.get('carrier')?.split(',').filter(Boolean) || [];
        const urlApiSyncStatus = searchParams.get('apiSyncStatus')?.split(',').filter(Boolean) || [];
        const urlNeedsReview = searchParams.get('needsReview') === 'true';
        const urlDateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
        const urlDateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;
        const urlDeliveryFrom = searchParams.get('deliveryFrom') ? new Date(searchParams.get('deliveryFrom')!) : undefined;
        const urlDeliveryTo = searchParams.get('deliveryTo') ? new Date(searchParams.get('deliveryTo')!) : undefined;

        return {
            search: urlSearch,
            status: urlStatus,
            carrier: urlCarrier,
            apiSyncStatus: urlApiSyncStatus,
            needsReview: urlNeedsReview,
            dateFrom: urlDateFrom,
            dateTo: urlDateTo,
            deliveryFrom: urlDeliveryFrom,
            deliveryTo: urlDeliveryTo,
        };
    });

    // Use ref to track current filters for stable references
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    // Debounce search to avoid excessive API calls
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({
        page: 1,
        perPage: 50,
        total: 0,
        totalPages: 0,
    });

    // Function to update URL with current filter state
    const updateURL = useCallback((newFilters: ShipmentFiltersType) => {
        const params = new URLSearchParams();

        if (newFilters.search) {
            params.set('search', newFilters.search);
        }
        if (newFilters.status.length > 0) {
            params.set('status', newFilters.status.join(','));
        }
        if (newFilters.carrier.length > 0) {
            params.set('carrier', newFilters.carrier.join(','));
        }
        if (newFilters.apiSyncStatus.length > 0) {
            params.set('apiSyncStatus', newFilters.apiSyncStatus.join(','));
        }
        if (newFilters.needsReview) {
            params.set('needsReview', 'true');
        }
        if (newFilters.dateFrom) {
            params.set('dateFrom', newFilters.dateFrom.toISOString().split('T')[0]);
        }
        if (newFilters.dateTo) {
            params.set('dateTo', newFilters.dateTo.toISOString().split('T')[0]);
        }
        if (newFilters.deliveryFrom) {
            params.set('deliveryFrom', newFilters.deliveryFrom.toISOString().split('T')[0]);
        }
        if (newFilters.deliveryTo) {
            params.set('deliveryTo', newFilters.deliveryTo.toISOString().split('T')[0]);
        }

        const queryString = params.toString();
        const newUrl = queryString ? `?${queryString}` : window.location.pathname;

        // Use replace to avoid adding to browser history for every filter change
        router.replace(newUrl, { scroll: false });
    }, [router]);

    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
    const [deletingShipment, setDeletingShipment] = useState<Shipment | null>(null);
    const [updatingStatusShipment, setUpdatingStatusShipment] = useState<Shipment | null>(null);
    const [syncingShipment, setSyncingShipment] = useState<Shipment | null>(null);

    // Bulk selection state
    const [selectedShipments, setSelectedShipments] = useState<string[]>([]);

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

    const loadShipments = useCallback(async (page = 1, currentFilters = filters) => {
        try {
            setLoading(true);
            const params: any = {
                page,
                perPage: pagination.perPage,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            };

            // Add search query
            if (currentFilters.search) {
                params.q = currentFilters.search;
            }

            // Add status filter
            if (currentFilters.status.length > 0) {
                params.status = currentFilters.status.join(',');
            }

            // Add carrier filter
            if (currentFilters.carrier.length > 0) {
                params.carrier = currentFilters.carrier.join(',');
            }

            // Add API sync status filter
            if (currentFilters.apiSyncStatus.length > 0) {
                params.apiSyncStatus = currentFilters.apiSyncStatus.join(',');
            }

            // Add needs review filter
            if (currentFilters.needsReview) {
                params.needsReview = 'true';
            }

            // Add date range filters
            if (currentFilters.dateFrom) {
                params.dateStart = currentFilters.dateFrom.toISOString().split('T')[0];
            }
            if (currentFilters.dateTo) {
                params.dateEnd = currentFilters.dateTo.toISOString().split('T')[0];
            }

            // Add delivery date range filters
            if (currentFilters.deliveryFrom) {
                params.deliveryStart = currentFilters.deliveryFrom.toISOString().split('T')[0];
            }
            if (currentFilters.deliveryTo) {
                params.deliveryEnd = currentFilters.deliveryTo.toISOString().split('T')[0];
            }

            const response = await shipmentApi.getShipments(params);

            setShipments(response.shipments);
            setPagination(response.pagination);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            toast.error('Failed to load shipments', {
                description: errorMessage.includes('Unauthorized')
                    ? 'You do not have permission to view shipments'
                    : 'Please try again or contact support if the problem persists',
            });
            console.error('Error loading shipments:', error);

            // Reset to empty state on error
            setShipments([]);
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
        loadShipments();
        loadUsers();
    }, []);

    // Reload shipments when debounced search changes
    useEffect(() => {
        // Only reload if the debounced search is different from current search
        // and we're not on the initial load
        if (debouncedSearch !== filtersRef.current.search && usersLoaded) {
            const updatedFilters = { ...filtersRef.current, search: debouncedSearch };
            setFilters(updatedFilters);
            updateURL(updatedFilters);
            loadShipments(1, updatedFilters);
        }
    }, [debouncedSearch, usersLoaded, updateURL, loadShipments]);

    const handleFiltersChange = useCallback((newFilters: ShipmentFiltersType) => {
        setFilters(newFilters);

        // Update URL with new filter state
        updateURL(newFilters);

        // If only search changed, let debounce handle it
        if (newFilters.search !== filtersRef.current.search &&
            JSON.stringify({ ...newFilters, search: '' }) === JSON.stringify({ ...filtersRef.current, search: '' })) {
            return;
        }

        // For other filter changes, reload immediately
        loadShipments(1, newFilters);
    }, [loadShipments, updateURL]);

    const handleViewShipment = (shipment: Shipment) => {
        setViewingShipment(shipment);
    };

    const handleEditShipment = (shipment: Shipment) => {
        setEditingShipment(shipment);
    };

    const handleDeleteShipment = (shipment: Shipment) => {
        setDeletingShipment(shipment);
    };

    const handleUpdateStatus = (shipment: Shipment) => {
        setUpdatingStatusShipment(shipment);
    };

    const handleManualSync = async (shipment: Shipment) => {
        try {
            setSyncingShipment(shipment);
            const response = await fetch(`/api/shipments/${shipment.id}/sync`, {
                method: 'POST',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to sync shipment');
            }

            toast.success('Shipment synced successfully');
            loadShipments(pagination.page, filters);
        } catch (error) {
            console.error('Error syncing shipment:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to sync shipment');
        } finally {
            setSyncingShipment(null);
        }
    };

    // Bulk action handlers
    const handleBulkSync = async () => {
        if (selectedShipments.length === 0) {
            toast.error('Please select shipments to sync');
            return;
        }

        try {
            const response = await fetch('/api/shipments/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shipmentIds: selectedShipments,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to sync shipments');
            }

            const result = await response.json();
            toast.success(`Synced ${result.successful} shipments successfully`);
            setSelectedShipments([]);
            loadShipments(pagination.page, filters);
        } catch (error) {
            console.error('Error syncing shipments:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to sync shipments');
        }
    };

    const columns = useMemo(() => createShipmentColumns({
        onView: handleViewShipment,
        onEdit: handleEditShipment,
        onDelete: handleDeleteShipment,
        onUpdateStatus: handleUpdateStatus,
        onManualSync: handleManualSync,
        operationLoading: syncingShipment?.id || operationLoading,
        userMap,
    }), [syncingShipment, operationLoading, userMap]);

    const handleStatsFilterChange = (filterType: string, value: string) => {
        const newFilters: ShipmentFiltersType = { ...filters };

        switch (filterType) {
            case 'status':
                if (value === 'active') {
                    newFilters.status = ['pending', 'in-transit', 'out-for-delivery'];
                } else {
                    newFilters.status = [value];
                }
                break;
            case 'needsReview':
                newFilters.needsReview = value === 'true';
                break;
            case 'all':
                // Clear all filters to show all shipments
                newFilters.search = '';
                newFilters.status = [];
                newFilters.carrier = [];
                newFilters.apiSyncStatus = [];
                newFilters.needsReview = false;
                newFilters.dateFrom = undefined;
                newFilters.dateTo = undefined;
                newFilters.deliveryFrom = undefined;
                newFilters.deliveryTo = undefined;
                break;
            case 'recent':
                // Show shipments from last 24 hours
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                newFilters.dateFrom = yesterday;
                break;
        }

        handleFiltersChange(newFilters);
    };

    return (
        <div className='w-full flex flex-col items-start gap-6'>
            {/* Shipment Statistics Dashboard */}
            <div className='w-full'>
                <ShipmentStatsDashboard onFilterChange={handleStatsFilterChange} />
            </div>

            <div className='w-full'>
                <ShipmentFilters
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onAdd={() => setShowAddDialog(true)}
                    addLabel='Add Shipment'
                    title={`Shipments (${pagination.total})`}
                    isLoading={loading}
                />
            </div>

            {/* Bulk Actions Bar */}
            {selectedShipments.length > 0 && (
                <div className='flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                    <div className='flex items-center gap-2'>
                        <span className='text-sm font-medium text-blue-800'>
                            {selectedShipments.length} shipment{selectedShipments.length > 1 ? 's' : ''} selected
                        </span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button
                            size='sm'
                            variant='outline'
                            onClick={handleBulkSync}
                            className='text-blue-700 border-blue-300 hover:bg-blue-100'
                        >
                            <RefreshCw className='h-4 w-4 mr-2' />
                            Bulk Sync
                        </Button>
                        <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => setSelectedShipments([])}
                            className='text-blue-700 hover:bg-blue-100'
                        >
                            Clear Selection
                        </Button>
                    </div>
                </div>
            )}

            <DataTable<Shipment, unknown>
                data={shipments}
                columns={columns as any}
                initialPageSize={pagination.perPage}
                height={600}
                headerClassName='bg-muted'
                globalFilter={filters.search}
                onGlobalFilterChange={(value) => handleFiltersChange({ ...filtersRef.current, search: value })}
                isLoading={loading}
                emptyMessage="No shipments found. Create your first shipment to get started."
            />

            {/* Shipment Management Dialogs */}
            <AddShipmentDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setShowAddDialog(false);
                    // Then reload data
                    loadShipments(pagination.page, filters);
                }}
            />

            <ShipmentDetailsModal
                shipment={viewingShipment}
                open={!!viewingShipment}
                onOpenChange={(open: boolean) => !open && setViewingShipment(null)}
                onSuccess={() => {
                    // Reload data to reflect any changes
                    loadShipments(pagination.page, filters);
                }}
            />

            <EditShipmentDialog
                shipment={editingShipment}
                open={!!editingShipment}
                onOpenChange={(open: boolean) => !open && setEditingShipment(null)}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setEditingShipment(null);
                    // Then reload data
                    loadShipments(pagination.page, filters);
                }}
            />

            <DeleteShipmentDialog
                shipment={deletingShipment}
                open={!!deletingShipment}
                onOpenChange={(open: boolean) => !open && setDeletingShipment(null)}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setDeletingShipment(null);
                    // Then reload data
                    loadShipments(pagination.page, filters);
                }}
            />

            <ManualStatusUpdateDialog
                shipment={updatingStatusShipment}
                open={!!updatingStatusShipment}
                onOpenChange={(open: boolean) => !open && setUpdatingStatusShipment(null)}
                onSuccess={() => {
                    // Optimistically close dialog first for better UX
                    setUpdatingStatusShipment(null);
                    // Then reload data
                    loadShipments(pagination.page, filters);
                }}
            />


        </div>
    );
}