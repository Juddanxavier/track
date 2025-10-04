/** @format */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    Filter,
    X,
    CalendarIcon,
    Plus,
    Package,
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShipmentStatus, ApiSyncStatus, Carrier } from '@/types/shipment';

export interface ShipmentFilters {
    search: string;
    status: string[];
    carrier: string[];
    apiSyncStatus: string[];
    needsReview: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    deliveryFrom?: Date;
    deliveryTo?: Date;
}

interface ShipmentFiltersProps {
    filters: ShipmentFilters;
    onFiltersChange: (filters: ShipmentFilters) => void;
    onAdd: () => void;
    addLabel?: string;
    title?: string;
    isLoading?: boolean;
}

const statusOptions = [
    { value: ShipmentStatus.PENDING, label: 'Pending' },
    { value: ShipmentStatus.IN_TRANSIT, label: 'In Transit' },
    { value: ShipmentStatus.OUT_FOR_DELIVERY, label: 'Out for Delivery' },
    { value: ShipmentStatus.DELIVERED, label: 'Delivered' },
    { value: ShipmentStatus.EXCEPTION, label: 'Exception' },
    { value: ShipmentStatus.CANCELLED, label: 'Cancelled' },
];

const carrierOptions = [
    { value: Carrier.FEDEX, label: 'FedEx' },
    { value: Carrier.UPS, label: 'UPS' },
    { value: Carrier.DHL, label: 'DHL' },
    { value: Carrier.USPS, label: 'USPS' },
];

const apiSyncStatusOptions = [
    { value: ApiSyncStatus.PENDING, label: 'Sync Pending' },
    { value: ApiSyncStatus.SUCCESS, label: 'Sync Success' },
    { value: ApiSyncStatus.FAILED, label: 'Sync Failed' },
];

