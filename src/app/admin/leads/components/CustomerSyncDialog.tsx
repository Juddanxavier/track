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
import {
    Loader2,
    RefreshCw,
    Unlink,
    ArrowRight,
    User,
    Mail,
    Phone,
    AlertTriangle
} from 'lucide-react';
import {
    getCustomerSyncSuggestion,
    validateCustomerLinkage,
    formatCustomerRelationshipStatus
} from '@/lib/leadUtils';

interface CustomerSyncDialogProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CustomerSyncDialog({ lead, open, onOpenChange, onSuccess }: CustomerSyncDialogProps) {
    const [loading, setLoading] = useState(false);

    if (!lead || !lead.customerId || !lead.linkedCustomer) {
        return null;
    }

    const syncSuggestion = getCustomerSyncSuggestion(lead);
    const validation = validateCustomerLinkage(lead);
    const relationshipStatus = formatCustomerRelationshipStatus(lead);

    const handleSync = async (action: 'update_lead_from_customer' | 'update_customer_from_lead' | 'unlink_customer') => {
        try {
            setLoading(true);

            await leadApi.syncCustomer(lead.id, action);

            let message = '';
            switch (action) {
                case 'update_lead_from_customer':
                    message = 'Lead updated with customer data';
                    break;
                case 'update_customer_from_lead':
                    message = 'Customer updated with lead data';
                    break;
                case 'unlink_customer':
                    message = 'Customer unlinked from lead';
                    break;
            }

            toast.success('Customer relationship updated', {
                description: message,
            });

            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to sync customer data';
            toast.error('Sync failed', {
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

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className='sm:max-w-[600px]'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <RefreshCw className='h-5 w-5' />
                        Customer Relationship Management
                    </DialogTitle>
                    <DialogDescription>
                        Manage the relationship between this lead and the linked customer account.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-6'>
                    {/* Current Status */}
                    <div className='p-4 bg-muted rounded-lg'>
                        <div className='flex items-center gap-2 mb-2'>
                            <span className='text-sm font-medium'>Current Status:</span>
                            <Badge
                                variant={relationshipStatus.badgeVariant as any}
                                className={
                                    relationshipStatus.status === 'sync_needed'
                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        : ''
                                }
                            >
                                {relationshipStatus.displayText}
                            </Badge>
                        </div>
                        {!validation.isValid && (
                            <div className='text-sm text-destructive'>
                                <AlertTriangle className='h-4 w-4 inline mr-1' />
                                {validation.issues.join(', ')}
                            </div>
                        )}
                    </div>

                    {/* Data Comparison */}
                    {syncSuggestion.shouldSync && (
                        <div className='space-y-4'>
                            <h3 className='text-lg font-medium'>Data Differences</h3>

                            <div className='grid grid-cols-2 gap-4'>
                                {/* Lead Data */}
                                <div className='p-4 border rounded-lg'>
                                    <h4 className='font-medium mb-3 flex items-center gap-2'>
                                        <User className='h-4 w-4' />
                                        Lead Data
                                    </h4>
                                    <div className='space-y-2 text-sm'>
                                        <div className='flex items-center gap-2'>
                                            <User className='h-3 w-3 text-muted-foreground' />
                                            <span>{lead.customerName}</span>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <Mail className='h-3 w-3 text-muted-foreground' />
                                            <span>{lead.customerEmail}</span>
                                        </div>
                                        {lead.customerPhone && (
                                            <div className='flex items-center gap-2'>
                                                <Phone className='h-3 w-3 text-muted-foreground' />
                                                <span>{lead.customerPhone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Customer Data */}
                                <div className='p-4 border rounded-lg'>
                                    <h4 className='font-medium mb-3 flex items-center gap-2'>
                                        <User className='h-4 w-4' />
                                        Customer Data
                                    </h4>
                                    <div className='space-y-2 text-sm'>
                                        <div className='flex items-center gap-2'>
                                            <User className='h-3 w-3 text-muted-foreground' />
                                            <span>{lead.linkedCustomer.name}</span>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <Mail className='h-3 w-3 text-muted-foreground' />
                                            <span>{lead.linkedCustomer.email}</span>
                                        </div>
                                        {lead.linkedCustomer.phone && (
                                            <div className='flex items-center gap-2'>
                                                <Phone className='h-3 w-3 text-muted-foreground' />
                                                <span>{lead.linkedCustomer.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Differences List */}
                            <div className='p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
                                <h5 className='font-medium text-yellow-800 mb-2'>Detected Differences:</h5>
                                <ul className='text-sm text-yellow-700 space-y-1'>
                                    {syncSuggestion.differences.map((diff, index) => (
                                        <li key={index} className='flex items-start gap-2'>
                                            <span className='text-yellow-600'>•</span>
                                            <span>{diff}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='space-y-3'>
                        <h3 className='text-lg font-medium'>Available Actions</h3>

                        {syncSuggestion.shouldSync && (
                            <>
                                <Button
                                    variant='outline'
                                    className='w-full justify-start'
                                    onClick={() => handleSync('update_lead_from_customer')}
                                    disabled={loading}
                                >
                                    <ArrowRight className='mr-2 h-4 w-4' />
                                    Update Lead with Customer Data
                                    <span className='ml-auto text-xs text-muted-foreground'>Recommended</span>
                                </Button>

                                <Button
                                    variant='outline'
                                    className='w-full justify-start'
                                    onClick={() => handleSync('update_customer_from_lead')}
                                    disabled={loading}
                                >
                                    <ArrowRight className='mr-2 h-4 w-4 rotate-180' />
                                    Update Customer with Lead Data
                                </Button>
                            </>
                        )}

                        <Button
                            variant='outline'
                            className='w-full justify-start text-destructive hover:text-destructive'
                            onClick={() => handleSync('unlink_customer')}
                            disabled={loading}
                        >
                            <Unlink className='mr-2 h-4 w-4' />
                            Unlink Customer
                            <span className='ml-auto text-xs text-muted-foreground'>Convert to manual entry</span>
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}