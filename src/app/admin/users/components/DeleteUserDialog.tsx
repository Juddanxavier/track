/** @format */

'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User } from '@/types/user';
import { userApi } from '@/lib/userApi';
import { toast } from 'sonner';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteUserDialogProps {
    user: User | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function DeleteUserDialog({ user, open, onOpenChange, onSuccess }: DeleteUserDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!user) return;

        try {
            setLoading(true);
            await userApi.deleteUser(user.id);
            toast.success('User deleted successfully', {
                description: `${user.name} has been removed from the system`,
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
            toast.error('Failed to delete user', {
                description: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false);
        }
    };

    if (!user) return null;

    const isAdminUser = user.role === 'admin' || user.role === 'super-admin';

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[425px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-destructive'>
                        <Trash2 className='h-5 w-5' />
                        Delete User
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                {isAdminUser && (
                    <div className='rounded-lg border border-destructive/20 bg-destructive/10 p-4'>
                        <div className='flex items-center gap-2 text-destructive'>
                            <AlertTriangle className='h-4 w-4' />
                            <span className='font-medium'>Cannot Delete Admin User</span>
                        </div>
                        <p className='text-sm text-muted-foreground mt-1'>
                            Admin and Super Admin users cannot be deleted for security reasons.
                        </p>
                    </div>
                )}

                <DialogFooter className='gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    {!isAdminUser && (
                        <Button
                            type='button'
                            variant='destructive'
                            onClick={handleDelete}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className='mr-2 h-4 w-4' />
                                    Delete User
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}