/** @format */

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

interface ShipmentStats {
    total: number;
    pending: number;
    inTransit: number;
    delivered: number;
    exception: number;
    cancelled: number;
    recentCount: number;
    needsReview: number;
    apiSyncFailures: number;
    recentActivity: Array<{
        id: string;
        type: 'created' | 'status_change' | 'api_sync' | 'delivered';
        description: string;
        timestamp: Date;
        shipmentId: string;
        internalTrackingCode: string;
    }>;
}

export function useShipmentStats() {
    const [stats, setStats] = useState<ShipmentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { data: session } = authClient.useSession();

    const isAdmin = (session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'super-admin';

    const fetchStats = async () => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/shipments/stats');
            if (!response.ok) {
                throw new Error('Failed to fetch shipment statistics');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('Error fetching shipment stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [isAdmin]);

    return {
        stats,
        loading,
        error,
        refetch: fetchStats,
    };
}