/** @format */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Mail, User, Phone, MapPin, Clock } from 'lucide-react';
import { Shipment } from '@/types/shipment';

interface SendSignupDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function SendSignupDialog({
    shipment,
    open,
    onOpenChange,
    onSuccess,
}: SendSignupDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleSendSignup = async () => {
        if (!shipment) return;

        setLoading(true);

        try {
            const response = await fetch(`/api/shipments/${shipment.id}/send-signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send signup link');
            }

            toast.success('Signup link sent successfully');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error sending signup link:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send signup link');
        } finally {
            setLoading(false);
        }
    };

    if (!shipment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Send Signup Link
                    </DialogTitle>
                    <DialogDescription>
                        Send a signup invitation link to the customer for shipment {shipment.trackingCode}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border p-4 space-y-3">
                        <h4 className="font-medium text-sm">Customer Information</h4>

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{shipment.customerName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{shipment.customerEmail}</span>
                            </div>

                            {shipment.customerPhone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{shipment.customerPhone}</span>
                                </div>
                            )}

                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <div>{shipment.destinationAddress.addressLine1}</div>
                                    {shipment.destinationAddress.addressLine2 && (
                                        <div>{shipment.destinationAddress.addressLine2}</div>
                                    )}
                                    <div>
                                        {shipment.destinationAddress.city}, {shipment.destinationAddress.state} {shipment.destinationAddress.postalCode}
                                    </div>
                                    <div>{shipment.destinationAddress.country}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signup Status */}
                    {shipment.userAssignmentStatus === 'signup_sent' && shipment.signupLinkSentAt && (
                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm">
                            <div className="flex items-center gap-2 text-yellow-800 mb-2">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Signup Link Already Sent</span>
                            </div>
                            <p className="text-yellow-700">
                                Last sent: {new Date(shipment.signupLinkSentAt).toLocaleString()}
                            </p>
                            <p className="text-yellow-700 text-xs mt-1">
                                Sending again will generate a new link and invalidate the previous one.
                            </p>
                        </div>
                    )}

                    <div className="rounded-lg bg-blue-50 p-4 text-sm">
                        <p className="text-blue-800">
                            <strong>What happens next:</strong>
                        </p>
                        <ul className="mt-2 space-y-1 text-blue-700">
                            <li>• Customer will receive an email with a signup link</li>
                            <li>• The signup form will be pre-filled with their information</li>
                            <li>• Once they complete signup, they'll be automatically assigned to this shipment</li>
                            <li>• They'll gain access to enhanced tracking features and notifications</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSendSignup} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Mail className="mr-2 h-4 w-4" />
                        Send Signup Link
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}