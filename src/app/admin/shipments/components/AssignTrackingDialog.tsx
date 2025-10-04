/** @format */

'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Package, Upload, FileText, AlertCircle } from 'lucide-react';
import { Shipment } from '@/types/shipment';

interface AssignTrackingDialogProps {
    shipment: Shipment | null;
    selectedShipments?: string[]; // For bulk assignment
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const courierOptions = [
    { value: 'fedex', label: 'FedEx' },
    { value: 'ups', label: 'UPS' },
    { value: 'dhl', label: 'DHL' },
    { value: 'usps', label: 'USPS' },
    { value: 'other', label: 'Other' },
];

export function AssignTrackingDialog({
    shipment,
    selectedShipments = [],
    open,
    onOpenChange,
    onSuccess,
}: AssignTrackingDialogProps) {
    const [loading, setLoading] = useState(false);
    const [courier, setCourier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [shippingMethod, setShippingMethod] = useState('');

    // Bulk assignment state
    const [csvData, setCsvData] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isBulkMode = selectedShipments.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shipment || !courier || !trackingNumber) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`/api/shipments/${shipment.id}/assign-tracking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    courier,
                    trackingNumber,
                    shippingMethod: shippingMethod || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign tracking number');
            }

            toast.success('Tracking number assigned successfully');
            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Error assigning tracking:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to assign tracking number');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!csvData.trim()) {
            toast.error('Please provide CSV data or upload a file');
            return;
        }

        setLoading(true);

        try {
            // Parse CSV data
            const lines = csvData.trim().split('\n');
            const assignments = lines.map((line, index) => {
                const [shipmentId, courier, trackingNumber, shippingMethod] = line.split(',').map(s => s.trim());

                if (!shipmentId || !courier || !trackingNumber) {
                    throw new Error(`Invalid data on line ${index + 1}: Missing required fields`);
                }

                return {
                    shipmentId,
                    courier,
                    trackingNumber,
                    shippingMethod: shippingMethod || undefined,
                };
            });

            const response = await fetch('/api/shipments/bulk-assign-tracking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ assignments }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign tracking numbers');
            }

            const result = await response.json();
            toast.success(`Successfully assigned tracking to ${result.successful} shipments`);

            if (result.failed > 0) {
                toast.warning(`${result.failed} assignments failed. Check the details.`);
            }

            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Error bulk assigning tracking:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to assign tracking numbers');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Please upload a CSV file');
            return;
        }

        setCsvFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setCsvData(content);
        };
        reader.readAsText(file);
    };

    const handleClose = () => {
        setCourier('');
        setTrackingNumber('');
        setShippingMethod('');
        setCsvData('');
        setCsvFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {isBulkMode ? 'Bulk Assign Tracking Numbers' : 'Assign Tracking Number'}
                    </DialogTitle>
                    <DialogDescription>
                        {isBulkMode
                            ? `Assign tracking numbers to ${selectedShipments.length} selected shipments`
                            : `Assign a courier tracking number to shipment ${shipment?.trackingCode}`
                        }
                    </DialogDescription>
                </DialogHeader>

                {isBulkMode ? (
                    <Tabs defaultValue="csv" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                        </TabsList>

                        <TabsContent value="csv" className="space-y-4">
                            <form onSubmit={handleBulkSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="csvFile">Upload CSV File</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            ref={fileInputRef}
                                            id="csvFile"
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileUpload}
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            Browse
                                        </Button>
                                    </div>
                                    {csvFile && (
                                        <Badge variant="secondary" className="text-xs">
                                            <FileText className="h-3 w-3 mr-1" />
                                            {csvFile.name}
                                        </Badge>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="csvData">CSV Data</Label>
                                    <Textarea
                                        id="csvData"
                                        value={csvData}
                                        onChange={(e) => setCsvData(e.target.value)}
                                        placeholder="shipmentId,courier,trackingNumber,shippingMethod&#10;SC123456789,fedex,1234567890,Ground&#10;SC987654321,ups,0987654321,Express"
                                        rows={6}
                                        className="font-mono text-sm"
                                    />
                                </div>

                                <div className="rounded-lg bg-blue-50 p-3 text-sm">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                                        <div className="text-blue-800">
                                            <p className="font-medium">CSV Format:</p>
                                            <p className="text-xs mt-1">
                                                shipmentId,courier,trackingNumber,shippingMethod (optional)
                                            </p>
                                            <p className="text-xs">
                                                One assignment per line. Courier options: fedex, ups, dhl, usps, other
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClose}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading || !csvData.trim()}>
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Assign Tracking Numbers
                                    </Button>
                                </DialogFooter>
                            </form>
                        </TabsContent>

                        <TabsContent value="manual" className="space-y-4">
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Manual bulk assignment coming soon</p>
                                <p className="text-sm">Use CSV upload for now</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="courier">Courier *</Label>
                            <Select value={courier} onValueChange={setCourier} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select courier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {courierOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="trackingNumber">Tracking Number *</Label>
                            <Input
                                id="trackingNumber"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="Enter tracking number"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shippingMethod">Shipping Method</Label>
                            <Input
                                id="shippingMethod"
                                value={shippingMethod}
                                onChange={(e) => setShippingMethod(e.target.value)}
                                placeholder="e.g., Ground, Express, Overnight"
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Assign Tracking
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}