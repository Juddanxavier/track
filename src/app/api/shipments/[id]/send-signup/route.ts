/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { assignmentNotificationService } from '@/lib/assignmentNotificationService';
import crypto from 'crypto';

const sendSignupSchema = z.object({
    customerEmail: z.string().email('Invalid email format').optional(),
    customMessage: z.string().optional(),
});

// Generate a secure signup token
function generateSignupToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

// Calculate token expiry (7 days from now)
function getTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Check admin authorization
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const shipmentId = params.id;
        const body = await req.json();

        // Validate request body
        const parsed = sendSignupSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { customerEmail, customMessage } = parsed.data;

        // Check if shipment exists
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(eq(shipments.id, shipmentId));

        if (!shipment) {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        // Use provided email or fall back to shipment customer email
        const targetEmail = customerEmail || shipment.customerEmail;

        if (!targetEmail) {
            return NextResponse.json(
                { error: 'No customer email available for signup invitation' },
                { status: 400 }
            );
        }

        // Check if user with this email already exists
        const [existingUser] = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.email, targetEmail));

        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists. Use assign-user endpoint instead.' },
                { status: 409 }
            );
        }

        // Check if shipment is already assigned to a user
        if (shipment.assignedUserId) {
            return NextResponse.json(
                { error: 'Shipment is already assigned to a user' },
                { status: 409 }
            );
        }

        // Generate secure signup token
        const signupToken = generateSignupToken();
        const tokenExpiry = getTokenExpiry();

        // Get admin user ID for audit trail
        const adminUserId = 'admin-user-id'; // TODO: Extract from session

        // Update shipment with signup token and status
        const [updatedShipment] = await db
            .update(shipments)
            .set({
                signupToken,
                signupTokenExpiry: tokenExpiry,
                signupLinkSentAt: new Date(),
                userAssignmentStatus: 'signup_sent',
                updatedAt: new Date(),
            })
            .where(eq(shipments.id, shipmentId))
            .returning();

        // Create audit event for signup link generation
        await shipmentEventService.addEvent({
            shipmentId,
            eventType: 'status_change',
            description: `Signup invitation sent to: ${targetEmail}`,
            source: 'manual',
            sourceId: adminUserId,
            eventTime: new Date(),
            metadata: {
                action: 'signup_invitation_sent',
                targetEmail,
                signupToken,
                tokenExpiry: tokenExpiry.toISOString(),
                customMessage,
                previousUserAssignmentStatus: shipment.userAssignmentStatus,
                adminUserId,
                auditTrail: {
                    action: 'send_signup_invitation',
                    source: 'admin_api',
                    recordedAt: new Date().toISOString(),
                },
            },
        });

        // Generate signup link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const signupLink = `${baseUrl}/auth/signup-from-shipment?token=${signupToken}`;

        // Send signup invitation email and notifications
        try {
            await assignmentNotificationService.notifySignupLinkSent(
                shipmentId,
                targetEmail,
                signupLink,
                adminUserId
            );
        } catch (emailError) {
            console.error('Failed to send signup invitation email:', emailError);

            // Revert the shipment status if email fails
            await db
                .update(shipments)
                .set({
                    signupToken: null,
                    signupTokenExpiry: null,
                    signupLinkSentAt: null,
                    userAssignmentStatus: 'unassigned',
                    updatedAt: new Date(),
                })
                .where(eq(shipments.id, shipmentId));

            return NextResponse.json(
                { error: 'Failed to send signup invitation email' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Signup invitation sent successfully',
            shipment: {
                id: updatedShipment.id,
                trackingCode: updatedShipment.trackingCode,
                userAssignmentStatus: updatedShipment.userAssignmentStatus,
                signupLinkSentAt: updatedShipment.signupLinkSentAt,
                updatedAt: updatedShipment.updatedAt,
            },
            invitation: {
                targetEmail,
                signupLink,
                tokenExpiry,
                customMessage,
            },
        });

    } catch (error) {
        console.error('Error sending signup invitation:', error);
        return NextResponse.json(
            { error: 'Failed to send signup invitation' },
            { status: 500 }
        );
    }
}