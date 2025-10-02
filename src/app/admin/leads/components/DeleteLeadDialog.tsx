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
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/lead';
import { leadApi } from '@/lib/leadApi';
import { toast } from 'sonner';
import { Trash2, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import {
    getStatusDisplayText,
    getStatusBadgeVariant,
    getCountryName
} from '@/lib/leadUtils';

interface DeleteLeadDialogProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function DeleteLeadDialog({ lead, open, onOpenChange, onSuccess }: DeleteLeadDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!lead) return;

        try {
            setLoading(true);
            await leadApi.deleteLead(lead.id);
            toast.success('Lead deleted successfully', {
                description: `Lead for ${lead.customerName} has been removed from the system`,
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete lead';
            toast.error('Failed to delete lead', {
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

    if (!lead) return null;

    const isSuccessfulLead = lead.status === 'success' || lead.status === 'converted';
    const route = `${getCountryName(lead.originCountry)} → ${getCountryName(lead.destinationCountry)}`;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[500px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-destructive'>
                        <Trash2 className='h-5 w-5' />
                        Delete Lead
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this lead? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                {/* Lead Information Display */}
                <div className='space-y-4'>
                    <div className='rounded-lg border p-4 bg-muted/50'>
                        <div className='space-y-2'>
                            <div className='flex items-center justify-between'>
                                <span className='font-medium'>{lead.customerName}</span>
                                <Badge
                                    variant={getStatusBadgeVariant(lead.status) as any}
                                    className={lead.status === 'success' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                >
                                    {getStatusDisplayText(lead.status)}
                                </Badge>
                            </div>
                            <div className='text-sm text-muted-foreground'>
                                <div>{lead.customerEmail}</div>
                                <div>{route}</div>
                                <div>Weight: {lead.weight}</div>
                                <div>Created: {new Date(lead.createdAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Warning for successful leads */}
                    {isSuccessfulLead && (
                        <div className='rounded-lg border border-amber-200 bg-amber-50 p-4'>
                            <div className='flex items-center gap-2 text-amber-800'>
                                <AlertTriangle className='h-4 w-4' />
                                <span className='font-medium'>Warning: Successful Lead</span>
                            </div>
                            <p className='text-sm text-amber-700 mt-1'>
                                {lead.status === 'success'
                                    ? 'This lead has been marked as successful. Consider converting it to a shipment before deletion.'
                                    : 'This lead has already been converted to a shipment. Deleting it may affect tracking records.'
                                }
                            </p>
                        </div>
                    )}

                    {/* Additional warning for converted leads */}
                    {lead.status === 'converted' && lead.shipmentId && (
                        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
                            <div className='flex items-center gap-2 text-red-800'>
                                <AlertTriangle className='h-4 w-4' />
                                <span className='font-medium'>Converted Lead Warning</span>
                            </div>
                            <p className='text-sm text-red-700 mt-1'>
                                This lead is linked to shipment ID: <code className='bg-red-100 px-1 rounded'>{lead.shipmentId}</code>.
                                Deleting this lead may break the connection to the shipment record.
                            </p>
                        </div>
                    )}

                    {/* Notes display if available */}
                    {lead.notes && (
                        <div className='rounded-lg border p-3'>
                            <div className='text-sm font-medium mb-1'>Notes:</div>
                            <div className='text-sm text-muted-foreground'>{lead.notes}</div>
                        </div>
                    )}

                    {/* Failure reason display if available */}
                    {lead.failureReason && (
                        <div className='rounded-lg border border-red-200 bg-red-50 p-3'>
                            <div className='text-sm font-medium mb-1 text-red-800'>Failure Reason:</div>
                            <div className='text-sm text-red-700'>{lead.failureReason}</div>
                        </div>
                    )}
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
                                {isSuccessfulLead ? 'Delete Anyway' : 'Delete Lead'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}