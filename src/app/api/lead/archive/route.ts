/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/database/db';
import { leadsArchive } from '@/database/schema';
import { isAdmin } from '@/helpers/authHelpers';
import { z } from 'zod';
import { desc, like, and, gte, lte, eq, or } from 'drizzle-orm';

const getArchivedLeadsSchema = z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    perPage: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    search: z.string().optional(),
    status: z.enum(['success', 'converted']).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        // Check if user is admin
        if (!(await isAdmin(request))) {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const queryParams = Object.fromEntries(searchParams.entries());

        const { page, perPage, search, status, fromDate, toDate } = getArchivedLeadsSchema.parse(queryParams);

        const finalPage = page || 1;
        const finalPerPage = perPage || 20;
        const offset = (finalPage - 1) * finalPerPage;

        // Build where conditions
        const conditions = [];

        if (search) {
            conditions.push(
                or(
                    like(leadsArchive.customerName, `%${search}%`),
                    like(leadsArchive.customerEmail, `%${search}%`),
                    like(leadsArchive.originCountry, `%${search}%`),
                    like(leadsArchive.destinationCountry, `%${search}%`)
                )
            );
        }

        if (status) {
            conditions.push(eq(leadsArchive.status, status));
        }

        if (fromDate) {
            conditions.push(gte(leadsArchive.archivedAt, new Date(fromDate)));
        }

        if (toDate) {
            conditions.push(lte(leadsArchive.archivedAt, new Date(toDate)));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalResult = await db
            .select({ count: leadsArchive.id })
            .from(leadsArchive)
            .where(whereClause);
        const total = totalResult.length;

        // Get paginated archived leads
        const archivedLeads = await db
            .select()
            .from(leadsArchive)
            .where(whereClause)
            .orderBy(desc(leadsArchive.archivedAt))
            .limit(finalPerPage)
            .offset(offset);

        const totalPages = Math.ceil(total / finalPerPage);

        const formattedLeads = archivedLeads.map(lead => ({
            ...lead,
            createdAt: new Date(lead.createdAt),
            updatedAt: new Date(lead.updatedAt),
            contactedAt: lead.contactedAt ? new Date(lead.contactedAt) : null,
            convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
            successAt: lead.successAt ? new Date(lead.successAt) : null,
            archivedAt: new Date(lead.archivedAt),
        }));

        return NextResponse.json({
            message: 'Archived leads retrieved successfully',
            archivedLeads: formattedLeads,
            pagination: {
                page: finalPage,
                perPage: finalPerPage,
                total,
                totalPages,
                hasNext: finalPage < totalPages,
                hasPrev: finalPage > 1,
            },
        });
    } catch (error) {
        console.error('Error getting archived leads:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to get archived leads',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}