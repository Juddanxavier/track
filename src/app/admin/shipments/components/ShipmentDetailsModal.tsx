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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Shipment,
    ShipmentEvent,
    ShipmentStatusType,
    CarrierType,
    ApiSyncStatusType,
    UpdateShipmentSchema
} from '@/types/shipment';
import { toast } from 'sonner';
import {
    Package,
    Truck,
    User,
    MapPin,
    Calendar,
    Clock,
    RefreshCw,
    Edit,
    Save,
    X,
    AlertCircle,
    CheckCircle,
    ExternalLink,
    Phone,
    Mail,
    Weight,
    DollarSign,
    Ruler,
    FileText,
    Activity,
    Loader2,
} from 'lucide-react';

interface ShipmentDetailsModalProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ShipmentWithEvents extends Shipment {
    events: ShipmentEvent[];
}

const editFormSchema = UpdateShipmentSchema.pick({
    customerName: true,
    customerEmail: true,
    customerPhone: true,
    packageDescription: true,
    weight: true,
    value: true,
    notes: true,
    status: true,
});

type EditFormData = z.infer<typeof editFormSchema>;

const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'in-transit', label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
    { value: 'out-for-delivery', label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800' },
    { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800' },
    { value: 'exception', label: 'Exception', color: 'bg-red-100 text-red-800' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
];

const carrierLabels = {
    ups: 'UPS',
    fedex: 'FedEx',
    dhl: 'DHL',
    usps: 'USPS',
};

const syncStatusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
};

export function ShipmentDetailsModal({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: ShipmentDetailsModalProps) {
    const [shipmentData, setShipmentData] = useState<ShipmentWithEvents | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string>('');

    const form = useForm<EditFormData>({
        resolver: zodResolver(editFormSchema),
        defaultValues: {
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            packageDescription: '',
            weight: '',
            value: '',
            notes: '',
            status: 'pending',
        },
    });

    // Fetch detailed shipment data when modal opens
    useEffect(() => {
        if (open && shipment?.id) {
            fetchShipmentDetails();
        }
    }, [open, shipment?.id]);

    // Update form when shipment data changes
    useEffect(() => {
        if (shipmentData && editing) {
            form.reset({
                customerName: shipmentData.customerName || '',
                customerEmail: shipmentData.customerEmail || '',
                customerPhone: shipmentData.customerPhone || '',
                packageDescription: shipmentData.packageDescription || '',
                weight: shipmentData.weight || '',
                value: shipmentData.value || '',
                notes: shipmentData.notes || '',
                status: shipmentData.status,
            });
        }
    }, [shipmentData, editing, form]);

    const fetchShipmentDetails = async () => {
        if (!shipment?.id) return;

        try {
            setLoading(true);
            setError('');

            const response = await fetch(`/api/shipments/${shipment.id}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch shipment details');
            }

            setShipmentData(result.shipment);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch shipment details';
            setError(errorMessage);
            toast.error('Failed to load shipment details', {
                description: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleManualSync = async () => {
        if (!shipmentData?.id) return;

        try {
            setSyncing(true);
            setError('');

            const response = await fetch(`/api/shipments/${shipmentData.id}/sync`, {
                method: 'POST',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to sync shipment');
            }

            toast.success('Shipment synced successfully', {
                description: result.message,
            });

            // Refresh shipment data
            await fetchShipmentDetails();
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to sync shipment';
            setError(errorMessage);
            toast.error('Failed to sync shipment', {
                description: errorMessage,
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveEdit = async (values: EditFormData) => {
        if (!shipmentData?.id) return;

        try {
            setLoading(true);
            setError('');

            const response = await fetch(`/api/shipments/${shipmentData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update shipment');
            }

            toast.success('Shipment updated successfully');

            // Refresh shipment data and exit edit mode
            await fetchShipmentDetails();
            setEditing(false);
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update shipment';
            setError(errorMessage);
            toast.error('Failed to update shipment', {
                description: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading && !syncing) {
            setEditing(false);
            setError('');
            onOpenChange(false);
        }
    };

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return 'Not set';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleString();
    };

    const formatAddress = (address: any) => {
        if (!address) return 'Not available';
        const parts = [
            address.name,
            address.company,
            address.addressLine1,
            address.addressLine2,
            `${address.city}, ${address.state} ${address.postalCode}`,
            address.country,
        ].filter(Boolean);
        return parts.join('\n');
    };

    const getStatusBadge = (status: ShipmentStatusType) => {
        const statusOption = statusOptions.find(s => s.value === status);
        return (
            <Badge className={statusOption?.color || 'bg-gray-100 text-gray-800'}>
                {statusOption?.label || status}
            </Badge>
        );
    };

    const getSyncStatusBadge = (status: ApiSyncStatusType) => {
        return (
            <Badge className={syncStatusColors[status] || 'bg-gray-100 text-gray-800'}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    if (!shipment) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='max-w-4xl max-h-[90vh] overflow-hidden'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Package className='h-5 w-5' />
                        Shipment Details - {shipment.internalTrackingCode}
                    </DialogTitle>
                    <DialogDescription>
                        View and manage shipment information, tracking history, and sync status.
                    </DialogDescription>
                </DialogHeader>

                {loading && !shipmentData ? (
                    <div className='flex items-center justify-center py-8'>
                        <Loader2 className='h-6 w-6 animate-spin mr-2' />
                        Loading shipment details...
                    </div>
                ) : error && !shipmentData ? (
                    <Alert variant='destructive'>
                        <AlertCircle className='h-4 w-4' />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : shipmentData ? (
                    <ScrollArea className='max-h-[calc(90vh-120px)]'>
                        <div className='space-y-6 pr-4'>
                            {/* Error Display */}
                            {error && (
                                <Alert variant='destructive'>
                                    <AlertCircle className='h-4 w-4' />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* Header Actions */}
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-4'>
                                    {getStatusBadge(shipmentData.status)}
                                    {getSyncStatusBadge(shipmentData.apiSyncStatus)}
                                    {shipmentData.needsReview && (
                                        <Badge className='bg-orange-100 text-orange-800'>
                                            Needs Review
                                        </Badge>
                                    )}
                                </div>
                                <div className='flex items-center gap-2'>
                                    {shipmentData.apiSyncStatus === 'failed' && (
                                        <Button
                                            onClick={handleManualSync}
                                            disabled={syncing}
                                            size='sm'
                                            variant='outline'
                                        >
                                            {syncing ? (
                                                <Loader2 className='h-4 w-4 animate-spin mr-2' />
                                            ) : (
                                                <RefreshCw className='h-4 w-4 mr-2' />
                                            )}
                                            Sync Now
                                        </Button>
                                    )}
                                    {!editing ? (
                                        <Button
                                            onClick={() => setEditing(true)}
                                            size='sm'
                                            variant='outline'
                                        >
                                            <Edit className='h-4 w-4 mr-2' />
                                            Edit
                                        </Button>
                                    ) : (
                                        <div className='flex gap-2'>
                                            <Button
                                                onClick={() => setEditing(false)}
                                                size='sm'
                                                variant='outline'
                                            >
                                                <X className='h-4 w-4 mr-2' />
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={form.handleSubmit(handleSaveEdit)}
                                                size='sm'
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                                                ) : (
                                                    <Save className='h-4 w-4 mr-2' />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tracking Information */}
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <Truck className='h-4 w-4' />
                                        Tracking Information
                                    </h3>
                                    <div className='space-y-2 text-sm'>
                                        <div>
                                            <span className='font-medium'>Internal Code:</span>
                                            <span className='ml-2 font-mono'>{shipmentData.internalTrackingCode}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Carrier:</span>
                                            <span className='ml-2'>{carrierLabels[shipmentData.carrier as keyof typeof carrierLabels]}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Carrier Tracking:</span>
                                            <span className='ml-2 font-mono'>{shipmentData.carrierTrackingNumber}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Created:</span>
                                            <span className='ml-2'>{formatDate(shipmentData.createdAt)}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Last Updated:</span>
                                            <span className='ml-2'>{formatDate(shipmentData.updatedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <Activity className='h-4 w-4' />
                                        API Sync Status
                                    </h3>
                                    <div className='space-y-2 text-sm'>
                                        <div>
                                            <span className='font-medium'>Status:</span>
                                            <span className='ml-2'>{getSyncStatusBadge(shipmentData.apiSyncStatus)}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Last Sync:</span>
                                            <span className='ml-2'>{formatDate(shipmentData.lastApiSync)}</span>
                                        </div>
                                        {shipmentData.apiError && (
                                            <div>
                                                <span className='font-medium text-red-600'>Error:</span>
                                                <p className='ml-2 text-red-600 text-xs mt-1'>{shipmentData.apiError}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Customer Information */}
                            {editing ? (
                                <Form {...form}>
                                    <div className='space-y-4'>
                                        <h3 className='font-semibold flex items-center gap-2'>
                                            <User className='h-4 w-4' />
                                            Customer Information
                                        </h3>
                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                            <FormField
                                                control={form.control}
                                                name='customerName'
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Customer Name</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name='customerEmail'
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input type='email' {...field} />
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
                                                        <FormLabel>Phone</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name='status'
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Status</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {statusOptions.map((status) => (
                                                                    <SelectItem key={status.value} value={status.value}>
                                                                        {status.label}
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
                                </Form>
                            ) : (
                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <User className='h-4 w-4' />
                                        Customer Information
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                                        <div>
                                            <span className='font-medium'>Name:</span>
                                            <span className='ml-2'>{shipmentData.customerName || 'Not available'}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Email:</span>
                                            <span className='ml-2'>{shipmentData.customerEmail || 'Not available'}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Phone:</span>
                                            <span className='ml-2'>{shipmentData.customerPhone || 'Not available'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            {/* Package Information */}
                            {editing ? (
                                <div className='space-y-4'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <Package className='h-4 w-4' />
                                        Package Information
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                        <FormField
                                            control={form.control}
                                            name='packageDescription'
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name='weight'
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Weight</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name='value'
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Value</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
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
                                                <FormLabel>Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea {...field} rows={3} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ) : (
                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <Package className='h-4 w-4' />
                                        Package Information
                                    </h3>
                                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                                        <div>
                                            <span className='font-medium'>Description:</span>
                                            <span className='ml-2'>{shipmentData.packageDescription || 'Not available'}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Weight:</span>
                                            <span className='ml-2'>{shipmentData.weight || 'Not available'}</span>
                                        </div>
                                        <div>
                                            <span className='font-medium'>Value:</span>
                                            <span className='ml-2'>{shipmentData.value || 'Not available'}</span>
                                        </div>
                                    </div>
                                    {shipmentData.notes && (
                                        <div>
                                            <span className='font-medium'>Notes:</span>
                                            <p className='mt-1 text-sm text-muted-foreground'>{shipmentData.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Separator />

                            {/* Addresses */}
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <MapPin className='h-4 w-4' />
                                        Origin Address
                                    </h3>
                                    <pre className='text-sm text-muted-foreground whitespace-pre-wrap'>
                                        {formatAddress(shipmentData.originAddress)}
                                    </pre>
                                </div>
                                <div className='space-y-3'>
                                    <h3 className='font-semibold flex items-center gap-2'>
                                        <MapPin className='h-4 w-4' />
                                        Destination Address
                                    </h3>
                                    <pre className='text-sm text-muted-foreground whitespace-pre-wrap'>
                                        {formatAddress(shipmentData.destinationAddress)}
                                    </pre>
                                </div>
                            </div>

                            <Separator />

                            {/* Delivery Information */}
                            <div className='space-y-3'>
                                <h3 className='font-semibold flex items-center gap-2'>
                                    <Calendar className='h-4 w-4' />
                                    Delivery Information
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                                    <div>
                                        <span className='font-medium'>Estimated Delivery:</span>
                                        <span className='ml-2'>{formatDate(shipmentData.estimatedDelivery)}</span>
                                    </div>
                                    <div>
                                        <span className='font-medium'>Actual Delivery:</span>
                                        <span className='ml-2'>{formatDate(shipmentData.actualDelivery)}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Tracking Events */}
                            <div className='space-y-4'>
                                <h3 className='font-semibold flex items-center gap-2'>
                                    <Clock className='h-4 w-4' />
                                    Tracking History ({shipmentData.events.length} events)
                                </h3>
                                {shipmentData.events.length > 0 ? (
                                    <div className='space-y-3'>
                                        {shipmentData.events.map((event, index) => (
                                            <div key={event.id} className='flex gap-3 pb-3 border-b last:border-b-0'>
                                                <div className='flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2'></div>
                                                <div className='flex-1 space-y-1'>
                                                    <div className='flex items-center justify-between'>
                                                        <span className='font-medium text-sm'>{event.description}</span>
                                                        <span className='text-xs text-muted-foreground'>
                                                            {formatDate(event.eventTime)}
                                                        </span>
                                                    </div>
                                                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                                        <span>Source: {event.source}</span>
                                                        {event.status && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Status: {event.status}</span>
                                                            </>
                                                        )}
                                                        {event.location && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Location: {event.location}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='text-sm text-muted-foreground'>No tracking events available.</p>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}