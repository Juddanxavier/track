/** @format */

import { isAdmin, getSession } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { leads } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { shipmentService } from '@/lib/shipmentService';
import { ConvertLeadToShipmentSchema } from '@/types/shipment';
import type { ConvertLeadToShipmentRequest } from '@/types/shipment';

// POST /api/lead/[id]/convert-to-shipment - Convert lead to shipment
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: leadId } = await params;

    try {
        const body = await req.json();
        const parsed = ConvertLeadToShipmentSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const shipmentData: ConvertLeadToShipmentRequest = parsed.data;

        // Get the lead to validate it exists and check conversion eligibility
        const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId));

        if (!lead) {
            return NextResponse.json(
                { error: 'Lead not found' },
                { status: 404 }
            );
        }

        // Check if lead is already converted
        if (lead.shipmentId) {
            return NextResponse.json(
                {
                    error: 'Lead already converted',
                    details: {
                        message: `Lead ${leadId} has already been converted to shipment ${lead.shipmentId}`,
                        shipmentId: lead.shipmentId
                    }
                },
                { status: 409 }
            );
        }

        // Validate lead has required information for conversion
        const missingFields = [];
        if (!lead.customerName) missingFields.push('customerName');
        if (!lead.customerEmail) missingFields.push('customerEmail');
        if (!lead.originCountry) missingFields.push('originCountry');
        if (!lead.destinationCountry) missingFields.push('destinationCountry');

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    error: 'Lead has incomplete information',
                    details: {
                        message: 'Lead is missing required fields for conversion',
                        missingFields
                    }
                },
                { status: 400 }
            );
        }

        // Get current user for audit trail
        const session = await getSession(req);
        const createdBy = session?.user?.id;

        // Convert lead to shipment using the shipment service
        const shipment = await shipmentService.createFromLead(
            leadId,
            shipmentData,
            createdBy
        );

        return NextResponse.json({
            message: 'Lead successfully converted to shipment',
            shipment,
            leadId
        });

    } catch (error: any) {
        console.error('Error converting lead to shipment:', error);

        // Handle specific shipment service errors
        if (error.code === 'LEAD_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Lead not found' },
                { status: 404 }
            );
        }

        if (error.code === 'LEAD_ALREADY_CONVERTED') {
            return NextResponse.json(
                {
                    error: 'Lead already converted',
                    details: error.details
                },
                { status: 409 }
            );
        }

        if (error.code === 'INCOMPLETE_LEAD_DATA') {
            return NextResponse.json(
                {
                    error: 'Lead has incomplete information',
                    details: error.details
                },
                { status: 400 }
            );
        }

        if (error.code === 'TRACKING_CODE_ERROR') {
            return NextResponse.json(
                {
                    error: 'Failed to generate tracking code',
                    details: 'Unable to generate unique tracking code after multiple attempts'
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to convert lead to shipment' },
            { status: 500 }
        );
    }
}