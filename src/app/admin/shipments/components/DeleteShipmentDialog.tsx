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
import { Shipment } from '@/types/shipment';
import { shipmentApi } from '@/lib/shipmentApi';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteShipmentDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function DeleteShipmentDialog({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: DeleteShipmentDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    if (!shipment) return null;

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await shipmentApi.deleteShipment(shipment.id);
            toast.success('Shipment deleted successfully');
            onSuccess();
        } catch (error) {
            console.error('Error deleting shipment:', error);
            toast.error('Failed to delete shipment', {
                description: error instanceof Error ? error.message : 'Please try again',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-destructive'>
                        <Trash2 className='h-5 w-5' />
                        Delete Shipment
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this shipment? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className='py-4'>
                    <div className='rounded-lg border bg-muted/50 p-4'>
                        <p><strong>Tracking Code:</strong> {shipment.trackingCode}</p>
                        <p><strong>Customer:</strong> {shipment.customerName}</p>
                        <p><strong>Status:</strong> {shipment.status}</p>
                        <p><strong>Courier:</strong> {shipment.courier}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className='gap-2'
                    >
                        {isDeleting && <Loader2 className='h-4 w-4 animate-spin' />}
                        Delete Shipment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}