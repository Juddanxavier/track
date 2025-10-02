/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { leads, users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

const updateLeadSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required').optional(),
    customerEmail: z.string().email('Invalid email format').optional(),
    customerPhone: z.string().optional(),
    customerId: z.string().optional(),
    originCountry: z.string().min(1, 'Origin country is required').optional(),
    destinationCountry: z.string().min(1, 'Destination country is required').optional(),
    weight: z.string().min(1, 'Weight is required').optional(),
    status: z.enum(['new', 'contacted', 'failed', 'success', 'converted']).optional(),
    notes: z.string().optional(),
    failureReason: z.string().optional(),
    assignedTo: z.string().optional(),
});

// GET /api/lead/[id] - Get single lead
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        // Get lead with linked customer information
        const leadResult = await db
            .select({
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
                // Include linked customer information
                linkedCustomer: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    phone: users.phone,
                    role: users.role,
                }
            })
            .from(leads)
            .leftJoin(users, eq(leads.customerId, users.id))
            .where(eq(leads.id, id))
            .limit(1);

        if (leadResult.length === 0) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const lead = leadResult[0];

        return NextResponse.json({ lead });
    } catch (error) {
        console.error('Error fetching lead:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lead' },
            { status: 500 }
        );
    }
}

// PUT /api/lead/[id] - Update lead
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
        const parsed = updateLeadSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const updateData = parsed.data;

        // Check if lead exists
        const existingLead = await db.query.leads.findFirst({
            where: (l, { eq }) => eq(l.id, id),
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Validate customerId exists if provided
        if (updateData.customerId) {
            const customer = await db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, updateData.customerId!),
            });

            if (!customer) {
                return NextResponse.json(
                    { error: 'Customer not found' },
                    { status: 400 }
                );
            }
        }

        // Validate assignedTo exists if provided
        if (updateData.assignedTo) {
            const assignee = await db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, updateData.assignedTo!),
            });

            if (!assignee) {
                return NextResponse.json(
                    { error: 'Assigned user not found' },
                    { status: 400 }
                );
            }
        }

        // Handle status-specific logic
        const statusUpdateData: any = { ...updateData };

        if (updateData.status) {
            const now = new Date();

            // Update timestamps based on status changes
            if (updateData.status === 'contacted' && existingLead.status !== 'contacted') {
                statusUpdateData.contactedAt = now;
            }

            if (updateData.status === 'converted' && existingLead.status !== 'converted') {
                statusUpdateData.convertedAt = now;
            }

            // Clear failure reason if status is not 'failed'
            if (updateData.status !== 'failed') {
                statusUpdateData.failureReason = null;
            }
        }

        // Track changes for activity log
        const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

        Object.keys(updateData).forEach(field => {
            const oldValue = (existingLead as any)[field];
            const newValue = (updateData as any)[field];

            if (oldValue !== newValue) {
                changes.push({ field, oldValue, newValue });
            }
        });

        // Update lead
        await db
            .update(leads)
            .set({
                ...statusUpdateData,
                updatedAt: new Date(),
            })
            .where(eq(leads.id, id));

        // Track activity changes
        if (changes.length > 0) {
            try {
                const { LeadActivityTracker } = await import('@/lib/leadActivityTracker');
                await LeadActivityTracker.trackMultipleUpdates(id, changes, {
                    metadata: {
                        updatedFields: changes.map(c => c.field),
                    },
                });
            } catch (error) {
                console.error('Failed to track lead update activities:', error);
                // Don't fail the request if activity tracking fails
            }
        }

        // Get updated lead with customer information
        const updatedLeadResult = await db
            .select({
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
                // Include linked customer information
                linkedCustomer: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    phone: users.phone,
                    role: users.role,
                }
            })
            .from(leads)
            .leftJoin(users, eq(leads.customerId, users.id))
            .where(eq(leads.id, id))
            .limit(1);

        const updatedLead = updatedLeadResult[0];

        return NextResponse.json({
            lead: updatedLead,
            message: 'Lead updated successfully'
        });
    } catch (error) {
        console.error('Error updating lead:', error);
        return NextResponse.json(
            { error: 'Failed to update lead' },
            { status: 500 }
        );
    }
}

// DELETE /api/lead/[id] - Delete lead
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        // Check if lead exists
        const existingLead = await db.query.leads.findFirst({
            where: (l, { eq }) => eq(l.id, id),
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Optional: Warn if deleting a successful lead
        if (existingLead.status === 'success') {
            // This warning should be handled on the frontend, but we can log it
            console.warn(`Deleting successful lead: ${id}`);
        }

        // Track deletion activity before deleting
        try {
            const { LeadActivityTracker } = await import('@/lib/leadActivityTracker');
            await LeadActivityTracker.trackDeletion(id, {
                description: `Lead for ${existingLead.customerName} (${existingLead.customerEmail}) was deleted`,
                metadata: {
                    customerName: existingLead.customerName,
                    customerEmail: existingLead.customerEmail,
                    status: existingLead.status,
                },
            });
        } catch (error) {
            console.error('Failed to track lead deletion activity:', error);
            // Don't fail the request if activity tracking fails
        }

        // Delete lead (this will cascade delete activities due to foreign key constraint)
        await db.delete(leads).where(eq(leads.id, id));

        return NextResponse.json({
            message: 'Lead deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting lead:', error);
        return NextResponse.json(
            { error: 'Failed to delete lead' },
            { status: 500 }
        );
    }
}