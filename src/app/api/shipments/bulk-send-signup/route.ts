/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq, inArray, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { assignmentNotificationService } from '@/lib/assignmentNotificationService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import crypto from 'crypto';

const bulkSendSignupSchema = z.object({
    shipmentIds: z.array(z.string()).min(1, 'At least one shipment ID is required'),
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

export async function POST(req: NextRequest) {
    try {
        // Check admin authorization
        if (!(await isAdmin(req))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();

        // Validate request body
        const parsed = bulkSendSignupSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { shipmentIds, customMessage } = parsed.data;

        // Get admin user ID for audit trail
        const adminUserId = 'admin-user-id'; // TODO: Extract from session

        // Get shipments that are eligible for signup links
        const eligibleShipments = await db
            .select()
            .from(shipments)
            .where(
                and(
                    inArray(shipments.id, shipmentIds),
                    eq(shipments.userAssignmentStatus, 'unassigned'),
                    isNull(shipments.assignedUserId)
                )
            );

        if (eligibleShipments.length === 0) {
            return NextResponse.json(
                { error: 'No eligible shipments found for signup links' },
                { status: 400 }
            );
        }

        // Check for existing users with the same email addresses
        const customerEmails = eligibleShipments.map(s => s.customerEmail);
        const existingUsers = await db
            .select({ email: users.email })
            .from(users)
            .where(inArray(users.email, customerEmails));

        const existingEmailSet = new Set(existingUsers.map(u => u.email));

        // Filter out shipments with existing users
        const shipmentsForSignup = eligibleShipments.filter(
            s => !existingEmailSet.has(s.customerEmail)
        );

        if (shipmentsForSignup.length === 0) {
            return NextResponse.json(
                { error: 'All customers already have user accounts' },
                { status: 400 }
            );
        }

        const result = {
            successful: 0,
            failed: 0,
            errors: [] as string[],
            processed: [] as Array<{
                shipmentId: string;
                trackingCode: string;
                customerEmail: string;
                status: 'success' | 'error';
                error?: string;
            }>,
        };

        // Process each shipment
        for (const shipment of shipmentsForSignup) {
            try {
                // Generate secure signup token
                const signupToken = generateSignupToken();
                const tokenExpiry = getTokenExpiry();

                // Update shipment with signup token and status
                await db
                    .update(shipments)
                    .set({
                        signupToken,
                        signupTokenExpiry: tokenExpiry,
                        signupLinkSentAt: new Date(),
                        userAssignmentStatus: 'signup_sent',
                        updatedAt: new Date(),
                    })
                    .where(eq(shipments.id, shipment.id));

                // Create audit event
                await shipmentEventService.addEvent({
                    shipmentId: shipment.id,
                    eventType: 'status_change',
                    description: `Bulk signup invitation sent to: ${shipment.customerEmail}`,
                    source: 'manual',
                    sourceId: adminUserId,
                    eventTime: new Date(),
                    metadata: {
                        action: 'bulk_signup_invitation_sent',
                        targetEmail: shipment.customerEmail,
                        signupToken,
                        tokenExpiry: tokenExpiry.toISOString(),
                        customMessage,
                        previousUserAssignmentStatus: shipment.userAssignmentStatus,
                        adminUserId,
                        auditTrail: {
                            action: 'bulk_send_signup_invitation',
                            source: 'admin_api',
                            recordedAt: new Date().toISOString(),
                        },
                    },
                });

                // Generate signup link
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const signupLink = `${baseUrl}/auth/signup-from-shipment?token=${signupToken}`;

                // Send signup invitation
                await assignmentNotificationService.notifySignupLinkSent(
                    shipment.id,
                    shipment.customerEmail,
                    signupLink,
                    adminUserId
                );

                result.successful++;
                result.processed.push({
                    shipmentId: shipment.id,
                    trackingCode: shipment.trackingCode,
                    customerEmail: shipment.customerEmail,
                    status: 'success',
                });

            } catch (error: any) {
                result.failed++;
                const errorMessage = error.message || 'Unknown error';
                result.errors.push(`Shipment ${shipment.trackingCode}: ${errorMessage}`);
                result.processed.push({
                    shipmentId: shipment.id,
                    trackingCode: shipment.trackingCode,
                    customerEmail: shipment.customerEmail,
                    status: 'error',
                    error: errorMessage,
                });

                // Revert shipment status if it was updated
                try {
                    await db
                        .update(shipments)
                        .set({
                            signupToken: null,
                            signupTokenExpiry: null,
                            signupLinkSentAt: null,
                            userAssignmentStatus: 'unassigned',
                            updatedAt: new Date(),
                        })
                        .where(eq(shipments.id, shipment.id));
                } catch (revertError) {
                    console.error('Failed to revert shipment status:', revertError);
                }
            }
        }

        // Send bulk operation completion notification
        if (result.successful > 0 || result.failed > 0) {
            await assignmentNotificationService.notifyBulkAssignmentCompleted(
                'signup_links',
                {
                    successful: result.successful,
                    failed: result.failed,
                    total: shipmentsForSignup.length,
                    errors: result.errors,
                },
                adminUserId
            );
        }

        return NextResponse.json({
            message: `Bulk signup operation completed: ${result.successful} successful, ${result.failed} failed`,
            summary: {
                totalRequested: shipmentIds.length,
                eligible: eligibleShipments.length,
                processed: shipmentsForSignup.length,
                successful: result.successful,
                failed: result.failed,
            },
            results: result.processed,
            errors: result.errors,
            skipped: {
                alreadyAssigned: eligibleShipments.length - shipmentsForSignup.length,
                existingUsers: existingUsers.map(u => u.email),
            },
        });

    } catch (error) {
        console.error('Error in bulk signup operation:', error);
        return NextResponse.json(
            { error: 'Failed to process bulk signup operation' },
            { status: 500 }
        );
    }
}