/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { leads } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

const updateStatusSchema = z.object({
    status: z.enum(['new', 'contacted', 'failed', 'success', 'converted']),
    failureReason: z.string().optional(),
    notes: z.string().optional(),
});

// PUT /api/lead/[id]/status - Update lead status with timestamp tracking
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const parsed = updateStatusSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { status, failureReason, notes } = parsed.data;

        // Check if lead exists
        const existingLead = await db.query.leads.findFirst({
            where: (l, { eq }) => eq(l.id, id),
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Validate status transitions and required fields
        const now = new Date();
        const updateData: any = {
            status,
            updatedAt: now,
        };

        // Handle status-specific logic and validations
        switch (status) {
            case 'contacted':
                // Set contactedAt timestamp if transitioning to contacted
                if (existingLead.status !== 'contacted') {
                    updateData.contactedAt = now;
                }
                // Clear failure reason when moving to contacted
                updateData.failureReason = null;
                break;

            case 'failed':
                // Failure reason is required when marking as failed
                if (!failureReason) {
                    return NextResponse.json(
                        { error: 'Failure reason is required when marking lead as failed' },
                        { status: 400 }
                    );
                }
                updateData.failureReason = failureReason;
                break;

            case 'success':
                // Clear failure reason when marking as success
                updateData.failureReason = null;
                // Validate that lead was previously contacted
                if (existingLead.status === 'new') {
                    return NextResponse.json(
                        { error: 'Lead must be contacted before marking as success' },
                        { status: 400 }
                    );
                }
                break;

            case 'converted':
                // Only successful leads can be converted
                if (existingLead.status !== 'success') {
                    return NextResponse.json(
                        { error: 'Only successful leads can be converted' },
                        { status: 400 }
                    );
                }
                // Set convertedAt timestamp
                updateData.convertedAt = now;
                updateData.failureReason = null;
                break;

            case 'new':
                // Reset timestamps when reverting to new
                updateData.contactedAt = null;
                updateData.convertedAt = null;
                updateData.failureReason = null;
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid status value' },
                    { status: 400 }
                );
        }

        // Add notes if provided
        if (notes !== undefined) {
            updateData.notes = notes;
        }

        // Update lead status
        const [updatedLead] = await db
            .update(leads)
            .set(updateData)
            .where(eq(leads.id, id))
            .returning({
                id: leads.id,
                customerName: leads.customerName,
                customerEmail: leads.customerEmail,
                customerPhone: leads.customerPhone,
                customerId: leads.customerId,
                originCountry: leads.originCountry,
                destinationCountry: leads.destinationCountry,
                weight: leads.weight,
                status: leads.status,
                notes: leads.notes,
                failureReason: leads.failureReason,
                assignedTo: leads.assignedTo,
                createdAt: leads.createdAt,
                updatedAt: leads.updatedAt,
                contactedAt: leads.contactedAt,
                convertedAt: leads.convertedAt,
                shipmentId: leads.shipmentId,
            });

        return NextResponse.json({
            lead: updatedLead,
            message: `Lead status updated to ${status}`
        });

    } catch (error) {
        console.error('Error updating lead status:', error);
        return NextResponse.json(
            { error: 'Failed to update lead status' },
            { status: 500 }
        );
    }
}