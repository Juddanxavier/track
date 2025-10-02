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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { User } from '@/types/user';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { Ban, Loader2, AlertTriangle, Calendar } from 'lucide-react';

const formSchema = z.object({
    reason: z.string().min(10, 'Ban reason must be at least 10 characters').max(500, 'Ban reason must be less than 500 characters'),
    expiresAt: z.string().optional().refine((date) => {
        if (!date) return true;
        const selectedDate = new Date(date);
        const now = new Date();
        return selectedDate > now;
    }, 'Expiry date must be in the future'),
});

interface BanUserDialogProps {
    user: User | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function BanUserDialog({ user, open, onOpenChange, onSuccess }: BanUserDialogProps) {
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reason: '',
            expiresAt: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user) return;

        try {
            setLoading(true);
            await userApi.banUser(user.id, {
                reason: values.reason,
                expiresAt: values.expiresAt || undefined,
            });

            const expiryText = values.expiresAt
                ? ` until ${new Date(values.expiresAt).toLocaleDateString()}`
                : ' permanently';

            toast.success('User banned successfully', {
                description: `${user.name} has been banned${expiryText}`,
            });
            form.reset();
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to ban user';
            toast.error('Failed to ban user', {
                description: errorMessage,
            });
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

    if (!user) return null;

    const isAdminUser = user.role === 'admin' || user.role === 'super-admin';

    // Get minimum date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().slice(0, 16);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[425px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-destructive'>
                        <Ban className='h-5 w-5' />
                        Ban User
                    </DialogTitle>
                    <DialogDescription>
                        You are about to ban <strong>{user.name}</strong> ({user.email}) from the platform.
                        This action can be reversed later.
                    </DialogDescription>
                </DialogHeader>

                {isAdminUser ? (
                    <div className='rounded-lg border border-destructive/20 bg-destructive/10 p-4'>
                        <div className='flex items-center gap-2 text-destructive'>
                            <AlertTriangle className='h-4 w-4' />
                            <span className='font-medium'>Cannot Ban Admin User</span>
                        </div>
                        <p className='text-sm text-muted-foreground mt-1'>
                            Admin and Super Admin users cannot be banned. Please change their role first if necessary.
                        </p>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                            <FormField
                                control={form.control}
                                name='reason'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ban Reason</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder='Explain why this user is being banned (e.g., violation of terms of service, spam, inappropriate behavior)...'
                                                className='min-h-[100px]'
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        <div className='text-xs text-muted-foreground'>
                                            {field.value.length}/500 characters
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name='expiresAt'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='flex items-center gap-2'>
                                            <Calendar className='h-4 w-4' />
                                            Ban Expiry (Optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type='datetime-local'
                                                min={minDate}
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        <div className='text-xs text-muted-foreground'>
                                            Leave empty for permanent ban. User will be automatically unbanned at the specified time.
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950'>
                                <div className='flex items-center gap-2 text-amber-800 dark:text-amber-200'>
                                    <AlertTriangle className='h-4 w-4' />
                                    <span className='font-medium text-sm'>Warning</span>
                                </div>
                                <p className='text-xs text-amber-700 dark:text-amber-300 mt-1'>
                                    The user will be immediately logged out and unable to access the platform.
                                    They will see a message explaining they have been banned.
                                </p>
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
                                    variant='destructive'
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            Banning...
                                        </>
                                    ) : (
                                        <>
                                            <Ban className='mr-2 h-4 w-4' />
                                            Ban User
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}