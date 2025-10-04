/** @format */

import type { Metadata } from 'next';
import ShipmentManagement from './shipment';
import ErrorBoundary from '@/components/error/ErrorBoundary';

export const metadata: Metadata = {
    title: 'Shipment Management',
};

export default function ShipmentsPage() {
    return (
        <div className='space-y-6'>
            <ErrorBoundary>
                <ShipmentManagement />
            </ErrorBoundary>
        </div>
    );
}