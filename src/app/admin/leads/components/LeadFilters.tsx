/** @format */

'use client';

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
import { CalendarIcon, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { userApi } from '@/lib/userApi';
import { User } from '@/types/user';

export interface LeadFilters {
    search: string;
    status: string[];
    originCountry: string;
    destinationCountry: string;
    assignedTo: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
}

interface LeadFiltersProps {
    filters: LeadFilters;
    onFiltersChange: (filters: LeadFilters) => void;
    onAdd?: () => void;
    addLabel?: string;
    title?: string;
    isLoading?: boolean;
}

const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'failed', label: 'Failed' },
    { value: 'success', label: 'Success' },
    { value: 'converted', label: 'Converted' },
];

const countryOptions = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'AU', label: 'Australia' },
    { value: 'JP', label: 'Japan' },
    { value: 'CN', label: 'China' },
    { value: 'IN', label: 'India' },
    { value: 'BR', label: 'Brazil' },
];

export default function LeadFilters({
    filters,
    onFiltersChange,
    onAdd,
    addLabel = 'Add Lead',
    title,
    isLoading = false,
}: LeadFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Fetch users for the assignedTo filter
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoadingUsers(true);
                const response = await userApi.getUsers({ perPage: 100 }); // Get first 100 users
                setUsers(response.users);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, []);

    const updateFilters = (updates: Partial<LeadFilters>) => {
        onFiltersChange({ ...filters, ...updates });
    };

    const clearFilters = () => {
        onFiltersChange({
            search: '',
            status: [],
            originCountry: '',
            destinationCountry: '',
            assignedTo: '',
            dateFrom: undefined,
            dateTo: undefined,
        });
    };

    const hasActiveFilters =
        filters.status.length > 0 ||
        filters.originCountry ||
        filters.destinationCountry ||
        filters.assignedTo ||
        filters.dateFrom ||
        filters.dateTo;

    const activeFilterCount =
        filters.status.length +
        (filters.originCountry ? 1 : 0) +
        (filters.destinationCountry ? 1 : 0) +
        (filters.assignedTo ? 1 : 0) +
        (filters.dateFrom ? 1 : 0) +
        (filters.dateTo ? 1 : 0);

    return (
        <div className='rounded-md border border-border bg-card p-3 shadow-sm'>
            <div className='flex flex-col gap-4'>
                {/* Header with title, search, and actions */}
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex items-center gap-2'>
                        {title && (
                            <h3 className='text-base font-semibold'>{title}</h3>
                        )}
                        <Input
                            placeholder='Search leads...'
                            value={filters.search}
                            onChange={(e) => updateFilters({ search: e.target.value })}
                            className='max-w-xs'
                            disabled={isLoading}
                        />
                    </div>
                    <div className='flex items-center gap-2'>
                        <Popover open={showFilters} onOpenChange={setShowFilters}>
                            <PopoverTrigger asChild>
                                <Button variant='outline' size='sm'>
                                    <Filter className='h-4 w-4 mr-2' />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant='secondary' className='ml-2 h-5 w-5 rounded-full p-0 text-xs'>
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className='w-80' align='end'>
                                <div className='space-y-4'>
                                    <div className='flex items-center justify-between'>
                                        <h4 className='font-medium'>Filters</h4>
                                        {hasActiveFilters && (
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                onClick={clearFilters}
                                                className='h-auto p-1 text-xs'
                                            >
                                                Clear all
                                            </Button>
                                        )}
                                    </div>

                                    {/* Status Filter */}
                                    <div className='space-y-2'>
                                        <Label className='text-sm font-medium'>Status</Label>
                                        <div className='flex flex-wrap gap-1'>
                                            {statusOptions.map((status) => {
                                                const isSelected = filters.status.includes(status.value);
                                                return (
                                                    <Button
                                                        key={status.value}
                                                        variant={isSelected ? 'default' : 'outline'}
                                                        size='sm'
                                                        className='h-7 text-xs'
                                                        onClick={() => {
                                                            const newStatus = isSelected
                                                                ? filters.status.filter(s => s !== status.value)
                                                                : [...filters.status, status.value];
                                                            updateFilters({ status: newStatus });
                                                        }}
                                                    >
                                                        {status.label}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Origin Country Filter */}
                                    <div className='space-y-2'>
                                        <Label className='text-sm font-medium'>Origin Country</Label>
                                        <Select
                                            value={filters.originCountry || '__all__'}
                                            onValueChange={(value) => updateFilters({ originCountry: value === '__all__' ? '' : value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder='Select origin country' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='__all__'>All Countries</SelectItem>
                                                {countryOptions.map((country) => (
                                                    <SelectItem key={country.value} value={country.value}>
                                                        {country.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Destination Country Filter */}
                                    <div className='space-y-2'>
                                        <Label className='text-sm font-medium'>Destination Country</Label>
                                        <Select
                                            value={filters.destinationCountry || '__all__'}
                                            onValueChange={(value) => updateFilters({ destinationCountry: value === '__all__' ? '' : value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder='Select destination country' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='__all__'>All Countries</SelectItem>
                                                {countryOptions.map((country) => (
                                                    <SelectItem key={country.value} value={country.value}>
                                                        {country.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Assigned To Filter */}
                                    <div className='space-y-2'>
                                        <Label className='text-sm font-medium'>Assigned To</Label>
                                        <Select
                                            value={filters.assignedTo || '__all__'}
                                            onValueChange={(value) => updateFilters({ assignedTo: value === '__all__' ? '' : value })}
                                            disabled={loadingUsers}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder='Select assigned user' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='__all__'>All Users</SelectItem>
                                                <SelectItem value='unassigned'>Unassigned</SelectItem>
                                                {users.map((user) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Date Range Filter */}
                                    <div className='space-y-2'>
                                        <Label className='text-sm font-medium'>Date Range</Label>
                                        <div className='flex gap-2'>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant='outline'
                                                        className={cn(
                                                            'flex-1 justify-start text-left font-normal',
                                                            !filters.dateFrom && 'text-muted-foreground'
                                                        )}
                                                    >
                                                        <CalendarIcon className='mr-2 h-4 w-4' />
                                                        {filters.dateFrom ? filters.dateFrom.toLocaleDateString() : 'From date'}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className='w-auto p-0' align='start'>
                                                    <Calendar
                                                        mode='single'
                                                        selected={filters.dateFrom}
                                                        onSelect={(date) => updateFilters({ dateFrom: date })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant='outline'
                                                        className={cn(
                                                            'flex-1 justify-start text-left font-normal',
                                                            !filters.dateTo && 'text-muted-foreground'
                                                        )}
                                                    >
                                                        <CalendarIcon className='mr-2 h-4 w-4' />
                                                        {filters.dateTo ? filters.dateTo.toLocaleDateString() : 'To date'}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className='w-auto p-0' align='start'>
                                                    <Calendar
                                                        mode='single'
                                                        selected={filters.dateTo}
                                                        onSelect={(date) => updateFilters({ dateTo: date })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        {onAdd && (
                            <Button onClick={onAdd} disabled={isLoading}>
                                {addLabel}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                    <div className='flex flex-wrap gap-2'>
                        {filters.status.map((status) => (
                            <Badge key={status} variant='secondary' className='gap-1'>
                                Status: {statusOptions.find(s => s.value === status)?.label}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => {
                                        const newStatus = filters.status.filter(s => s !== status);
                                        updateFilters({ status: newStatus });
                                    }}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        ))}
                        {filters.originCountry && (
                            <Badge variant='secondary' className='gap-1'>
                                Origin: {countryOptions.find(c => c.value === filters.originCountry)?.label}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => updateFilters({ originCountry: '' })}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}
                        {filters.destinationCountry && (
                            <Badge variant='secondary' className='gap-1'>
                                Destination: {countryOptions.find(c => c.value === filters.destinationCountry)?.label}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => updateFilters({ destinationCountry: '' })}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}
                        {filters.assignedTo && (
                            <Badge variant='secondary' className='gap-1'>
                                Assigned: {filters.assignedTo === 'unassigned'
                                    ? 'Unassigned'
                                    : users.find(u => u.id === filters.assignedTo)?.name || 'Unknown User'}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => updateFilters({ assignedTo: '' })}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}
                        {filters.dateFrom && (
                            <Badge variant='secondary' className='gap-1'>
                                From: {filters.dateFrom.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => updateFilters({ dateFrom: undefined })}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}
                        {filters.dateTo && (
                            <Badge variant='secondary' className='gap-1'>
                                To: {filters.dateTo.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto p-0 hover:bg-transparent'
                                    onClick={() => updateFilters({ dateTo: undefined })}
                                >
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}