/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';
import {
    UpdateShipmentSchema,
    type UpdateShipmentRequest
} from '@/types/shipment';
import { auth } from '@/lib/auth';
import { db } from '@/database/db';
import { leads } from '@/database/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

// GET /api/shipments/[id] - Get shipment details with event history
export async function GET(req: NextRequest, { params }: RouteParams) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Shipment ID is required' },
                { status: 400 }
            );
        }

        // Get shipment with events
        const shipmentWithEvents = await shipmentService.getShipmentWithEvents(id);

        if (!shipmentWithEvents) {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        // Get related lead information if applicable
        let leadInfo = null;
        if (shipmentWithEvents.leadId) {
            try {
                const [lead] = await db
                    .select({
                        id: leads.id,
                        customerName: leads.customerName,
                        customerEmail: leads.customerEmail,
                        customerPhone: leads.customerPhone,
                        originCountry: leads.originCountry,
                        destinationCountry: leads.destinationCountry,
                        weight: leads.weight,
                        status: leads.status,
                        createdAt: leads.createdAt,
                    })
                    .from(leads)
                    .where(eq(leads.id, shipmentWithEvents.leadId));

                if (lead) {
                    leadInfo = lead;
                }
            } catch (leadError) {
                console.error('Error fetching related lead:', leadError);
                // Continue without lead info if there's an error
            }
        }

        return NextResponse.json({
            shipment: shipmentWithEvents,
            lead: leadInfo,
        });

    } catch (error) {
        console.error('Error fetching shipment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shipment' },
            { status: 500 }
        );
    }
}

// PUT /api/shipments/[id] - Update shipment
export async function PUT(req: NextRequest, { params }: RouteParams) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Shipment ID is required' },
                { status: 400 }
            );
        }

        const body = await req.json();

        // Validate request body
        const parsed = UpdateShipmentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid shipment data',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        // Get current user for audit trail
        const session = await auth.api.getSession({
            headers: req.headers,
        });

        // Update shipment
        const updatedShipment = await shipmentService.updateShipment(id, parsed.data);

        // If status was updated, create an audit event
        if (parsed.data.status) {
            await shipmentService.addEvent({
                shipmentId: id,
                eventType: 'status_change',
                status: parsed.data.status,
                description: `Status manually updated to ${parsed.data.status}`,
                source: 'manual',
                sourceId: session?.user?.id,
                eventTime: new Date(),
            });
        }

        return NextResponse.json({
            shipment: updatedShipment,
            message: 'Shipment updated successfully'
        });

    } catch (error: any) {
        console.error('Error updating shipment:', error);

        // Handle specific shipment errors
        if (error.code === 'SHIPMENT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        if (error.code === 'INVALID_STATUS_TRANSITION') {
            return NextResponse.json(
                {
                    error: 'Invalid status transition',
                    details: error.details
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to update shipment' },
            { status: 500 }
        );
    }
}

// DELETE /api/shipments/[id] - Delete shipment (admin only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Shipment ID is required' },
                { status: 400 }
            );
        }

        // Delete shipment
        await shipmentService.deleteShipment(id);

        return NextResponse.json({
            message: 'Shipment deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting shipment:', error);

        if (error.code === 'SHIPMENT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to delete shipment' },
            { status: 500 }
        );
    }
}