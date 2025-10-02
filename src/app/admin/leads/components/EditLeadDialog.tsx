/** @format */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/lead';
import { leadApi } from '@/lib/leadApi';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { Edit, Loader2, AlertTriangle, CheckCircle, XCircle, Phone } from 'lucide-react';
import {
    getCountryOptions,
    isValidWeight,
    getStatusDisplayText,
    getStatusBadgeVariant,
    getValidStatusTransitions,
    isStatusRequiresReason
} from '@/lib/leadUtils';
import type { User } from '@/types/user';

const formSchema = z.object({
    customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
    customerEmail: z.string().email('Please enter a valid email address'),
    customerPhone: z.string().optional(),
    customerId: z.string().optional(),
    originCountry: z.string().min(1, 'Please select origin country'),
    destinationCountry: z.string().min(1, 'Please select destination country'),
    weight: z.string().min(1, 'Please enter weight').refine((val) => isValidWeight(val), {
        message: 'Please enter a valid weight (e.g., "25 kg", "50 lbs")',
    }),
    status: z.enum(['new', 'contacted', 'failed', 'success', 'converted']),
    notes: z.string().optional(),
    failureReason: z.string().optional(),
    assignedTo: z.string().optional(),
});

interface EditLeadDialogProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: EditLeadDialogProps) {
    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [customers, setCustomers] = useState<User[]>([]);
    const [admins, setAdmins] = useState<User[]>([]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerId: '',
            originCountry: '',
            destinationCountry: '',
            weight: '',
            status: 'new',
            notes: '',
            failureReason: '',
            assignedTo: '',
        },
    });

    const watchStatus = form.watch('status');
    const watchFailureReason = form.watch('failureReason');

    // Load users when dialog opens
    useEffect(() => {
        if (open) {
            loadUsers();
        }
    }, [open]);

    // Populate form when lead changes
    useEffect(() => {
        if (lead) {
            form.reset({
                customerName: lead.customerName,
                customerEmail: lead.customerEmail,
                customerPhone: lead.customerPhone || '',
                customerId: lead.customerId || '__none__',
                originCountry: lead.originCountry,
                destinationCountry: lead.destinationCountry,
                weight: lead.weight,
                status: lead.status,
                notes: lead.notes || '',
                failureReason: lead.failureReason || '',
                assignedTo: lead.assignedTo || '__none__',
            });
        }
    }, [lead, form]);

    const loadUsers = async () => {
        try {
            setLoadingUsers(true);
            const [customersResponse, adminsResponse] = await Promise.all([
                userApi.getUsers({ perPage: 100, sortBy: 'name', sortDir: 'asc' }),
                userApi.getUsers({ perPage: 100, sortBy: 'name', sortDir: 'asc' })
            ]);

            // Filter customers (non-admin users)
            const customerUsers = customersResponse.users.filter(user =>
                user.role === 'customer' || !user.role
            );

            // Filter admins
            const adminUsers = adminsResponse.users.filter(user =>
                user.role === 'admin' || user.role === 'super-admin'
            );

            setCustomers(customerUsers);
            setAdmins(adminUsers);
        } catch (error) {
            console.error('Failed to load users:', error);
            toast.error('Failed to load user list');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleCustomerSelect = (customerId: string) => {
        if (customerId === '__none__') {
            form.setValue('customerId', '');
            return;
        }

        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            form.setValue('customerId', customerId);
            form.setValue('customerName', customer.name);
            form.setValue('customerEmail', customer.email);
            form.setValue('customerPhone', customer.phone || '');
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!lead) return;

        try {
            setLoading(true);

            // Validate that origin and destination are different
            if (values.originCountry === values.destinationCountry) {
                form.setError('destinationCountry', {
                    type: 'manual',
                    message: 'Destination country must be different from origin country',
                });
                return;
            }

            // Validate status transition
            const validTransitions = getValidStatusTransitions(lead.status);
            if (values.status !== lead.status && !validTransitions.includes(values.status)) {
                form.setError('status', {
                    type: 'manual',
                    message: `Cannot change status from ${lead.status} to ${values.status}`,
                });
                return;
            }

            // Validate failure reason if status is failed
            if (values.status === 'failed' && !values.failureReason?.trim()) {
                form.setError('failureReason', {
                    type: 'manual',
                    message: 'Failure reason is required when status is failed',
                });
                return;
            }

            await leadApi.updateLead(lead.id, {
                customerName: values.customerName,
                customerEmail: values.customerEmail,
                customerPhone: values.customerPhone || undefined,
                customerId: values.customerId === '__none__' ? undefined : values.customerId || undefined,
                originCountry: values.originCountry,
                destinationCountry: values.destinationCountry,
                weight: values.weight,
                status: values.status,
                notes: values.notes || undefined,
                failureReason: values.status === 'failed' ? values.failureReason || undefined : undefined,
                assignedTo: values.assignedTo === '__none__' ? undefined : values.assignedTo || undefined,
            });

            toast.success('Lead updated successfully', {
                description: `Lead for ${values.customerName} has been updated`,
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update lead';

            // Handle specific validation errors
            if (errorMessage.includes('email')) {
                form.setError('customerEmail', {
                    type: 'manual',
                    message: 'Invalid email address',
                });
                toast.error('Invalid email address', {
                    description: 'Please enter a valid email address',
                });
            } else if (errorMessage.includes('Customer not found')) {
                form.setError('customerId', {
                    type: 'manual',
                    message: 'Selected customer no longer exists',
                });
                toast.error('Customer not found', {
                    description: 'The selected customer may have been deleted. Please select another customer.',
                });
            } else if (errorMessage.includes('Lead not found')) {
                toast.error('Lead not found', {
                    description: 'This lead may have been deleted by another user. Please refresh the page.',
                });
            } else if (errorMessage.includes('Unauthorized')) {
                toast.error('Access denied', {
                    description: 'You do not have permission to update leads',
                });
            } else {
                toast.error('Failed to update lead', {
                    description: errorMessage.includes('Network')
                        ? 'Please check your internet connection and try again'
                        : errorMessage,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false);
        }
    };

    if (!lead) return null;

    const countryOptions = getCountryOptions();
    const validStatusTransitions = getValidStatusTransitions(lead.status);
    const requiresFailureReason = isStatusRequiresReason(watchStatus);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Edit className='h-5 w-5' />
                        Edit Lead: {lead.customerName}
                    </DialogTitle>
                    <DialogDescription>
                        Update lead information and status. Changes will take effect immediately.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
                        {/* Current Status Display */}
                        <div className='flex items-center gap-2 p-3 bg-muted rounded-lg'>
                            <span className='text-sm font-medium'>Current Status:</span>
                            <Badge
                                variant={getStatusBadgeVariant(lead.status) as any}
                                className={lead.status === 'success' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                            >
                                {getStatusDisplayText(lead.status)}
                            </Badge>
                            <span className='text-xs text-muted-foreground ml-2'>
                                Created: {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Customer Information Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Customer Information</h3>

                            {/* Customer Selection */}
                            <div className='mb-4'>
                                <FormField
                                    control={form.control}
                                    name='customerId'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Link to Existing Customer (Optional)</FormLabel>
                                            <Select
                                                onValueChange={handleCustomerSelect}
                                                value={field.value}
                                                disabled={loading || loadingUsers}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={
                                                            loadingUsers
                                                                ? 'Loading customers...'
                                                                : 'Select a customer (optional)'
                                                        } />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value='__none__'>No customer selected</SelectItem>
                                                    {customers.map((customer) => (
                                                        <SelectItem key={customer.id} value={customer.id}>
                                                            <div className='flex items-center gap-2'>
                                                                <div>
                                                                    <div className='font-medium'>{customer.name}</div>
                                                                    <div className='text-xs text-muted-foreground'>{customer.email}</div>
                                                                </div>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className='grid grid-cols-1 gap-4'>
                                <FormField
                                    control={form.control}
                                    name='customerName'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Customer Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder='Enter customer name'
                                                    disabled={loading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className='grid grid-cols-2 gap-4'>
                                    <FormField
                                        control={form.control}
                                        name='customerEmail'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email Address *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='customer@example.com'
                                                        type='email'
                                                        disabled={loading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name='customerPhone'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='+1 (555) 123-4567'
                                                        type='tel'
                                                        disabled={loading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Shipping Information Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Shipping Information</h3>
                            <div className='grid grid-cols-2 gap-4'>
                                <FormField
                                    control={form.control}
                                    name='originCountry'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Origin Country *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select origin country' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {countryOptions.map((country) => (
                                                        <SelectItem key={country.value} value={country.value}>
                                                            {country.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='destinationCountry'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Destination Country *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select destination country' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {countryOptions.map((country) => (
                                                        <SelectItem key={country.value} value={country.value}>
                                                            {country.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4 mt-4'>
                                <FormField
                                    control={form.control}
                                    name='weight'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Weight *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder='e.g., 25 kg, 50 lbs'
                                                    disabled={loading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            <div className='text-xs text-muted-foreground'>
                                                Include unit (kg, lbs, g, oz, tons)
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='assignedTo'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Assign to Admin</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={loading || loadingUsers}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select admin (optional)' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value='__none__'>No assignment</SelectItem>
                                                    {admins.map((admin) => (
                                                        <SelectItem key={admin.id} value={admin.id}>
                                                            <span>{admin.name}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Status Management Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Status Management</h3>
                            <div className='space-y-4'>
                                <FormField
                                    control={form.control}
                                    name='status'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lead Status</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select status' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {/* Current status */}
                                                    <SelectItem value={lead.status}>
                                                        <div className='flex items-center gap-2'>
                                                            <CheckCircle className='h-4 w-4 text-green-500' />
                                                            <span>{getStatusDisplayText(lead.status)} (Current)</span>
                                                        </div>
                                                    </SelectItem>

                                                    {/* Valid transitions */}
                                                    {validStatusTransitions.map((status) => (
                                                        <SelectItem key={status} value={status}>
                                                            <div className='flex items-center gap-2'>
                                                                {status === 'failed' ? (
                                                                    <XCircle className='h-4 w-4 text-red-500' />
                                                                ) : status === 'success' ? (
                                                                    <CheckCircle className='h-4 w-4 text-green-500' />
                                                                ) : (
                                                                    <Phone className='h-4 w-4 text-blue-500' />
                                                                )}
                                                                <span>{getStatusDisplayText(status)}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                            {validStatusTransitions.length === 0 && (
                                                <div className='text-xs text-muted-foreground'>
                                                    No status changes available from current status
                                                </div>
                                            )}
                                        </FormItem>
                                    )}
                                />

                                {requiresFailureReason && (
                                    <FormField
                                        control={form.control}
                                        name='failureReason'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className='flex items-center gap-2'>
                                                    <AlertTriangle className='h-4 w-4 text-destructive' />
                                                    Failure Reason *
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder='Explain why this lead failed...'
                                                        className='min-h-[80px]'
                                                        disabled={loading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Additional Information Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Additional Information</h3>
                            <FormField
                                control={form.control}
                                name='notes'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder='Add any additional notes about this lead...'
                                                className='min-h-[80px]'
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className='gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={handleClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type='submit'
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Edit className='mr-2 h-4 w-4' />
                                        Update Lead
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}