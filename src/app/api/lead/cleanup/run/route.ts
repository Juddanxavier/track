/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { leadCleanupService } from '@/lib/leadCleanupService';
import { isAdmin } from '@/helpers/authHelpers';
import { z } from 'zod';

const runCleanupSchema = z.object({
    archiveDays: z.number().min(1).max(365).optional(),
    dryRun: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
    try {
        // Check if user is admin
        if (!(await isAdmin(request))) {
            return NextResponse.json(
                { error: 'Unauthorized. Admin access required.' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { archiveDays, dryRun } = runCleanupSchema.parse(body);

        if (dryRun) {
            // For dry run, just identify what would be cleaned up
            const leadsToDelete = await leadCleanupService.identifyLeadsForDeletion();
            const leadsToArchive = await leadCleanupService.identifyLeadsForArchival(archiveDays);

            return NextResponse.json({
                message: 'Dry run completed successfully',
                summary: {
                    deletedCount: leadsToDelete.length,
                    archivedCount: leadsToArchive.length,
                    errors: [],
                    runAt: new Date(),
                },
                dryRun: true,
                leadsToDelete: leadsToDelete.map(lead => ({
                    id: lead.id,
                    customerName: lead.customerName,
                    customerEmail: lead.customerEmail,
                    status: lead.status,
                    failedAt: lead.failedAt,
                })),
                leadsToArchive: leadsToArchive.map(lead => ({
                    id: lead.id,
                    customerName: lead.customerName,
                    customerEmail: lead.customerEmail,
                    status: lead.status,
                    successAt: lead.successAt,
                })),
            });
        }

        // Run actual cleanup
        const summary = await leadCleanupService.runScheduledCleanup(archiveDays);

        return NextResponse.json({
            message: 'Cleanup completed successfully',
            summary,
        });
    } catch (error) {
        console.error('Error running cleanup:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid request data',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to run cleanup',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}