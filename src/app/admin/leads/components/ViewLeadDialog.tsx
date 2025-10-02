/** @format */

'use client';

import { Lead } from '@/types/lead';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadActivityLog } from './LeadActivityLog';
import {
    Eye,
    User,
    Mail,
    Phone,
    MapPin,
    Weight,
    Calendar,
    FileText,
    AlertTriangle,
    ArrowRightLeft,
} from 'lucide-react';
import {
    getStatusDisplayText,
    getStatusBadgeVariant,
    getCountryName,
    formatLeadCreatedDate,
    parseWeight,
} from '@/lib/leadUtils';

interface ViewLeadDialogProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userMap?: Map<string, string>;
}

export function ViewLeadDialog({ lead, open, onOpenChange, userMap = new Map() }: ViewLeadDialogProps) {
    if (!lead) return null;

    const handleClose = () => {
        onOpenChange(false);
    };

    const parsedWeight = parseWeight(lead.weight);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[900px] max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Eye className='h-5 w-5' />
                        Lead Details: {lead.customerName}
                    </DialogTitle>
                    <DialogDescription>
                        View comprehensive lead information and activity history
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue='details' className='w-full'>
                    <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value='details'>Lead Details</TabsTrigger>
                        <TabsTrigger value='activity'>Activity Log</TabsTrigger>
                    </TabsList>

                    <TabsContent value='details' className='space-y-6 mt-6'>
                        {/* Status and Basic Info */}
                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-3'>
                                <Badge
                                    variant={getStatusBadgeVariant(lead.status) as any}
                                    className={lead.status === 'success' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                >
                                    {getStatusDisplayText(lead.status)}
                                </Badge>
                                <div className='text-sm text-muted-foreground'>
                                    ID: {lead.id}
                                </div>
                            </div>
                            <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                                <Calendar className='h-4 w-4' />
                                Created: {formatLeadCreatedDate(lead.createdAt)}
                            </div>
                        </div>

                        <Separator />

                        {/* Customer Information */}
                        <div>
                            <h3 className='text-lg font-semibold mb-4 flex items-center gap-2'>
                                <User className='h-5 w-5' />
                                Customer Information
                            </h3>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div>
                                    <label className='text-sm font-medium text-muted-foreground'>Name</label>
                                    <div className='text-sm font-medium'>{lead.customerName}</div>
                                </div>
                                <div>
                                    <label className='text-sm font-medium text-muted-foreground'>Email</label>
                                    <div className='flex items-center gap-2 text-sm'>
                                        <Mail className='h-4 w-4 text-muted-foreground' />
                                        {lead.customerEmail}
                                    </div>
                                </div>
                                {lead.customerPhone && (
                                    <div>
                                        <label className='text-sm font-medium text-muted-foreground'>Phone</label>
                                        <div className='flex items-center gap-2 text-sm'>
                                            <Phone className='h-4 w-4 text-muted-foreground' />
                                            {lead.customerPhone}
                                        </div>
                                    </div>
                                )}
                                {lead.linkedCustomer && (
                                    <div>
                                        <label className='text-sm font-medium text-muted-foreground'>Linked Customer</label>
                                        <div className='text-sm'>
                                            <div className='font-medium text-blue-600'>{lead.linkedCustomer.name}</div>
                                            <div className='text-xs text-muted-foreground'>
                                                {lead.linkedCustomer.email}
                                                {lead.linkedCustomer.role && ` • ${lead.linkedCustomer.role}`}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Shipping Information */}
                        <div>
                            <h3 className='text-lg font-semibold mb-4 flex items-center gap-2'>
                                <MapPin className='h-5 w-5' />
                                Shipping Information
                            </h3>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div>
                                    <label className='text-sm font-medium text-muted-foreground'>Route</label>
                                    <div className='flex items-center gap-2 text-sm'>
                                        <span className='font-medium'>{getCountryName(lead.originCountry)}</span>
                                        <ArrowRightLeft className='h-4 w-4 text-muted-foreground' />
                                        <span className='font-medium'>{getCountryName(lead.destinationCountry)}</span>
                                    </div>
                                    <div className='text-xs text-muted-foreground mt-1'>
                                        {lead.originCountry} → {lead.destinationCountry}
                                    </div>
                                </div>
                                <div>
                                    <label className='text-sm font-medium text-muted-foreground'>Weight</label>
                                    <div className='flex items-center gap-2 text-sm'>
                                        <Weight className='h-4 w-4 text-muted-foreground' />
                                        <span className='font-medium'>
                                            {parsedWeight ? `${parsedWeight.value} ${parsedWeight.unit}` : lead.weight}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Assignment and Status Details */}
                        <div>
                            <h3 className='text-lg font-semibold mb-4'>Assignment & Status</h3>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div>
                                    <label className='text-sm font-medium text-muted-foreground'>Assigned To</label>
                                    <div className='text-sm'>
                                        {lead.assignedTo ? (
                                            <span className='font-medium'>
                                                {userMap.get(lead.assignedTo) || lead.assignedTo}
                                            </span>
                                        ) : (
                                            <span className='text-muted-foreground italic'>Unassigned</span>
                                        )}
                                    </div>
                                </div>
                                {lead.contactedAt && (
                                    <div>
                                        <label className='text-sm font-medium text-muted-foreground'>Contacted At</label>
                                        <div className='text-sm'>
                                            {new Date(lead.contactedAt).toLocaleString()}
                                        </div>
                                    </div>
                                )}
                                {lead.convertedAt && (
                                    <div>
                                        <label className='text-sm font-medium text-muted-foreground'>Converted At</label>
                                        <div className='text-sm'>
                                            {new Date(lead.convertedAt).toLocaleString()}
                                        </div>
                                    </div>
                                )}
                                {lead.shipmentId && (
                                    <div>
                                        <label className='text-sm font-medium text-muted-foreground'>Shipment ID</label>
                                        <div className='text-sm font-medium text-blue-600'>
                                            {lead.shipmentId}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes and Failure Reason */}
                        {(lead.notes || lead.failureReason) && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className='text-lg font-semibold mb-4 flex items-center gap-2'>
                                        <FileText className='h-5 w-5' />
                                        Additional Information
                                    </h3>
                                    <div className='space-y-4'>
                                        {lead.notes && (
                                            <div>
                                                <label className='text-sm font-medium text-muted-foreground'>Notes</label>
                                                <div className='mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap'>
                                                    {lead.notes}
                                                </div>
                                            </div>
                                        )}
                                        {lead.failureReason && (
                                            <div>
                                                <label className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                                                    <AlertTriangle className='h-4 w-4 text-destructive' />
                                                    Failure Reason
                                                </label>
                                                <div className='mt-1 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm whitespace-pre-wrap'>
                                                    {lead.failureReason}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value='activity' className='mt-6'>
                        <LeadActivityLog leadId={lead.id} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}