export default function ShipmentFilters({
    filters,
    onFiltersChange,
    onAdd,
    addLabel = 'Add',
    title = 'Shipments',
    isLoading = false,
}: ShipmentFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    const handleSearchChange = (value: string) => {
        onFiltersChange({ ...filters, search: value });
    };

    const handleStatusToggle = (status: string) => {
        const newStatus = filters.status.includes(status)
            ? filters.status.filter(s => s !== status)
            : [...filters.status, status];
        onFiltersChange({ ...filters, status: newStatus });
    };

    const handleCarrierToggle = (carrier: string) => {
        const newCarrier = filters.carrier.includes(carrier)
            ? filters.carrier.filter(c => c !== carrier)
            : [...filters.carrier, carrier];
        onFiltersChange({ ...filters, carrier: newCarrier });
    };

    const handleApiSyncStatusToggle = (status: string) => {
        const newStatus = filters.apiSyncStatus.includes(status)
            ? filters.apiSyncStatus.filter(s => s !== status)
            : [...filters.apiSyncStatus, status];
        onFiltersChange({ ...filters, apiSyncStatus: newStatus });
    };

    const handleNeedsReviewToggle = () => {
        onFiltersChange({ ...filters, needsReview: !filters.needsReview });
    };

    const handleDateFromChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, dateFrom: date });
    };

    const handleDateToChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, dateTo: date });
    };

    const handleDeliveryFromChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, deliveryFrom: date });
    };

    const handleDeliveryToChange = (date: Date | undefined) => {
        onFiltersChange({ ...filters, deliveryTo: date });
    };

    const clearAllFilters = () => {
        onFiltersChange({
            search: '',
            status: [],
            carrier: [],
            apiSyncStatus: [],
            needsReview: false,
            dateFrom: undefined,
            dateTo: undefined,
            deliveryFrom: undefined,
            deliveryTo: undefined,
        });
    };

    const hasActiveFilters = filters.status.length > 0 ||
        filters.carrier.length > 0 ||
        filters.apiSyncStatus.length > 0 ||
        filters.needsReview ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.deliveryFrom ||
        filters.deliveryTo;

    const activeFilterCount = filters.status.length +
        filters.carrier.length +
        filters.apiSyncStatus.length +
        (filters.needsReview ? 1 : 0) +
        (filters.dateFrom ? 1 : 0) +
        (filters.dateTo ? 1 : 0) +
        (filters.deliveryFrom ? 1 : 0) +
        (filters.deliveryTo ? 1 : 0);

    return (
        <div className='space-y-4'>
            {/* Header */}
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <Package className='h-5 w-5 text-muted-foreground' />
                    <h2 className='text-lg font-semibold'>{title}</h2>
                    {isLoading && <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />}
                </div>
                <div className="flex gap-2">
                    <Button onClick={onAdd} className='gap-2'>
                        <Plus className='h-4 w-4' />
                        {addLabel}
                    </Button>
                </div>
            </div>

            {/* Search and Filter Controls */}
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                {/* Search */}
                <div className='relative flex-1 max-w-md'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                        placeholder='Search by tracking code, customer name, or email...'
                        value={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className='pl-9'
                    />
                </div>

                {/* Filter Toggle */}
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        onClick={() => setShowFilters(!showFilters)}
                        className='gap-2'
                    >
                        <Filter className='h-4 w-4' />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge variant='secondary' className='ml-1'>
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={clearAllFilters}
                            className='gap-1'
                        >
                            <X className='h-3 w-3' />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className='rounded-lg border bg-card p-4 space-y-4'>
                    {/* Needs Review Quick Filter */}
                    <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Quick Filters</Label>
                        <div className='flex flex-wrap gap-1'>
                            <Badge
                                variant={filters.needsReview ? 'default' : 'outline'}
                                className='cursor-pointer hover:bg-muted'
                                onClick={handleNeedsReviewToggle}
                            >
                                Needs Review
                            </Badge>
                        </div>
                    </div>

                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                        {/* Status Filter */}
                        <div className='space-y-2'>
                            <Label className='text-sm font-medium'>Status</Label>
                            <div className='flex flex-wrap gap-1'>
                                {statusOptions.map((option) => (
                                    <Badge
                                        key={option.value}
                                        variant={filters.status.includes(option.value) ? 'default' : 'outline'}
                                        className='cursor-pointer hover:bg-muted'
                                        onClick={() => handleStatusToggle(option.value)}
                                    >
                                        {option.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Carrier Filter */}
                        <div className='space-y-2'>
                            <Label className='text-sm font-medium'>Carrier</Label>
                            <div className='flex flex-wrap gap-1'>
                                {carrierOptions.map((option) => (
                                    <Badge
                                        key={option.value}
                                        variant={filters.carrier.includes(option.value) ? 'default' : 'outline'}
                                        className='cursor-pointer hover:bg-muted'
                                        onClick={() => handleCarrierToggle(option.value)}
                                    >
                                        {option.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* API Sync Status Filter */}
                        <div className='space-y-2'>
                            <Label className='text-sm font-medium'>API Sync Status</Label>
                            <div className='flex flex-wrap gap-1'>
                                {apiSyncStatusOptions.map((option) => (
                                    <Badge
                                        key={option.value}
                                        variant={filters.apiSyncStatus.includes(option.value) ? 'default' : 'outline'}
                                        className='cursor-pointer hover:bg-muted'
                                        onClick={() => handleApiSyncStatusToggle(option.value)}
                                    >
                                        {option.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Created Date Range */}
                        <div className='space-y-2'>
                            <Label className='text-sm font-medium'>Created Date</Label>
                            <div className='flex gap-2'>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !filters.dateFrom && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className='mr-2 h-4 w-4' />
                                            {filters.dateFrom ? format(filters.dateFrom, 'MMM dd') : 'From'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <Calendar
                                            mode='single'
                                            selected={filters.dateFrom}
                                            onSelect={handleDateFromChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !filters.dateTo && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className='mr-2 h-4 w-4' />
                                            {filters.dateTo ? format(filters.dateTo, 'MMM dd') : 'To'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <Calendar
                                            mode='single'
                                            selected={filters.dateTo}
                                            onSelect={handleDateToChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Date Range - Separate row */}
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                        <div className='space-y-2'>
                            <Label className='text-sm font-medium'>Delivery Date</Label>
                            <div className='flex gap-2'>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !filters.deliveryFrom && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className='mr-2 h-4 w-4' />
                                            {filters.deliveryFrom ? format(filters.deliveryFrom, 'MMM dd') : 'From'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <Calendar
                                            mode='single'
                                            selected={filters.deliveryFrom}
                                            onSelect={handleDeliveryFromChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant='outline'
                                            className={cn(
                                                'w-full justify-start text-left font-normal',
                                                !filters.deliveryTo && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className='mr-2 h-4 w-4' />
                                            {filters.deliveryTo ? format(filters.deliveryTo, 'MMM dd') : 'To'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-auto p-0'>
                                        <Calendar
                                            mode='single'
                                            selected={filters.deliveryTo}
                                            onSelect={handleDeliveryToChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}