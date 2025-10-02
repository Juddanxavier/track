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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/lead';
import { leadApi } from '@/lib/leadApi';
import { toast } from 'sonner';
import {
    ArrowRightLeft,
    Loader2,
    CheckCircle,
    Package,
    MapPin,
    Weight,
    User,
    Mail,
    AlertTriangle
} from 'lucide-react';
import {
    getStatusDisplayText,
    getStatusBadgeVariant,
    getCountryName
} from '@/lib/leadUtils';

const formSchema = z.object({
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    notes: z.string().optional(),
});

interface ConvertLeadDialogProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ConvertLeadDialog({ lead, open, onOpenChange, onSuccess }: ConvertLeadDialogProps) {
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            trackingNumber: '',
            estimatedDelivery: '',
            notes: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!lead) return;

        try {
            setLoading(true);

            await leadApi.convertToShipment(lead.id, {
                shipmentData: {
                    trackingNumber: values.trackingNumber || undefined,
                    estimatedDelivery: values.estimatedDelivery || undefined,
                },
            });

            toast.success('Lead converted successfully', {
                description: `Lead for ${lead.customerName} has been converted to a shipment`,
            });

            form.reset();
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to convert lead';
            toast.error('Failed to convert lead', {
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

    if (!lead) return null;

    const canConvert = lead.status === 'success';

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <ArrowRightLeft className='h-5 w-5' />
                        Convert Lead to Shipment
                    </DialogTitle>
                    <DialogDescription>
                        Convert this successful lead into a shipment tracking record. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                {/* Lead Summary Section */}
                <div className='space-y-4'>
                    <div className='p-4 bg-muted rounded-lg space-y-3'>
                        <h3 className='font-medium flex items-center gap-2'>
                            <Package className='h-4 w-4' />
                            Lead Summary
                        </h3>

                        {/* Customer Information */}
                        <div className='grid grid-cols-1 gap-2'>
                            <div className='flex items-center gap-2'>
                                <User className='h-4 w-4 text-muted-foreground' />
                                <span className='font-medium'>{lead.customerName}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <Mail className='h-4 w-4 text-muted-foreground' />
                                <span className='text-sm text-muted-foreground'>{lead.customerEmail}</span>
                            </div>
                        </div>

                        {/* Shipping Information */}
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <div className='flex items-center gap-2 mb-1'>
                                    <MapPin className='h-4 w-4 text-muted-foreground' />
                                    <span className='text-sm font-medium'>Route</span>
                                </div>
                                <div className='text-sm'>
                                    {getCountryName(lead.originCountry)} → {getCountryName(lead.destinationCountry)}
                                </div>
                            </div>
                            <div>
                                <div className='flex items-center gap-2 mb-1'>
                                    <Weight className='h-4 w-4 text-muted-foreground' />
                                    <span className='text-sm font-medium'>Weight</span>
                                </div>
                                <div className='text-sm'>{lead.weight}</div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium'>Status:</span>
                            <Badge
                                variant={getStatusBadgeVariant(lead.status) as any}
                                className={lead.status === 'success' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                            >
                                {getStatusDisplayText(lead.status)}
                            </Badge>
                        </div>

                        {/* Notes if any */}
                        {lead.notes && (
                            <div>
                                <span className='text-sm font-medium'>Notes:</span>
                                <p className='text-sm text-muted-foreground mt-1'>{lead.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Conversion Status Check */}
                    {!canConvert && (
                        <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-lg'>
                            <div className='flex items-center gap-2 text-destructive'>
                                <AlertTriangle className='h-4 w-4' />
                                <span className='font-medium'>Cannot Convert Lead</span>
                            </div>
                            <p className='text-sm text-destructive/80 mt-1'>
                                Only leads with "Success" status can be converted to shipments.
                                Current status: {getStatusDisplayText(lead.status)}
                            </p>
                        </div>
                    )}

                    {canConvert && (
                        <div className='p-4 bg-green-50 border border-green-200 rounded-lg'>
                            <div className='flex items-center gap-2 text-green-700'>
                                <CheckCircle className='h-4 w-4' />
                                <span className='font-medium'>Ready for Conversion</span>
                            </div>
                            <p className='text-sm text-green-600 mt-1'>
                                This lead is ready to be converted to a shipment. You can optionally add shipment details below.
                            </p>
                        </div>
                    )}
                </div>

                {/* Conversion Form */}
                {canConvert && (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                            <div>
                                <h3 className='text-lg font-medium mb-4'>Shipment Details (Optional)</h3>

                                <div className='grid grid-cols-2 gap-4'>
                                    <FormField
                                        control={form.control}
                                        name='trackingNumber'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tracking Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder='e.g., TRK123456789'
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
                                        name='estimatedDelivery'
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estimated Delivery</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type='date'
                                                        disabled={loading}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name='notes'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Conversion Notes</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder='Add any notes about the conversion...'
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
                                            Converting...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRightLeft className='mr-2 h-4 w-4' />
                                            Convert to Shipment
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}

                {/* Non-convertible lead footer */}
                {!canConvert && (
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}