/** @format */

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Lead } from '@/types/lead';
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
    ArrowRightLeft,
    Loader2,
    Phone,
    Mail,
    MapPin,
    Weight,
    Calendar,
    RefreshCw
} from 'lucide-react';
import {
    getStatusBadgeVariant,
    getStatusDisplayText,
    getCountryName,
    formatLeadCreatedDate,
    parseWeight,
    canConvertLead,
    formatCustomerRelationshipStatus,
    shouldSyncCustomerData
} from '@/lib/leadUtils';

const columnHelper = createColumnHelper<Lead>();

interface LeadColumnsProps {
    onView: (lead: Lead) => void;
    onEdit: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
    onConvert: (lead: Lead) => void;
    onSyncCustomer?: (lead: Lead) => void;
    operationLoading: string | null;
    userMap?: Map<string, string>; // Map from user ID to user name
}

export const createLeadColumns = ({
    onView,
    onEdit,
    onDelete,
    onConvert,
    onSyncCustomer,
    operationLoading,
    userMap = new Map()
}: LeadColumnsProps) => [
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

        columnHelper.accessor('customerName', {
            header: (info) => <HeaderButton info={info} name='Customer' />,
            cell: (info) => {
                const lead = info.row.original;
                const relationshipStatus = formatCustomerRelationshipStatus(lead);
                const needsSync = shouldSyncCustomerData(lead);

                return (
                    <div className='min-w-[200px]'>
                        <div className='flex items-center gap-2'>
                            <span className='font-medium'>{info.getValue()}</span>
                            <Badge
                                variant={relationshipStatus.badgeVariant as any}
                                className={`text-xs ${relationshipStatus.status === 'linked'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : relationshipStatus.status === 'sync_needed'
                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        : relationshipStatus.status === 'invalid'
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : ''
                                    }`}
                            >
                                {relationshipStatus.displayText}
                            </Badge>
                        </div>
                        <div className='flex items-center gap-1 text-xs text-muted-foreground mt-1'>
                            <Mail className='h-3 w-3' />
                            <span className='truncate'>{lead.customerEmail}</span>
                        </div>
                        {lead.customerPhone && (
                            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Phone className='h-3 w-3' />
                                <span>{lead.customerPhone}</span>
                            </div>
                        )}
                        {lead.linkedCustomer && (
                            <div className='text-xs text-blue-600 mt-1'>
                                Linked to: {lead.linkedCustomer.name}
                                {lead.linkedCustomer.role && (
                                    <span className='text-muted-foreground ml-1'>({lead.linkedCustomer.role})</span>
                                )}
                            </div>
                        )}
                        {needsSync && (
                            <div className='text-xs text-yellow-600 mt-1'>
                                ⚠️ Data sync needed
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
                const lead = row.original;
                return (
                    <div className='min-w-[180px]'>
                        <div className='flex items-center gap-2 text-sm'>
                            <MapPin className='h-3 w-3 text-muted-foreground' />
                            <span className='font-medium'>{getCountryName(lead.originCountry)}</span>
                            <ArrowRightLeft className='h-3 w-3 text-muted-foreground' />
                            <span className='font-medium'>{getCountryName(lead.destinationCountry)}</span>
                        </div>
                        <div className='text-xs text-muted-foreground mt-1'>
                            {lead.originCountry} → {lead.destinationCountry}
                        </div>
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('weight', {
            header: (info) => <HeaderButton info={info} name='Weight' />,
            cell: (info) => {
                const weightString = info.getValue();
                const parsed = parseWeight(weightString);

                return (
                    <div className='flex items-center gap-1 text-sm'>
                        <Weight className='h-3 w-3 text-muted-foreground' />
                        <span className='font-medium'>
                            {parsed ? `${parsed.value} ${parsed.unit}` : weightString}
                        </span>
                    </div>
                );
            },
        }),

        columnHelper.accessor('status', {
            header: (info) => <HeaderButton info={info} name='Status' />,
            cell: (info) => {
                const status = info.getValue();
                const variant = getStatusBadgeVariant(status);

                // Custom styling for success status to make it green
                const customClassName = status === 'success'
                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
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

        columnHelper.display({
            id: 'assignedTo',
            header: 'Assigned To',
            cell: ({ row }) => {
                const lead = row.original;
                return (
                    <div className='text-sm'>
                        {lead.assignedTo ? (
                            <span className='text-muted-foreground'>
                                {userMap.get(lead.assignedTo) || lead.assignedTo}
                            </span>
                        ) : (
                            <span className='text-muted-foreground italic'>Unassigned</span>
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('createdAt', {
            header: (info) => <HeaderButton info={info} name='Created' />,
            cell: (info) => {
                const date = info.getValue();
                return (
                    <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                        <Calendar className='h-3 w-3' />
                        <span>{formatLeadCreatedDate(date)}</span>
                    </div>
                );
            },
        }),

        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const lead = row.original;
                const isOperationLoading = operationLoading?.includes(lead.id);
                const canConvert = canConvertLead(lead);
                const needsSync = shouldSyncCustomerData(lead);
                const hasLinkedCustomer = !!lead.customerId && !!lead.linkedCustomer;

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
                                onClick={() => onView(lead)}
                                disabled={isOperationLoading}
                            >
                                <Eye className='mr-2 h-4 w-4' />
                                View Details
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onEdit(lead)}
                                disabled={isOperationLoading}
                            >
                                <Edit className='mr-2 h-4 w-4' />
                                Edit Lead
                            </DropdownMenuItem>

                            {hasLinkedCustomer && onSyncCustomer && (
                                <DropdownMenuItem
                                    onClick={() => onSyncCustomer(lead)}
                                    disabled={isOperationLoading}
                                    className={needsSync ? 'text-yellow-600' : ''}
                                >
                                    <RefreshCw className='mr-2 h-4 w-4' />
                                    Manage Customer Link
                                    {needsSync && <span className='ml-auto text-xs'>⚠️</span>}
                                </DropdownMenuItem>
                            )}

                            {canConvert && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => onConvert(lead)}
                                        disabled={isOperationLoading}
                                    >
                                        <ArrowRightLeft className='mr-2 h-4 w-4' />
                                        Convert to Shipment
                                    </DropdownMenuItem>
                                </>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => onDelete(lead)}
                                className='text-destructive'
                                disabled={isOperationLoading}
                            >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Delete Lead
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