/** @format */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { shipmentApi } from '@/lib/shipmentApi';
import { userApi } from '@/lib/userApi';
import { Shipment, ShipmentEvent, ShipmentWithEvents } from '@/types/shipment';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, User, MapPin, Truck, Calendar, Clock, Edit, RefreshCw, Loader2 } from 'lucide-react';
import { ManualStatusUpdateDialog } from '../components/ManualStatusUpdateDialog';
import { EditShipmentDialog } from '../components/EditShipmentDialog';
import { format } from 'date-fns';

interface ShipmentDetailResponse {
    shipment: ShipmentWithEvents;
    lead?: {
        id: string;
        customerName: string;
        customerEmail: string;
        customerPhone?: string;
        originCountry: string;
        destinationCountry: string;
        weight?: string;
        status: string;
        createdAt: Date;
    };
}

export default function ShipmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const shipmentId = params.id as string;

    const [shipmentData, setShipmentData] = useState<ShipmentDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
    const [showStatusUpdateDialog, setShowStatusUpdateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);

    const loadShipmentData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/shipments/${shipmentId}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to fetch shipment' }));
                throw new Error(error.error || 'Failed to fetch shipment');
            }

            const data: ShipmentDetailResponse = await response.json();
            setShipmentData(data);
        } catch (error) {
            console.error('Error loading shipment:', error);
            toast.error('Failed to load shipment details', {
                description: error instanceof Error ? error.message : 'Please try again',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await userApi.getUsers({ perPage: 100 });
            const map = new Map<string, string>();
            response.users.forEach(user => {
                map.set(user.id, user.name);
            });
            setUserMap(map);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    useEffect(() => {
        if (shipmentId) {
            loadShipmentData();
            loadUsers();
        }
    }, [shipmentId]);

    const handleStatusUpdate = () => {
        setShowStatusUpdateDialog(false);
        loadShipmentData(); // Reload to get updated data
    };

    const handleEdit = () => {
        setShowEditDialog(false);
        loadShipmentData(); // Reload to get updated data
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading shipment details...</span>
                </div>
            </div>
        );
    }

    if (!shipmentData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Package className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Shipment not found</h3>
                    <p className="text-muted-foreground">The shipment you're looking for doesn't exist or you don't have permission to view it.</p>
                </div>
                <Button onClick={() => router.push('/admin/shipments')} variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Shipments
                </Button>
            </div>
        );
    }

    const { shipment, lead } = shipmentData;

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/admin/shipments')}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Shipments
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Shipment Details</h1>
                        <p className="text-muted-foreground">Tracking Code: {shipment.trackingCode}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowEditDialog(true)}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Shipment
                    </Button>
                    <Button
                        onClick={() => setShowStatusUpdateDialog(true)}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Update Status
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Shipment Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Shipment Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                                    <Badge variant={getStatusVariant(shipment.status)} className="mt-1">
                                        {getStatusLabel(shipment.status)}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Courier</p>
                                    <p className="font-medium">{shipment.courier}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Courier Tracking</p>
                                    <p className="font-medium">{shipment.courierTrackingNumber || 'Not provided'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Shipping Method</p>
                                    <p className="font-medium">{shipment.shippingMethod || 'Not specified'}</p>
                                </div>
                            </div>

                            {shipment.packageDescription && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Package Description</p>
                                    <p className="font-medium">{shipment.packageDescription}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                {shipment.weight && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Weight</p>
                                        <p className="font-medium">{shipment.weight}</p>
                                    </div>
                                )}
                                {shipment.value && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Value</p>
                                        <p className="font-medium">{shipment.value}</p>
                                    </div>
                                )}
                                {shipment.dimensions && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Dimensions</p>
                                        <p className="font-medium">
                                            {shipment.dimensions.length} × {shipment.dimensions.width} × {shipment.dimensions.height} {shipment.dimensions.unit}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {(shipment.notes || shipment.specialInstructions) && (
                                <>
                                    <Separator />
                                    {shipment.notes && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Notes</p>
                                            <p className="text-sm">{shipment.notes}</p>
                                        </div>
                                    )}
                                    {shipment.specialInstructions && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Special Instructions</p>
                                            <p className="text-sm">{shipment.specialInstructions}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Customer Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Customer Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                                    <p className="font-medium">{shipment.customerName}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                                    <p className="font-medium">{shipment.customerEmail}</p>
                                </div>
                                {shipment.customerPhone && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                                        <p className="font-medium">{shipment.customerPhone}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Addresses */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Addresses
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">ORIGIN</h4>
                                    <div className="space-y-1 text-sm">
                                        <p className="font-medium">{shipment.originAddress.name}</p>
                                        {shipment.originAddress.company && (
                                            <p>{shipment.originAddress.company}</p>
                                        )}
                                        <p>{shipment.originAddress.addressLine1}</p>
                                        {shipment.originAddress.addressLine2 && (
                                            <p>{shipment.originAddress.addressLine2}</p>
                                        )}
                                        <p>
                                            {shipment.originAddress.city}, {shipment.originAddress.state} {shipment.originAddress.postalCode}
                                        </p>
                                        <p>{shipment.originAddress.country}</p>
                                        {shipment.originAddress.phone && (
                                            <p>Phone: {shipment.originAddress.phone}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">DESTINATION</h4>
                                    <div className="space-y-1 text-sm">
                                        <p className="font-medium">{shipment.destinationAddress.name}</p>
                                        {shipment.destinationAddress.company && (
                                            <p>{shipment.destinationAddress.company}</p>
                                        )}
                                        <p>{shipment.destinationAddress.addressLine1}</p>
                                        {shipment.destinationAddress.addressLine2 && (
                                            <p>{shipment.destinationAddress.addressLine2}</p>
                                        )}
                                        <p>
                                            {shipment.destinationAddress.city}, {shipment.destinationAddress.state} {shipment.destinationAddress.postalCode}
                                        </p>
                                        <p>{shipment.destinationAddress.country}</p>
                                        {shipment.destinationAddress.phone && (
                                            <p>Phone: {shipment.destinationAddress.phone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Delivery Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Delivery Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {shipment.estimatedDelivery && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Estimated Delivery</p>
                                    <p className="font-medium">
                                        {format(new Date(shipment.estimatedDelivery), 'PPP')}
                                    </p>
                                </div>
                            )}
                            {shipment.actualDelivery && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Actual Delivery</p>
                                    <p className="font-medium">
                                        {format(new Date(shipment.actualDelivery), 'PPP p')}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Created</p>
                                <p className="font-medium">
                                    {format(new Date(shipment.createdAt), 'PPP p')}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                                <p className="font-medium">
                                    {format(new Date(shipment.updatedAt), 'PPP p')}
                                </p>
                            </div>
                            {shipment.createdBy && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Created By</p>
                                    <p className="font-medium">
                                        {userMap.get(shipment.createdBy) || shipment.createdBy}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Lead Information */}
                    {lead && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5" />
                                    Related Lead
                                </CardTitle>
                                <CardDescription>
                                    This shipment was created from a lead
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Lead ID</p>
                                    <p className="font-medium font-mono text-sm">{lead.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Original Route</p>
                                    <p className="font-medium">{lead.originCountry} → {lead.destinationCountry}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Lead Status</p>
                                    <Badge variant="outline">{lead.status}</Badge>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Lead Created</p>
                                    <p className="text-sm">{format(new Date(lead.createdAt), 'PPP')}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/admin/leads?leadId=${lead.id}`)}
                                    className="w-full"
                                >
                                    View Original Lead
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* API Integration */}
                    {shipment.apiProvider && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">API Integration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Provider</p>
                                    <p className="font-medium capitalize">{shipment.apiProvider}</p>
                                </div>
                                {shipment.apiTrackingId && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">API Tracking ID</p>
                                        <p className="font-medium font-mono text-sm">{shipment.apiTrackingId}</p>
                                    </div>
                                )}
                                {shipment.lastApiSync && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                                        <p className="text-sm">{format(new Date(shipment.lastApiSync), 'PPP p')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Event History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Event History
                    </CardTitle>
                    <CardDescription>
                        Chronological history of all shipment events and status changes
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {shipment.events && shipment.events.length > 0 ? (
                        <div className="space-y-4">
                            {shipment.events.map((event, index) => (
                                <div key={event.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${getEventSourceColor(event.source)}`} />
                                        {index < shipment.events.length - 1 && (
                                            <div className="w-px h-8 bg-border mt-2" />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">{event.description}</p>
                                                {event.status && (
                                                    <Badge variant={getStatusVariant(event.status)} className="text-xs">
                                                        {getStatusLabel(event.status)}
                                                    </Badge>
                                                )}
                                                {/* Conflict indicators */}
                                                {event.metadata?.conflictType && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        {event.metadata.conflictType === 'api_manual_conflict' && '⚠ Conflict'}
                                                        {event.metadata.conflictType === 'rapid_status_changes' && '⚡ Rapid Changes'}
                                                    </Badge>
                                                )}
                                                {/* Manual override indicator */}
                                                {event.metadata?.adminOverride && (
                                                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                                                        Admin Override
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${event.source === 'manual' ? 'border-orange-300 text-orange-600' :
                                                            event.source === 'api' ? 'border-blue-300 text-blue-600' :
                                                                'border-green-300 text-green-600'
                                                        }`}
                                                >
                                                    {getSourceLabel(event.source)}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(event.eventTime), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                        </div>
                                        {event.location && (
                                            <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                                        )}
                                        {/* Enhanced manual update information */}
                                        {event.source === 'manual' && event.sourceId && (
                                            <div className="mt-1 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                                                <p className="text-orange-700 font-medium">
                                                    Manual Update by: {userMap.get(event.sourceId) || event.sourceId}
                                                </p>
                                                <p className="text-orange-600">
                                                    Recorded at: {format(new Date(event.recordedAt || event.eventTime), 'MMM d, yyyy h:mm:ss a')}
                                                </p>
                                            </div>
                                        )}
                                        {/* Conflict details */}
                                        {event.metadata?.conflictType === 'api_manual_conflict' && (
                                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                                <p className="text-red-700 font-medium">⚠ Status Conflict Detected</p>
                                                <p className="text-red-600">
                                                    API Status: {event.metadata.apiStatus} → Manual Override: {event.metadata.manualStatus}
                                                </p>
                                                <p className="text-red-500">
                                                    API updated at: {format(new Date(event.metadata.apiEventTime), 'h:mm:ss a')}
                                                </p>
                                            </div>
                                        )}
                                        {/* Rapid changes details */}
                                        {event.metadata?.conflictType === 'rapid_status_changes' && (
                                            <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                                <p className="text-yellow-700 font-medium">⚡ Rapid Status Changes</p>
                                                <p className="text-yellow-600">
                                                    {event.metadata.recentChangesCount} changes in last 5 minutes
                                                </p>
                                                {event.metadata.recentChanges && (
                                                    <div className="mt-1 space-y-1">
                                                        {event.metadata.recentChanges.slice(0, 3).map((change: any, idx: number) => (
                                                            <p key={idx} className="text-yellow-500">
                                                                {change.status} ({change.source}) at {format(new Date(change.eventTime), 'h:mm a')}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No events recorded yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialogs */}
            <ManualStatusUpdateDialog
                shipment={shipment}
                open={showStatusUpdateDialog}
                onOpenChange={setShowStatusUpdateDialog}
                onSuccess={handleStatusUpdate}
            />

            <EditShipmentDialog
                shipment={shipment}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSuccess={handleEdit}
            />
        </div>
    );
}

// Helper functions
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case 'delivered':
            return 'default';
        case 'in-transit':
        case 'out-for-delivery':
            return 'secondary';
        case 'exception':
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'in-transit':
            return 'In Transit';
        case 'out-for-delivery':
            return 'Out for Delivery';
        case 'delivered':
            return 'Delivered';
        case 'exception':
            return 'Exception';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status;
    }
}

function getEventSourceColor(source: string): string {
    switch (source) {
        case 'api':
            return 'bg-blue-500';
        case 'manual':
            return 'bg-orange-500';
        case 'webhook':
            return 'bg-green-500';
        default:
            return 'bg-gray-500';
    }
}

function getSourceLabel(source: string): string {
    switch (source) {
        case 'api':
            return 'API';
        case 'manual':
            return 'Manual';
        case 'webhook':
            return 'Webhook';
        default:
            return source;
    }
}