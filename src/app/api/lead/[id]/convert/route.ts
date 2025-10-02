/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/database/db';
import { leads } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { isAdmin } from '@/helpers/authHelpers';

// Validation schema for conversion request
const convertLeadSchema = z.object({
    shipmentData: z.object({
        trackingNumber: z.string().optional(),
        estimatedDelivery: z.string().optional(),
    }).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check admin authentication
        if (!(await isAdmin(request))) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const leadId = (await params).id;
        if (!leadId) {
            return NextResponse.json(
                { error: 'Lead ID is required' },
                { status: 400 }
            );
        }

        // Parse and validate request body
        let body;
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const validationResult = convertLeadSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request data',
                    details: validationResult.error.issues
                },
                { status: 400 }
            );
        }

        const { shipmentData } = validationResult.data;

        // Get the current lead
        const existingLead = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

        if (existingLead.length === 0) {
            return NextResponse.json(
                { error: 'Lead not found' },
                { status: 404 }
            );
        }

        const lead = existingLead[0];

        // Validate that lead can be converted
        if (lead.status === 'converted') {
            return NextResponse.json(
                {
                    error: 'Lead already converted',
                    details: 'This lead has already been converted to a shipment'
                },
                { status: 400 }
            );
        }

        if (lead.status !== 'success') {
            return NextResponse.json(
                {
                    error: 'Lead cannot be converted',
                    details: `Only leads with 'success' status can be converted. Current status: ${lead.status}`
                },
                { status: 400 }
            );
        }

        // Update lead status to converted with timestamp
        const now = new Date();
        const updatedLead = await db
            .update(leads)
            .set({
                status: 'converted',
                convertedAt: now,
                updatedAt: now,
                // Store shipment data in notes for now (placeholder for future shipment integration)
                notes: shipmentData ?
                    `${lead.notes ? lead.notes + '\n\n' : ''}Converted to shipment:\n${shipmentData.trackingNumber ? `Tracking: ${shipmentData.trackingNumber}\n` : ''
                        }${shipmentData.estimatedDelivery ? `Est. Delivery: ${shipmentData.estimatedDelivery}` : ''
                        }`.trim() : lead.notes,
            })
            .where(eq(leads.id, leadId))
            .returning();

        // Track conversion activity
        try {
            const { LeadActivityTracker } = await import('@/lib/leadActivityTracker');
            await LeadActivityTracker.trackConversion(leadId, {
                description: `Lead converted to shipment${shipmentData?.trackingNumber ? ` with tracking number ${shipmentData.trackingNumber}` : ''}`,
                metadata: {
                    shipmentData,
                    convertedFrom: lead.status,
                },
            });
        } catch (error) {
            console.error('Failed to track lead conversion activity:', error);
            // Don't fail the request if activity tracking fails
        }

        if (updatedLead.length === 0) {
            return NextResponse.json(
                { error: 'Failed to update lead status' },
                { status: 500 }
            );
        }

        // TODO: In the future, create actual shipment record here
        // This is a placeholder for future shipment tracking integration
        // const shipmentId = await createShipment({
        //     leadId: leadId,
        //     customerName: lead.customerName,
        //     customerEmail: lead.customerEmail,
        //     originCountry: lead.originCountry,
        //     destinationCountry: lead.destinationCountry,
        //     weight: lead.weight,
        //     trackingNumber: shipmentData?.trackingNumber,
        //     estimatedDelivery: shipmentData?.estimatedDelivery,
        // });

        return NextResponse.json({
            message: 'Lead converted to shipment successfully',
            lead: updatedLead[0],
            // shipmentId: shipmentId, // Will be added when shipment system is implemented
        });

    } catch (error) {
        console.error('Error converting lead:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}