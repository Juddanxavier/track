/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { LeadActivityTracker } from '@/lib/leadActivityTracker';
import z from 'zod';

const querySchema = z.object({
    page: z
        .preprocess((v) => Number(v), z.number().int().min(1).default(1))
        .optional(),
    perPage: z
        .preprocess((v) => Number(v), z.number().int().min(1).max(100).default(20))
        .optional(),
});

// GET /api/lead/[id]/activities - Get activities for a specific lead
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const leadId = (await params).id;
    if (!leadId) {
        return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid query params', details: parsed.error.issues },
            { status: 400 }
        );
    }

    const { page = 1, perPage = 20 } = parsed.data;

    try {
        const result = await LeadActivityTracker.getLeadActivities(leadId, {
            page,
            perPage,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching lead activities:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lead activities' },
            { status: 500 }
        );
    }
}