/** @format */

'use client';

import { useState } from 'react';
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
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

const formSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    role: z.string().min(1, 'Please select a role'),
    password: z.string().optional().refine((val) => {
        if (!val) return true; // Optional field
        return val.length >= 8;
    }, 'Password must be at least 8 characters'),
    sendWelcomeEmail: z.boolean().optional(),
});

interface AddUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function AddUserDialog({ open, onOpenChange, onSuccess }: AddUserDialogProps) {
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: '',
            zipCode: '',
            role: '',
            password: '',
            sendWelcomeEmail: true,
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true);
            await userApi.createUser({
                name: values.name,
                email: values.email,
                phone: values.phone || undefined,
                address: values.address || undefined,
                city: values.city || undefined,
                state: values.state || undefined,
                country: values.country || undefined,
                zipCode: values.zipCode || undefined,
                role: values.role,
                password: values.password || undefined,
                sendWelcomeEmail: values.sendWelcomeEmail,
            });
            toast.success('User created successfully', {
                description: `${values.name} has been added to the system`,
            });
            form.reset();
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
            toast.error('Failed to create user', {
                description: errorMessage,
            });

            if (errorMessage.includes('email already exists') || errorMessage.includes('already exists')) {
                form.setError('email', {
                    type: 'manual',
                    message: 'This email address is already registered',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            form.reset();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <UserPlus className='h-5 w-5' />
                        Add New User
                    </DialogTitle>
                    <DialogDescription>
                        Create a new user account. They will receive an email to set up their password.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
                        {/* Basic Information Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Basic Information</h3>
                            <div className='grid grid-cols-2 gap-4'>
                                <FormField
                                    control={form.control}
                                    name='name'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder='Enter full name'
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
                                    name='email'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder='user@example.com'
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
                                    name='phone'
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

                                <FormField
                                    control={form.control}
                                    name='role'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>User Role *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder='Select user role' />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value='customer'>Customer</SelectItem>
                                                    <SelectItem value='admin'>Admin</SelectItem>
                                                    <SelectItem value='super-admin'>Super Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Address Information Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Address Information</h3>
                            <div className='space-y-4'>
                                <FormField
                                    control={form.control}
                                    name='address'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Street Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder='123 Main Street'
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
                                        name='city'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>City</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='New York'
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
                                        name='state'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>State/Province</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='NY'
                                                        disabled={loading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className='grid grid-cols-2 gap-4'>
                                    <FormField
                                        control={form.control}
                                        name='country'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Country</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='United States'
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
                                        name='zipCode'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ZIP/Postal Code</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='10001'
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

                        {/* Password Setup Section */}
                        <div>
                            <h3 className='text-lg font-medium mb-4'>Password Setup</h3>
                            <div className='space-y-4'>
                                <FormField
                                    control={form.control}
                                    name='password'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Initial Password (Optional)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type='password'
                                                    placeholder='Leave empty to send password reset email'
                                                    disabled={loading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            <div className='text-xs text-muted-foreground'>
                                                If left empty, user will receive an email to set their password
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='sendWelcomeEmail'
                                    render={({ field }) => (
                                        <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                                            <div className='space-y-0.5'>
                                                <FormLabel className='text-base'>Send Welcome Email</FormLabel>
                                                <div className='text-sm text-muted-foreground'>
                                                    Send password setup email to the user
                                                </div>
                                            </div>
                                            <FormControl>
                                                <input
                                                    type='checkbox'
                                                    checked={field.value}
                                                    onChange={field.onChange}
                                                    disabled={loading}
                                                    className='h-4 w-4'
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
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
                                        <UserPlus className='mr-2 h-4 w-4' />
                                        Create User
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