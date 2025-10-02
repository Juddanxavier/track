/** @format */

import type { Metadata } from 'next';
import LeadManagement from './lead';
import ErrorBoundary from '@/components/error/ErrorBoundary';

export const metadata: Metadata = {
    title: 'Lead Management',
};

export default function LeadsPage() {
    return (
        <div className='space-y-6'>
            <ErrorBoundary>
                <LeadManagement />
            </ErrorBoundary>
        </div>
    );
}