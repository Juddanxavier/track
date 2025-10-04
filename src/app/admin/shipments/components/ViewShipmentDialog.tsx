/** @format */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shipment } from '@/types/shipment';

interface ViewShipmentDialogProps {
    shipment: Shipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userMap: Map<string, string>;
}

export function ViewShipmentDialog({
    shipment,
    open,
    onOpenChange,
    userMap,
}: ViewShipmentDialogProps) {
    const router = useRouter();

    useEffect(() => {
        if (open && shipment) {
            // Close the dialog and navigate to the detail page
            onOpenChange(false);
            router.push(`/admin/shipments/${shipment.id}`);
        }
    }, [open, shipment, onOpenChange, router]);

    // This component no longer renders a dialog, it just handles navigation
    return null;
}