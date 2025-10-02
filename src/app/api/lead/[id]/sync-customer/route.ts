/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { leads, users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

const syncCustomerSchema = z.object({
    action: z.enum(['update_lead_from_customer', 'update_customer_from_lead', 'unlink_customer']),
});

// POST /api/lead/[id]/sync-customer - Sync customer data or manage relationship
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const parsed = syncCustomerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { action } = parsed.data;

        // Get lead with customer information
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

        switch (action) {
            case 'update_lead_from_customer':
                if (!lead.customerId || !lead.linkedCustomer) {
                    return NextResponse.json(
                        { error: 'Lead is not linked to a customer' },
                        { status: 400 }
                    );
                }

                // Update lead with customer data
                await db
                    .update(leads)
                    .set({
                        customerName: lead.linkedCustomer.name,
                        customerEmail: lead.linkedCustomer.email,
                        customerPhone: lead.linkedCustomer.phone,
                        updatedAt: new Date(),
                    })
                    .where(eq(leads.id, id));

                return NextResponse.json({
                    message: 'Lead updated with customer data',
                    action: 'lead_updated'
                });

            case 'update_customer_from_lead':
                if (!lead.customerId || !lead.linkedCustomer) {
                    return NextResponse.json(
                        { error: 'Lead is not linked to a customer' },
                        { status: 400 }
                    );
                }

                // Update customer with lead data
                await db
                    .update(users)
                    .set({
                        name: lead.customerName,
                        email: lead.customerEmail,
                        phone: lead.customerPhone,
                        updatedAt: new Date(),
                    })
                    .where(eq(users.id, lead.customerId));

                return NextResponse.json({
                    message: 'Customer updated with lead data',
                    action: 'customer_updated'
                });

            case 'unlink_customer':
                // Remove customer link from lead
                await db
                    .update(leads)
                    .set({
                        customerId: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(leads.id, id));

                return NextResponse.json({
                    message: 'Customer unlinked from lead',
                    action: 'customer_unlinked'
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Error syncing customer data:', error);
        return NextResponse.json(
            { error: 'Failed to sync customer data' },
            { status: 500 }
        );
    }
}