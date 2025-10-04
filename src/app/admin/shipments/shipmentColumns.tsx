/** @format */

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Shipment, ShipmentStatus, ApiSyncStatus } from '@/types/shipment';
import { createColumnHelper } from '@tanstack/react-table';
import HeaderButton from '@/components/table/header-button';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
    EllipsisVertical,
    Eye,
    Edit,
    Trash2,
    Loader2,
    Phone,
    Mail,
    Package,
    Calendar,
    Truck,
    MapPin,
    RefreshCw,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    Clock,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const columnHelper = createColumnHelper<Shipment>();

interface ShipmentColumnsProps {
    onView: (shipment: Shipment) => void;
    onEdit: (shipment: Shipment) => void;
    onDelete: (shipment: Shipment) => void;
    onUpdateStatus: (shipment: Shipment) => void;
    onManualSync?: (shipment: Shipment) => void;
    operationLoading: string | null;
    userMap?: Map<string, string>; // Map from user ID to user name
}

const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case ShipmentStatus.PENDING:
            return 'secondary';
        case ShipmentStatus.IN_TRANSIT:
            return 'default';
        case ShipmentStatus.OUT_FOR_DELIVERY:
            return 'default';
        case ShipmentStatus.DELIVERED:
            return 'default';
        case ShipmentStatus.EXCEPTION:
            return 'destructive';
        case ShipmentStatus.CANCELLED:
            return 'outline';
        default:
            return 'secondary';
    }
};

const getStatusDisplayText = (status: string) => {
    switch (status) {
        case ShipmentStatus.PENDING:
            return 'Pending';
        case ShipmentStatus.IN_TRANSIT:
            return 'In Transit';
        case ShipmentStatus.OUT_FOR_DELIVERY:
            return 'Out for Delivery';
        case ShipmentStatus.DELIVERED:
            return 'Delivered';
        case ShipmentStatus.EXCEPTION:
            return 'Exception';
        case ShipmentStatus.CANCELLED:
            return 'Cancelled';
        default:
            return status;
    }
};

const formatShipmentDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
};

const formatRelativeDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
};

