/** @format */

import { useState, useEffect } from 'react';
import { AssignmentStats } from '@/types/shipment';

export function useAssignmentStats() {
    const [stats, setStats] = useState<AssignmentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/shipments/assignment-stats');

            if (!response.ok) {
                throw new Error('Failed to fetch assignment statistics');
            }

            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching assignment stats:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return {
        stats,
        loading,
        error,
        refetch: fetchStats,
    };
}