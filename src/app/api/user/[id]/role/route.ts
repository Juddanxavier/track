/** @format */

import { isAdmin, isSuperAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

const updateRoleSchema = z.object({
    role: z.enum(['customer', 'admin', 'super-admin']),
});

// PUT /api/user/[id]/role - Update user role
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
        const parsed = updateRoleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { role } = parsed.data;

        // Only super-admin can assign admin or super-admin roles
        if ((role === 'admin' || role === 'super-admin') && !(await isSuperAdmin(req))) {
            return NextResponse.json(
                { error: 'Only super-admin can assign admin roles' },
                { status: 403 }
            );
        }

        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, id),
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update user role
        const [updatedUser] = await db
            .update(users)
            .set({
                role,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                updatedAt: users.updatedAt,
            });

        return NextResponse.json({
            message: 'User role updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        return NextResponse.json(
            { error: 'Failed to update user role' },
            { status: 500 }
        );
    }
}