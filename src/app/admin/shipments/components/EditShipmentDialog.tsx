/** @format */

'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shipment } from '@/types/shipment';
import { Edit } from 'lucide-react';

interface EditShipmentDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditShipmentDialog({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: EditShipmentDialogProps) {
    if (!shipment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Edit className='h-5 w-5' />
                        Edit Shipment - {shipment.trackingCode}
                    </DialogTitle>
                    <DialogDescription>
                        Modify shipment information and details.
                    </DialogDescription>
                </DialogHeader>

                <div className='p-4 text-center text-muted-foreground'>
                    <p>Edit Shipment form will be implemented in task 5.4</p>
                    <Button
                        onClick={() => {
                            onSuccess();
                        }}
                        className='mt-4'
                    >
                        Mock Update Shipment
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}