const getApiSyncStatusDisplay = (status: string) => {
    switch (status) {
        case ApiSyncStatus.PENDING:
            return { label: 'Sync Pending', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
        case ApiSyncStatus.SUCCESS:
            return { label: 'Sync Success', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' };
        case ApiSyncStatus.FAILED:
            return { label: 'Sync Failed', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' };
        default:
            return { label: 'Unknown', icon: AlertCircle, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
};

export const createShipmentColumns = ({
    onView,
    onEdit,
    onDelete,
    onUpdateStatus,
    onManualSync,
    operationLoading,
    userMap = new Map()
}: ShipmentColumnsProps) => [
        columnHelper.display({
            id: 'select',
            header: ({ table }) => (
                <div className='h-full flex items-center'>
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && 'indeterminate')
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label='Select all'
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className='h-full flex items-center'>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label='Select row'
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        }),

        columnHelper.accessor('internalTrackingCode', {
            header: (info) => <HeaderButton info={info} name='Tracking Code' />,
            cell: (info) => {
                const shipment = info.row.original;
                return (
                    <div className='min-w-[140px]'>
                        <div className='flex items-center gap-2'>
                            <Package className='h-4 w-4 text-muted-foreground' />
                            <span className='font-mono font-medium'>{info.getValue()}</span>
                        </div>
                        {shipment.carrierTrackingNumber && (
                            <div className='text-xs text-muted-foreground mt-1'>
                                Carrier: {shipment.carrierTrackingNumber}
                            </div>
                        )}
                    </div>
                );
            },
        }),

        columnHelper.accessor('customerName', {
            header: (info) => <HeaderButton info={info} name='Customer' />,
            cell: (info) => {
                const shipment = info.row.original;
                return (
                    <div className='min-w-[200px]'>
                        <div className='flex items-center gap-2'>
                            <span className='font-medium'>{info.getValue()}</span>
                        </div>
                        <div className='flex items-center gap-1 text-xs text-muted-foreground mt-1'>
                            <Mail className='h-3 w-3' />
                            <span className='truncate'>{shipment.customerEmail}</span>
                        </div>
                        {shipment.customerPhone && (
                            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Phone className='h-3 w-3' />
                                <span>{shipment.customerPhone}</span>
                            </div>
                        )}
                    </div>
                );
            },
        }),

        columnHelper.display({
            id: 'route',
            header: 'Route',
            cell: ({ row }) => {
                const shipment = row.original;
                const origin = shipment.originAddress;
                const destination = shipment.destinationAddress;

                return (
                    <div className='min-w-[180px]'>
                        <div className='flex items-center gap-2 text-sm'>
                            <MapPin className='h-3 w-3 text-muted-foreground' />
                            <span className='font-medium'>{origin.city}, {origin.state}</span>
                            <span className='text-muted-foreground'>→</span>
                            <span className='font-medium'>{destination.city}, {destination.state}</span>
                        </div>
                        <div className='text-xs text-muted-foreground mt-1'>
                            {origin.country} → {destination.country}
                        </div>
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.display({
            id: 'syncStatus',
            header: 'API Sync Status',
            cell: ({ row }) => {
                const shipment = row.original;
                const syncStatus = getApiSyncStatusDisplay(shipment.apiSyncStatus);
                const needsReview = shipment.needsReview;
                const hasSyncError = shipment.apiError;

                return (
                    <div className='min-w-[160px] space-y-1'>
                        {/* API Sync Status */}
                        <div className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs ${syncStatus.bgColor}`}>
                            <syncStatus.icon className={`h-3 w-3 ${syncStatus.color}`} />
                            <span className={`font-medium ${syncStatus.color}`}>
                                {syncStatus.label}
                            </span>
                        </div>

                        {/* Last Sync Time */}
                        {shipment.lastApiSync && (
                            <div className='text-xs text-muted-foreground'>
                                Last sync: {formatRelativeDate(shipment.lastApiSync)}
                            </div>
                        )}

                        {/* Error Message */}
                        {hasSyncError && (
                            <div className='text-xs text-red-600 truncate' title={shipment.apiError}>
                                Error: {shipment.apiError}
                            </div>
                        )}

                        {/* Needs Review Indicator */}
                        {needsReview && (
                            <div className='flex items-center gap-1 text-xs text-orange-600'>
                                <AlertCircle className='h-3 w-3' />
                                <span className='font-medium'>Needs Review</span>
                            </div>
                        )}

                        {/* Manual Sync Action */}
                        {(shipment.apiSyncStatus === ApiSyncStatus.FAILED || needsReview) && onManualSync && (
                            <Button
                                size='sm'
                                variant='outline'
                                className='h-6 px-2 text-xs'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onManualSync(shipment);
                                }}
                            >
                                <RefreshCw className='h-3 w-3 mr-1' />
                                Retry Sync
                            </Button>
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('status', {
            header: (info) => <HeaderButton info={info} name='Status' />,
            cell: (info) => {
                const status = info.getValue();
                const variant = getStatusBadgeVariant(status);

                // Custom styling for different statuses
                const customClassName = status === ShipmentStatus.DELIVERED
                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    : status === ShipmentStatus.IN_TRANSIT
                        ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                        : status === ShipmentStatus.OUT_FOR_DELIVERY
                            ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'
                            : '';

                return (
                    <Badge
                        variant={variant as any}
                        className={`capitalize ${customClassName}`}
                    >
                        {getStatusDisplayText(status)}
                    </Badge>
                );
            },
        }),

        columnHelper.accessor('carrier', {
            header: (info) => <HeaderButton info={info} name='Carrier' />,
            cell: (info) => {
                const shipment = info.row.original;
                return (
                    <div className='flex items-center gap-2 text-sm'>
                        <Truck className='h-3 w-3 text-muted-foreground' />
                        <span className='font-medium uppercase'>{info.getValue()}</span>
                    </div>
                );
            },
        }),

        columnHelper.display({
            id: 'dates',
            header: 'Dates',
            cell: ({ row }) => {
                const shipment = row.original;
                return (
                    <div className='min-w-[140px]'>
                        <div className='flex items-center gap-1 text-sm'>
                            <Calendar className='h-3 w-3 text-muted-foreground' />
                            <span className='text-muted-foreground'>Created:</span>
                            <span>{formatShipmentDate(shipment.createdAt)}</span>
                        </div>
                        {shipment.estimatedDelivery && (
                            <div className='text-xs text-muted-foreground mt-1'>
                                Est. Delivery: {formatShipmentDate(shipment.estimatedDelivery)}
                            </div>
                        )}
                        {shipment.actualDelivery && (
                            <div className='text-xs text-green-600 mt-1'>
                                Delivered: {formatShipmentDate(shipment.actualDelivery)}
                            </div>
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.display({
            id: 'lastUpdate',
            header: 'Last Update',
            cell: ({ row }) => {
                const shipment = row.original;
                return (
                    <div className='text-sm text-muted-foreground'>
                        {formatRelativeDate(shipment.updatedAt)}
                        {shipment.lastApiSync && (
                            <div className='text-xs mt-1'>
                                API: {formatRelativeDate(shipment.lastApiSync)}
                            </div>
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const shipment = row.original;
                const isOperationLoading = operationLoading?.includes(shipment.id);
                const canUpdateStatus = ![ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED].includes(shipment.status as any);

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='sm' disabled={isOperationLoading}>
                                {isOperationLoading ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <EllipsisVertical size={16} />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => onView(shipment)}
                                disabled={isOperationLoading}
                            >
                                <Eye className='mr-2 h-4 w-4' />
                                View Details
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onEdit(shipment)}
                                disabled={isOperationLoading}
                            >
                                <Edit className='mr-2 h-4 w-4' />
                                Edit Shipment
                            </DropdownMenuItem>

                            {canUpdateStatus && (
                                <DropdownMenuItem
                                    onClick={() => onUpdateStatus(shipment)}
                                    disabled={isOperationLoading}
                                >
                                    <RefreshCw className='mr-2 h-4 w-4' />
                                    Update Status
                                </DropdownMenuItem>
                            )}

                            {shipment.carrierTrackingNumber && (
                                <DropdownMenuItem
                                    onClick={() => {
                                        // Open carrier tracking page in new tab
                                        window.open(`https://www.google.com/search?q=${shipment.carrier}+tracking+${shipment.carrierTrackingNumber}`, '_blank');
                                    }}
                                    disabled={isOperationLoading}
                                >
                                    <ExternalLink className='mr-2 h-4 w-4' />
                                    Track with Carrier
                                </DropdownMenuItem>
                            )}

                            {onManualSync && (
                                <DropdownMenuItem
                                    onClick={() => onManualSync(shipment)}
                                    disabled={isOperationLoading}
                                >
                                    <RefreshCw className='mr-2 h-4 w-4' />
                                    Manual Sync
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => onDelete(shipment)}
                                className='text-destructive'
                                disabled={isOperationLoading}
                            >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Delete Shipment
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
            enableSorting: false,
            enableHiding: false,
            size: 80,
        }),
    ];