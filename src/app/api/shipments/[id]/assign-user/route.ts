/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { shipments, users } from '@/database/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';

const assignUserSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
});

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
        const parsed = assignUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { userId } = parsed.data;

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

        // Check if user exists
        const [user] = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                banned: users.banned,
            })
            .from(users)
            .where(eq(users.id, userId));

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user is banned
        if (user.banned) {
            return NextResponse.json(
                { error: 'Cannot assign banned user to shipment' },
                { status: 400 }
            );
        }

        // Check for assignment conflicts (if shipment is already assigned to a different user)
        if (shipment.assignedUserId && shipment.assignedUserId !== userId) {
            return NextResponse.json(
                { error: 'Shipment is already assigned to a different user' },
                { status: 409 }
            );
        }

        // Get admin user ID for audit trail
        const adminSession = await req.headers.get('authorization');
        // For now, we'll use a placeholder admin ID - in a real implementation,
        // you'd extract this from the session/token
        const adminUserId = 'admin-user-id'; // TODO: Extract from session

        // Update shipment with user assignment
        const [updatedShipment] = await db
            .update(shipments)
            .set({
                assignedUserId: userId,
                userAssignmentStatus: 'assigned',
                updatedAt: new Date(),
            })
            .where(eq(shipments.id, shipmentId))
            .returning();

        // Create audit event for user assignment
        await shipmentEventService.addEvent({
            shipmentId,
            eventType: 'status_change',
            description: `User assigned: ${user.name} (${user.email})`,
            source: 'manual',
            sourceId: adminUserId,
            eventTime: new Date(),
            metadata: {
                action: 'user_assignment',
                assignedUserId: userId,
                assignedUserName: user.name,
                assignedUserEmail: user.email,
                previousAssignedUserId: shipment.assignedUserId,
                previousUserAssignmentStatus: shipment.userAssignmentStatus,
                adminUserId,
                auditTrail: {
                    action: 'assign_user',
                    source: 'admin_api',
                    recordedAt: new Date().toISOString(),
                },
            },
        });

        // Send assignment notification to the assigned user
        try {
            await notificationEventHandlers.handleShipmentAssigned({
                shipmentId: updatedShipment.id,
                trackingCode: updatedShipment.trackingCode,
                customerName: updatedShipment.customerName,
                customerEmail: updatedShipment.customerEmail,
                assignedUserId: userId,
                assignedUserName: user.name,
                assignedUserEmail: user.email,
                assignedBy: adminUserId,
                courier: updatedShipment.courier || 'TBD',
                status: updatedShipment.status,
            });
        } catch (notificationError) {
            console.error('Failed to send assignment notification:', notificationError);
            // Don't fail the assignment if notification fails
        }

        return NextResponse.json({
            message: 'User assigned to shipment successfully',
            shipment: {
                id: updatedShipment.id,
                trackingCode: updatedShipment.trackingCode,
                assignedUserId: updatedShipment.assignedUserId,
                userAssignmentStatus: updatedShipment.userAssignmentStatus,
                updatedAt: updatedShipment.updatedAt,
            },
            assignedUser: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });

    } catch (error) {
        console.error('Error assigning user to shipment:', error);
        return NextResponse.json(
            { error: 'Failed to assign user to shipment' },
            { status: 500 }
        );
    }
}