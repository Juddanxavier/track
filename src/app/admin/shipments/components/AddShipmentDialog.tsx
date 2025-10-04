/** @format */

'use client';

import { useState } from 'react';
import * as React from 'react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Carrier } from '@/types/shipment';
import { toast } from 'sonner';
import {
    Plus,
    Loader2,
    Package,
    Truck,
    CheckCircle,
    AlertCircle,
    Copy,
} from 'lucide-react';

interface AddShipmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

// Simplified form schema for tracking number and carrier only
const formSchema = z.object({
    carrierTrackingNumber: z.string().min(1, 'Tracking number is required'),
    carrier: z.enum(['ups', 'fedex', 'dhl', 'usps'], {
        message: 'Please select a carrier',
    }),
    notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const carrierOptions = [
    { value: Carrier.UPS, label: 'UPS', description: 'United Parcel Service' },
    { value: Carrier.FEDEX, label: 'FedEx', description: 'Federal Express' },
    { value: Carrier.DHL, label: 'DHL', description: 'DHL Express' },
    { value: Carrier.USPS, label: 'USPS', description: 'United States Postal Service' },
];

// Tracking number validation patterns for real-time validation
const trackingPatterns = {
    [Carrier.UPS]: /^1Z[0-9A-Z]{16}$/,
    [Carrier.FEDEX]: /^[0-9]{12,14}$/,
    [Carrier.DHL]: /^[0-9]{10,11}$/,
    [Carrier.USPS]: /^[0-9]{20,22}$/,
};

// Tracking number format hints for users
const trackingFormatHints = {
    [Carrier.UPS]: 'Format: 1Z followed by 16 characters (e.g., 1Z999AA1234567890)',
    [Carrier.FEDEX]: 'Format: 12-14 digits (e.g., 123456789012)',
    [Carrier.DHL]: 'Format: 10-11 digits (e.g., 1234567890)',
    [Carrier.USPS]: 'Format: 20-22 digits (e.g., 12345678901234567890)',
};

export function AddShipmentDialog({
    open,
    onOpenChange,
    onSuccess,
}: AddShipmentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [validationError, setValidationError] = useState<string>('');
    const [createdShipment, setCreatedShipment] = useState<{ internalTrackingCode: string } | null>(null);
    const [realTimeValidation, setRealTimeValidation] = useState<string>('');

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            carrierTrackingNumber: '',
            carrier: undefined,
            notes: '',
        },
    });

    const watchedCarrier = form.watch('carrier');
    const watchedTrackingNumber = form.watch('carrierTrackingNumber');

    // Real-time validation for tracking number format
    const validateTrackingNumber = (trackingNumber: string, carrier: string) => {
        if (!trackingNumber || !carrier) return '';

        const pattern = trackingPatterns[carrier as keyof typeof trackingPatterns];
        if (pattern && !pattern.test(trackingNumber)) {
            return `Invalid ${carrier.toUpperCase()} tracking number format`;
        }
        return '';
    };

    // Update real-time validation when tracking number or carrier changes
    React.useEffect(() => {
        if (watchedTrackingNumber && watchedCarrier) {
            const validationMessage = validateTrackingNumber(watchedTrackingNumber, watchedCarrier);
            setRealTimeValidation(validationMessage);
        } else {
            setRealTimeValidation('');
        }
    }, [watchedTrackingNumber, watchedCarrier]);

    const onSubmit = async (values: FormData) => {
        try {
            setLoading(true);
            setValidationError('');
            setCreatedShipment(null);

            // Final validation check
            const validationErr = validateTrackingNumber(values.carrierTrackingNumber, values.carrier);
            if (validationErr) {
                setValidationError(validationErr);
                return;
            }

            // Create shipment with tracking number and carrier
            const response = await fetch('/api/shipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    carrierTrackingNumber: values.carrierTrackingNumber,
                    carrier: values.carrier,
                    notes: values.notes,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create shipment');
            }

            setCreatedShipment({ internalTrackingCode: result.internalTrackingCode });

            toast.success('Shipment created successfully', {
                description: `Internal tracking code: ${result.internalTrackingCode}`,
            });

            // Auto-close after showing success for 3 seconds
            setTimeout(() => {
                form.reset();
                setCreatedShipment(null);
                setValidationError('');
                setRealTimeValidation('');
                onSuccess();
                onOpenChange(false);
            }, 3000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create shipment';
            toast.error('Failed to create shipment', {
                description: errorMessage,
            });
            setValidationError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading && !createdShipment) {
            form.reset();
            setValidationError('');
            setRealTimeValidation('');
            onOpenChange(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard');
        } catch (error) {
            toast.error('Failed to copy to clipboard');
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Plus className='h-5 w-5' />
                        Add New Shipment
                    </DialogTitle>
                    <DialogDescription>
                        Enter a tracking number and select the carrier. We'll automatically fetch shipment details from the carrier's API.
                    </DialogDescription>
                </DialogHeader>

                {/* Success State */}
                {createdShipment && (
                    <div className='space-y-4'>
                        <Alert className='border-green-200 bg-green-50'>
                            <CheckCircle className='h-4 w-4 text-green-600' />
                            <AlertDescription className='text-green-800'>
                                <div className='space-y-2'>
                                    <p className='font-medium'>Shipment created successfully!</p>
                                    <div className='flex items-center gap-2'>
                                        <span className='text-sm'>Internal tracking code:</span>
                                        <code className='bg-green-100 px-2 py-1 rounded text-sm font-mono'>
                                            {createdShipment.internalTrackingCode}
                                        </code>
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='sm'
                                            onClick={() => copyToClipboard(createdShipment.internalTrackingCode)}
                                            className='h-6 w-6 p-0'
                                        >
                                            <Copy className='h-3 w-3' />
                                        </Button>
                                    </div>
                                    <p className='text-xs text-green-600'>
                                        This dialog will close automatically in a few seconds.
                                    </p>
                                </div>
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {/* Form State */}
                {!createdShipment && (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                            {/* Carrier Selection */}
                            <FormField
                                control={form.control}
                                name='carrier'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Carrier *</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            disabled={loading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder='Select a carrier' />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {carrierOptions.map((carrier) => (
                                                    <SelectItem key={carrier.value} value={carrier.value}>
                                                        <div className='flex items-center gap-2'>
                                                            <Truck className='h-4 w-4' />
                                                            <div>
                                                                <div className='font-medium'>{carrier.label}</div>
                                                                <div className='text-xs text-muted-foreground'>
                                                                    {carrier.description}
                                                                </div>
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

                            {/* Tracking Number Input */}
                            <FormField
                                control={form.control}
                                name='carrierTrackingNumber'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tracking Number *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder='Enter tracking number'
                                                disabled={loading}
                                                {...field}
                                            />
                                        </FormControl>
                                        {watchedCarrier && (
                                            <p className='text-xs text-muted-foreground'>
                                                {trackingFormatHints[watchedCarrier as keyof typeof trackingFormatHints]}
                                            </p>
                                        )}
                                        {realTimeValidation && (
                                            <p className='text-xs text-red-600 flex items-center gap-1'>
                                                <AlertCircle className='h-3 w-3' />
                                                {realTimeValidation}
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Optional Notes */}
                            <FormField
                                control={form.control}
                                name='notes'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder='Add any additional notes about this shipment...'
                                                disabled={loading}
                                                rows={3}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Error Display */}
                            {validationError && (
                                <Alert variant='destructive'>
                                    <AlertCircle className='h-4 w-4' />
                                    <AlertDescription>{validationError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Form Actions */}
                            <DialogFooter>
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
                                    disabled={loading || !!realTimeValidation}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            Creating Shipment...
                                        </>
                                    ) : (
                                        <>
                                            <Package className='mr-2 h-4 w-4' />
                                            Create Shipment
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