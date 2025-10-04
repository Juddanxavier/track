/** @format */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
    Loader2,
    Mail,
    User,
    Clock,
    CheckCircle,
    XCircle,
    RefreshCw,
    Search,
    Link,
    AlertCircle
} from 'lucide-react';
import { Shipment, UserAssignmentStatus } from '@/types/shipment';

interface SignupManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface SignupShipment extends Shipment {
    signupLinkExpired?: boolean;
}

export function SignupManagementDialog({
    open,
    onOpenChange,
    onSuccess,
}: SignupManagementDialogProps) {
    const [loading, setLoading] = useState(false);
    const [shipments, setShipments] = useState<SignupShipment[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedShipments, setSelectedShipments] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            loadSignupShipments();
        }
    }, [open]);

    const loadSignupShipments = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/shipments?userAssignmentStatus=unassigned,signup_sent&perPage=100');

            if (!response.ok) {
                throw new Error('Failed to load shipments');
            }

            const data = await response.json();

            // Add expiry status
            const shipmentsWithExpiry = data.shipments.map((shipment: Shipment) => ({
                ...shipment,
                signupLinkExpired: shipment.signupTokenExpiry
                    ? new Date(shipment.signupTokenExpiry) < new Date()
                    : false,
            }));

            setShipments(shipmentsWithExpiry);
        } catch (error) {
            console.error('Error loading signup shipments:', error);
            toast.error('Failed to load shipments');
        } finally {
            setLoading(false);
        }
    };

    const handleSendSignup = async (shipmentId: string) => {
        try {
            const response = await fetch(`/api/shipments/${shipmentId}/send-signup`, {
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
            loadSignupShipments();
        } catch (error) {
            console.error('Error sending signup link:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send signup link');
        }
    };

    const handleBulkSendSignup = async () => {
        if (selectedShipments.length === 0) {
            toast.error('Please select shipments');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/shipments/bulk-send-signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shipmentIds: selectedShipments,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send bulk signup links');
            }

            const result = await response.json();
            toast.success(`Signup links sent to ${result.successful} shipments`);
            setSelectedShipments([]);
            loadSignupShipments();
        } catch (error) {
            console.error('Error sending bulk signup links:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to send signup links');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (shipment: SignupShipment) => {
        if (shipment.userAssignmentStatus === UserAssignmentStatus.UNASSIGNED) {
            return (
                <Badge variant="outline" className="text-red-600 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Sent
                </Badge>
            );
        }

        if (shipment.userAssignmentStatus === UserAssignmentStatus.SIGNUP_SENT) {
            if (shipment.signupLinkExpired) {
                return (
                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expired
                    </Badge>
                );
            }
            return (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                </Badge>
            );
        }

        if (shipment.userAssignmentStatus === UserAssignmentStatus.SIGNUP_COMPLETED) {
            return (
                <Badge variant="outline" className="text-green-600 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                </Badge>
            );
        }

        return null;
    };

    const filteredShipments = shipments.filter(shipment =>
        shipment.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.trackingCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectAll = () => {
        if (selectedShipments.length === filteredShipments.length) {
            setSelectedShipments([]);
        } else {
            setSelectedShipments(filteredShipments.map(s => s.id));
        }
    };

    const handleSelectShipment = (shipmentId: string) => {
        setSelectedShipments(prev =>
            prev.includes(shipmentId)
                ? prev.filter(id => id !== shipmentId)
                : [...prev, shipmentId]
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link className="h-5 w-5" />
                        Signup Link Management
                    </DialogTitle>
                    <DialogDescription>
                        Manage customer signup links for unassigned shipments
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search and Actions */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search shipments..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadSignupShipments}
                                disabled={loading}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                            {selectedShipments.length > 0 && (
                                <Button
                                    size="sm"
                                    onClick={handleBulkSendSignup}
                                    disabled={loading}
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send to {selectedShipments.length}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Shipments Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedShipments.length === filteredShipments.length && filteredShipments.length > 0}
                                            onChange={handleSelectAll}
                                            className="rounded"
                                        />
                                    </TableHead>
                                    <TableHead>Tracking Code</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Sent</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            <p className="text-muted-foreground">Loading shipments...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredShipments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <p className="text-muted-foreground">No shipments found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredShipments.map((shipment) => (
                                        <TableRow key={shipment.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedShipments.includes(shipment.id)}
                                                    onChange={() => handleSelectShipment(shipment.id)}
                                                    className="rounded"
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {shipment.trackingCode}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">{shipment.customerName}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {shipment.customerEmail}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(shipment)}
                                            </TableCell>
                                            <TableCell>
                                                {shipment.signupLinkSentAt ? (
                                                    <div className="text-sm">
                                                        {new Date(shipment.signupLinkSentAt).toLocaleDateString()}
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(shipment.signupLinkSentAt).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">Never</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSendSignup(shipment.id)}
                                                    disabled={loading}
                                                >
                                                    <Mail className="h-3 w-3 mr-1" />
                                                    {shipment.userAssignmentStatus === UserAssignmentStatus.SIGNUP_SENT
                                                        ? 'Resend'
                                                        : 'Send'
                                                    }
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                            {filteredShipments.length} shipment{filteredShipments.length !== 1 ? 's' : ''} found
                        </span>
                        {selectedShipments.length > 0 && (
                            <span>
                                {selectedShipments.length} selected
                            </span>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}