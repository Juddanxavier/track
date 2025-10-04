/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

const createUserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    role: z.string().default('customer'),
    sendWelcomeEmail: z.boolean().default(true),
});

// Generate a secure temporary password
function generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
        const parsed = createUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { name, email, phone, address, city, state, country, zipCode, role, sendWelcomeEmail } = parsed.data;

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

        // Check for assignment conflicts (if shipment is already assigned to a user)
        if (shipment.assignedUserId) {
            return NextResponse.json(
                { error: 'Shipment is already assigned to a user' },
                { status: 409 }
            );
        }

        // Generate a temporary password
        const userPassword = generateTemporaryPassword();

        // Get admin user ID for audit trail
        const adminUserId = 'admin-user-id'; // TODO: Extract from session

        try {
            // Use Better Auth admin plugin to create user
            const createUserResult = await auth.api.createUser({
                body: {
                    name,
                    email,
                    password: userPassword,
                    role: role as 'admin' | 'user',
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

            // Update the user with additional fields that might not be handled by the admin plugin
            const [updatedUser] = await db
                .update(users)
                .set({
                    phone,
                    address,
                    city,
                    state,
                    country,
                    zipCode,
                    role,
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
                    banned: users.banned,
                    createdAt: users.createdAt,
                    updatedAt: users.updatedAt,
                });

            // Assign the new user to the shipment
            const [updatedShipment] = await db
                .update(shipments)
                .set({
                    assignedUserId: updatedUser.id,
                    userAssignmentStatus: 'assigned',
                    updatedAt: new Date(),
                })
                .where(eq(shipments.id, shipmentId))
                .returning();

            // Create audit event for user creation and assignment
            await shipmentEventService.addEvent({
                shipmentId,
                eventType: 'status_change',
                description: `New user created and assigned: ${updatedUser.name} (${updatedUser.email})`,
                source: 'manual',
                sourceId: adminUserId,
                eventTime: new Date(),
                metadata: {
                    action: 'user_creation_and_assignment',
                    createdUserId: updatedUser.id,
                    createdUserName: updatedUser.name,
                    createdUserEmail: updatedUser.email,
                    previousUserAssignmentStatus: shipment.userAssignmentStatus,
                    adminUserId,
                    auditTrail: {
                        action: 'create_and_assign_user',
                        source: 'admin_api',
                        recordedAt: new Date().toISOString(),
                    },
                },
            });

            // Send welcome email with password reset if requested
            if (sendWelcomeEmail) {
                try {
                    await auth.api.forgetPassword({
                        body: { email },
                        headers: req.headers,
                    });
                } catch (emailError) {
                    console.error('Failed to send welcome email:', emailError);
                    // Don't fail user creation if email fails
                }
            }

            // Send welcome notification to the new user
            try {
                await notificationEventHandlers.handleWelcomeMessage({
                    id: updatedUser.id,
                    name: updatedUser.name || '',
                    email: updatedUser.email,
                    role: updatedUser.role || 'customer',
                });

                // Send shipment assignment notification
                await notificationEventHandlers.handleShipmentAssigned({
                    shipmentId: updatedShipment.id,
                    trackingCode: updatedShipment.trackingCode,
                    customerName: updatedShipment.customerName,
                    customerEmail: updatedShipment.customerEmail,
                    assignedUserId: updatedUser.id,
                    assignedUserName: updatedUser.name || '',
                    assignedUserEmail: updatedUser.email,
                    assignedBy: adminUserId,
                    courier: updatedShipment.courier || 'TBD',
                    status: updatedShipment.status,
                });

                // Send admin notification about new user registration
                await notificationEventHandlers.handleUserRegistration({
                    id: updatedUser.id,
                    name: updatedUser.name || '',
                    email: updatedUser.email,
                    role: updatedUser.role || 'customer',
                });
            } catch (notificationError) {
                console.error('Failed to send notifications:', notificationError);
                // Don't fail user creation if notifications fail
            }

            return NextResponse.json({
                message: 'User created and assigned to shipment successfully',
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
                welcomeEmailSent: sendWelcomeEmail,
            }, { status: 201 });

        } catch (authError: any) {
            console.error('Error creating user:', authError);

            // Handle specific Better Auth errors
            if (authError.message?.includes('already exists') || authError.message?.includes('duplicate')) {
                return NextResponse.json(
                    { error: 'User with this email already exists' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to create user' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error creating user and assigning to shipment:', error);
        return NextResponse.json(
            { error: 'Failed to create user and assign to shipment' },
            { status: 500 }
        );
    }
}