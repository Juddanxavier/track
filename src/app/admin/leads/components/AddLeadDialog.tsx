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
import { leadApi } from '@/lib/leadApi';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { Plus, Loader2, User as UserIcon, Mail, Phone } from 'lucide-react';
import { getCountryOptions, WEIGHT_UNITS, isValidWeight } from '@/lib/leadUtils';
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
    notes: z.string().optional(),
    assignedTo: z.string().optional(),
});

interface AddLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function AddLeadDialog({ open, onOpenChange, onSuccess }: AddLeadDialogProps) {
    const [loading, setLoading] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [customers, setCustomers] = useState<User[]>([]);
    const [admins, setAdmins] = useState<User[]>([]);
    const [useExistingCustomer, setUseExistingCustomer] = useState(false);

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
            notes: '',
            assignedTo: '',
        },
    });

    // Load customers and admins when dialog opens
    useEffect(() => {
        if (open) {
            loadCustomersAndAdmins();
        }
    }, [open]);

    const loadCustomersAndAdmins = async () => {
        try {
            setLoadingCustomers(true);
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
            toast.error('Failed to load customer list');
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleCustomerSelect = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            form.setValue('customerId', customerId);
            form.setValue('customerName', customer.name);
            form.setValue('customerEmail', customer.email);
            form.setValue('customerPhone', customer.phone || '');
        }
    };

    const handleUseExistingCustomerChange = (useExisting: boolean) => {
        setUseExistingCustomer(useExisting);
        if (!useExisting) {
            // Clear customer selection when switching to manual entry
            form.setValue('customerId', '');
        } else {
            // Clear manual fields when switching to customer selection
            form.setValue('customerName', '');
            form.setValue('customerEmail', '');
            form.setValue('customerPhone', '');
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
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

            await leadApi.createLead({
                customerName: values.customerName,
                customerEmail: values.customerEmail,
                customerPhone: values.customerPhone || undefined,
                customerId: values.customerId || undefined,
                originCountry: values.originCountry,
                destinationCountry: values.destinationCountry,
                weight: values.weight,
                notes: values.notes || undefined,
                assignedTo: values.assignedTo || undefined,
            });

            toast.success('Lead created successfully', {
                description: `Lead for ${values.customerName} has been added to the system`,
            });
            form.reset();
            setUseExistingCustomer(false);
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create lead';

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
            } else if (errorMessage.includes('Assigned user not found')) {
                form.setError('assignedTo', {
                    type: 'manual',
                    message: 'Selected admin no longer exists',
                });
                toast.error('Admin not found', {
                    description: 'The selected admin may have been deleted. Please select another admin.',
                });
            } else if (errorMessage.includes('Unauthorized')) {
                toast.error('Access denied', {
                    description: 'You do not have permission to create leads',
                });
            } else {
                toast.error('Failed to create lead', {
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
            form.reset();
            setUseExistingCustomer(false);
            onOpenChange(false);
        }
    };

    const countryOptions = getCountryOptions();

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Plus className='h-5 w-5' />
                        Add New Lead
                    </DialogTitle>
                    <DialogDescription>
                        Create a new lead for potential shipping business. You can select an existing customer or enter details manually.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
                        {/* Customer Selection Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Customer Information</h3>

                            {/* Customer Selection Toggle */}
                            <div className='flex items-center space-x-2 mb-4'>
                                <input
                                    type='checkbox'
                                    id='useExistingCustomer'
                                    checked={useExistingCustomer}
                                    onChange={(e) => handleUseExistingCustomerChange(e.target.checked)}
                                    disabled={loading || loadingCustomers}
                                    className='h-4 w-4'
                                />
                                <label htmlFor='useExistingCustomer' className='text-sm font-medium'>
                                    Select from existing customers
                                </label>
                            </div>

                            {useExistingCustomer ? (
                                <FormField
                                    control={form.control}
                                    name='customerId'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Select Customer</FormLabel>
                                            <Select
                                                onValueChange={handleCustomerSelect}
                                                value={field.value}
                                                disabled={loading || loadingCustomers}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={
                                                            loadingCustomers
                                                                ? 'Loading customers...'
                                                                : 'Select a customer'
                                                        } />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {customers.map((customer) => (
                                                        <SelectItem key={customer.id} value={customer.id}>
                                                            <div className='flex items-center gap-2'>
                                                                <UserIcon className='h-4 w-4' />
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
                            ) : (
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
                            )}
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
                                                disabled={loading || loadingCustomers}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select admin (optional)' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {admins.map((admin) => (
                                                        <SelectItem key={admin.id} value={admin.id}>
                                                            <div className='flex items-center gap-2'>
                                                                <UserIcon className='h-4 w-4' />
                                                                <span>{admin.name}</span>
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
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className='mr-2 h-4 w-4' />
                                        Create Lead
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