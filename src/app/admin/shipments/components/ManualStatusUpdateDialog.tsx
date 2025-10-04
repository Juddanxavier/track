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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Shipment, ShipmentStatus, VALID_STATUS_TRANSITIONS, ShipmentStatusType } from '@/types/shipment';
import { shipmentApi } from '@/lib/shipmentApi';
import { toast } from 'sonner';
import { RefreshCw, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

interface ManualStatusUpdateDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const statusOptions = [
    { value: ShipmentStatus.PENDING, label: 'Pending', critical: false },
    { value: ShipmentStatus.IN_TRANSIT, label: 'In Transit', critical: false },
    { value: ShipmentStatus.OUT_FOR_DELIVERY, label: 'Out for Delivery', critical: false },
    { value: ShipmentStatus.DELIVERED, label: 'Delivered', critical: true },
    { value: ShipmentStatus.EXCEPTION, label: 'Exception', critical: false },
    { value: ShipmentStatus.CANCELLED, label: 'Cancelled', critical: true },
];

// Helper function to get status label
function getStatusLabel(status: string): string {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.label || status;
}

// Helper function to check if status change is critical
function isCriticalStatusChange(newStatus: string): boolean {
    const option = statusOptions.find(opt => opt.value === newStatus);
    return option?.critical || false;
}

// Helper function to check if status transition is valid
function isValidStatusTransition(currentStatus: ShipmentStatusType, newStatus: ShipmentStatusType): boolean {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
}

export function ManualStatusUpdateDialog({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: ManualStatusUpdateDialogProps) {
    const [status, setStatus] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    if (!shipment) return null;

    // Get available status transitions for current shipment status
    const availableStatuses = VALID_STATUS_TRANSITIONS[shipment.status as ShipmentStatusType] || [];
    const filteredStatusOptions = statusOptions.filter(option =>
        availableStatuses.includes(option.value as ShipmentStatusType)
    );

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);

        // Check if this is a critical status change that requires confirmation
        if (isCriticalStatusChange(newStatus)) {
            // Don't show confirmation immediately, wait for user to click update
        }
    };

    const handleUpdateClick = () => {
        if (!status) {
            toast.error('Please select a status');
            return;
        }

        // Validate status transition
        if (!isValidStatusTransition(shipment.status as ShipmentStatusType, status as ShipmentStatusType)) {
            toast.error('Invalid status transition', {
                description: `Cannot change status from ${getStatusLabel(shipment.status)} to ${getStatusLabel(status)}`,
            });
            return;
        }

        // Check if notes are required for certain transitions
        const requiresNotes = isCriticalStatusChange(status) || status === ShipmentStatus.EXCEPTION;
        if (requiresNotes && !notes.trim()) {
            toast.error('Notes are required for this status change', {
                description: 'Please provide a reason for this status update',
            });
            return;
        }

        // Show confirmation for critical status changes
        if (isCriticalStatusChange(status)) {
            setShowConfirmation(true);
        } else {
            performUpdate();
        }
    };

    const performUpdate = async () => {
        try {
            setIsUpdating(true);
            await shipmentApi.updateShipmentStatus(shipment.id, {
                status: status as any,
                notes: notes || undefined,
            });
            toast.success('Shipment status updated successfully');
            onSuccess();
        } catch (error) {
            console.error('Error updating shipment status:', error);
            toast.error('Failed to update shipment status', {
                description: error instanceof Error ? error.message : 'Please try again',
            });
        } finally {
            setIsUpdating(false);
            setShowConfirmation(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setStatus('');
            setNotes('');
            setShowConfirmation(false);
        }
        onOpenChange(open);
    };

    const handleConfirmationChange = (open: boolean) => {
        if (!open) {
            setShowConfirmation(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <RefreshCw className='h-5 w-5' />
                        Update Shipment Status
                    </DialogTitle>
                    <DialogDescription>
                        Manually update the status of shipment {shipment.trackingCode}.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4 py-4'>
                    <div className='rounded-lg border bg-muted/50 p-4'>
                        <p><strong>Current Status:</strong> {shipment.status}</p>
                        <p><strong>Customer:</strong> {shipment.customerName}</p>
                        <p><strong>Courier:</strong> {shipment.courier}</p>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='status'>New Status</Label>
                        <Select value={status} onValueChange={handleStatusChange}>
                            <SelectTrigger>
                                <SelectValue placeholder='Select new status' />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredStatusOptions.length > 0 ? (
                                    filteredStatusOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            <div className="flex items-center gap-2">
                                                {option.critical && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                                                {option.label}
                                            </div>
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="no-transitions" disabled>
                                        No valid transitions available
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {filteredStatusOptions.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No status changes are allowed from the current status.
                            </p>
                        )}
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='notes' className="flex items-center gap-2">
                            Notes
                            {(isCriticalStatusChange(status) || status === ShipmentStatus.EXCEPTION) && (
                                <span className="text-red-500 text-sm">(Required)</span>
                            )}
                            {!isCriticalStatusChange(status) && status !== ShipmentStatus.EXCEPTION && (
                                <span className="text-muted-foreground text-sm">(Optional)</span>
                            )}
                        </Label>
                        <Textarea
                            id='notes'
                            placeholder={
                                isCriticalStatusChange(status) || status === ShipmentStatus.EXCEPTION
                                    ? 'Please provide a reason for this status change...'
                                    : 'Add any notes about this status update...'
                            }
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className={
                                (isCriticalStatusChange(status) || status === ShipmentStatus.EXCEPTION) && !notes.trim()
                                    ? 'border-red-300 focus:border-red-500'
                                    : ''
                            }
                        />
                        {(isCriticalStatusChange(status) || status === ShipmentStatus.EXCEPTION) && (
                            <p className="text-sm text-muted-foreground">
                                {status === ShipmentStatus.DELIVERED && 'Please confirm delivery details and any special notes.'}
                                {status === ShipmentStatus.CANCELLED && 'Please provide the reason for cancellation.'}
                                {status === ShipmentStatus.EXCEPTION && 'Please describe the exception or issue encountered.'}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => handleOpenChange(false)}
                        disabled={isUpdating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateClick}
                        disabled={isUpdating || !status || filteredStatusOptions.length === 0}
                        className='gap-2'
                        variant={isCriticalStatusChange(status) ? 'destructive' : 'default'}
                    >
                        {isUpdating && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isCriticalStatusChange(status) && <AlertTriangle className="h-4 w-4" />}
                        Update Status
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Confirmation Dialog for Critical Status Changes */}
            <Dialog open={showConfirmation} onOpenChange={handleConfirmationChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Confirm Status Change
                        </DialogTitle>
                        <DialogDescription>
                            You are about to change the shipment status to <strong>{getStatusLabel(status)}</strong>.
                            {status === ShipmentStatus.DELIVERED && (
                                <span className="block mt-2 text-green-600">
                                    ✓ This will mark the shipment as successfully delivered and complete the delivery process.
                                </span>
                            )}
                            {status === ShipmentStatus.CANCELLED && (
                                <span className="block mt-2 text-red-600">
                                    ⚠ This will cancel the shipment and it cannot be undone. The shipment will be marked as cancelled permanently.
                                </span>
                            )}
                            <span className="block mt-2 font-medium">
                                Are you sure you want to proceed?
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => handleConfirmationChange(false)}
                            disabled={isUpdating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={performUpdate}
                            disabled={isUpdating}
                            variant={status === ShipmentStatus.CANCELLED ? 'destructive' : 'default'}
                        >
                            {isUpdating && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                            {status === ShipmentStatus.DELIVERED && <CheckCircle className="h-4 w-4 mr-2" />}
                            {status === ShipmentStatus.CANCELLED && <AlertTriangle className="h-4 w-4 mr-2" />}
                            Confirm {getStatusLabel(status)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}