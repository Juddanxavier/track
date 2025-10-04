/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { assignmentNotificationService } from '@/lib/assignmentNotificationService';

const signupFromShipmentSchema = z.object({
    token: z.string().min(1, 'Signup token is required'),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate request body
        const parsed = signupFromShipmentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { token, name, email, password, phone, address, city, state, country, zipCode } = parsed.data;

        // Find shipment by signup token
        const [shipment] = await db
            .select()
            .from(shipments)
            .where(
                and(
                    eq(shipments.signupToken, token),
                    eq(shipments.userAssignmentStatus, 'signup_sent')
                )
            );

        if (!shipment) {
            return NextResponse.json(
                { error: 'Invalid or expired signup token' },
                { status: 400 }
            );
        }

        // Check if token has expired
        if (shipment.signupTokenExpiry && new Date() > shipment.signupTokenExpiry) {
            return NextResponse.json(
                { error: 'Signup token has expired' },
                { status: 400 }
            );
        }

        // Check if shipment is already assigned to a user
        if (shipment.assignedUserId) {
            return NextResponse.json(
                { error: 'Shipment is already assigned to a user' },
                { status: 409 }
            );
        }

        // Check for duplicate email
        const [existingUser] = await db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(eq(users.email, email));

        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 409 }
            );
        }

        try {
            // Create user account using Better Auth
            const createUserResult = await auth.api.createUser({
                body: {
                    name,
                    email,
                    password,
                    role: 'user',
                    data: {
                        phone,
                        address,
                        city,
                        state,
                        country,
                        zipCode,
                        banned: false,
                    }
                },
                headers: req.headers,
            });

            if (!createUserResult.user) {
                return NextResponse.json(
                    { error: 'Failed to create user account' },
                    { status: 500 }
                );
            }

            // Update the user with additional fields
            const [updatedUser] = await db
                .update(users)
                .set({
                    phone,
                    address,
                    city,
                    state,
                    country,
                    zipCode,
                    role: 'customer',
                    banned: false,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, createUserResult.user.id))
                .returning({
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    emailVerified: users.emailVerified,
                    phone: users.phone,
                    address: users.address,
                    city: users.city,
                    state: users.state,
                    country: users.country,
                    zipCode: users.zipCode,
                    role: users.role,
                    createdAt: users.createdAt,
                    updatedAt: users.updatedAt,
                });

            // Assign the new user to the shipment and clear signup token
            const [updatedShipment] = await db
                .update(shipments)
                .set({
                    assignedUserId: updatedUser.id,
                    userAssignmentStatus: 'signup_completed',
                    signupToken: null, // Clear the token after successful signup
                    signupTokenExpiry: null,
                    updatedAt: new Date(),
                })
                .where(eq(shipments.id, shipment.id))
                .returning();

            // Create audit event for signup completion
            await shipmentEventService.addEvent({
                shipmentId: shipment.id,
                eventType: 'status_change',
                description: `Signup completed and user assigned: ${updatedUser.name} (${updatedUser.email})`,
                source: 'user_action',
                sourceId: updatedUser.id,
                eventTime: new Date(),
                metadata: {
                    action: 'signup_completion_and_assignment',
                    signupToken: token,
                    createdUserId: updatedUser.id,
                    createdUserName: updatedUser.name,
                    createdUserEmail: updatedUser.email,
                    previousUserAssignmentStatus: shipment.userAssignmentStatus,
                    auditTrail: {
                        action: 'complete_signup_from_shipment',
                        source: 'signup_api',
                        recordedAt: new Date().toISOString(),
                    },
                },
            });

            // Send signup completion notifications
            try {
                await assignmentNotificationService.notifySignupCompleted(
                    shipment.id,
                    updatedUser.id
                );
            } catch (notificationError) {
                console.error('Failed to send notifications:', notificationError);
                // Don't fail signup if notifications fail
            }

            return NextResponse.json({
                message: 'Account created and assigned to shipment successfully',
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    role: updatedUser.role,
                    createdAt: updatedUser.createdAt,
                },
                shipment: {
                    id: updatedShipment.id,
                    trackingCode: updatedShipment.trackingCode,
                    assignedUserId: updatedShipment.assignedUserId,
                    userAssignmentStatus: updatedShipment.userAssignmentStatus,
                    updatedAt: updatedShipment.updatedAt,
                },
                redirectUrl: `/tracking/${updatedShipment.trackingCode}`,
            }, { status: 201 });

        } catch (authError: any) {
            console.error('Error creating user from signup:', authError);

            // Handle specific Better Auth errors
            if (authError.message?.includes('already exists') || authError.message?.includes('duplicate')) {
                return NextResponse.json(
                    { error: 'User with this email already exists' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to create user account' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error completing signup from shipment:', error);
        return NextResponse.json(
            { error: 'Failed to complete signup' },
            { status: 500 }
        );
    }
}