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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Package, Upload, FileText, AlertCircle, Download } from 'lucide-react';

interface BulkAssignTrackingDialogProps {
    selectedShipments: string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function BulkAssignTrackingDialog({
    selectedShipments,
    open,
    onOpenChange,
    onSuccess,
}: BulkAssignTrackingDialogProps) {
    const [loading, setLoading] = useState(false);
    const [csvData, setCsvData] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
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

    const generateTemplate = () => {
        const template = selectedShipments.map(id => `${id},fedex,,Ground`).join('\n');
        const blob = new Blob([`shipmentId,courier,trackingNumber,shippingMethod\n${template}`], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk-tracking-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Template downloaded');
    };

    const handleClose = () => {
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
                        Bulk Assign Tracking Numbers
                    </DialogTitle>
                    <DialogDescription>
                        Assign tracking numbers to {selectedShipments.length} selected shipments using CSV data
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>CSV Template</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generateTemplate}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Template
                        </Button>
                    </div>

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
                            rows={8}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="rounded-lg bg-blue-50 p-3 text-sm">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="text-blue-800">
                                <p className="font-medium">CSV Format Requirements:</p>
                                <ul className="text-xs mt-1 space-y-1">
                                    <li>• Header: shipmentId,courier,trackingNumber,shippingMethod</li>
                                    <li>• Courier options: fedex, ups, dhl, usps, other</li>
                                    <li>• Shipping method is optional</li>
                                    <li>• One assignment per line</li>
                                </ul>
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
            </DialogContent>
        </Dialog>
    );
}