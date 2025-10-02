/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

const banUserSchema = z.object({
    reason: z.string().min(1, 'Ban reason is required'),
    expiresAt: z.string().optional().refine((date) => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
    }, 'Invalid date format'),
});

// POST /api/user/[id]/ban - Ban user
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
        const parsed = banUserSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { reason, expiresAt } = parsed.data;

        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, id),
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent banning admin users
        if (existingUser.role === 'admin' || existingUser.role === 'super-admin') {
            return NextResponse.json(
                { error: 'Cannot ban admin users' },
                { status: 400 }
            );
        }

        // Ban user
        const [bannedUser] = await db
            .update(users)
            .set({
                banned: true,
                banReason: reason,
                banExpires: expiresAt ? new Date(expiresAt) : null,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                updatedAt: users.updatedAt,
            });

        return NextResponse.json({
            message: 'User banned successfully',
            user: bannedUser
        });
    } catch (error) {
        console.error('Error banning user:', error);
        return NextResponse.json(
            { error: 'Failed to ban user' },
            { status: 500 }
        );
    }
}

// DELETE /api/user/[id]/ban - Unban user
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    try {
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, id),
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Unban user
        const [unbannedUser] = await db
            .update(users)
            .set({
                banned: false,
                banReason: null,
                banExpires: null,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                updatedAt: users.updatedAt,
            });

        return NextResponse.json({
            message: 'User unbanned successfully',
            user: unbannedUser
        });
    } catch (error) {
        console.error('Error unbanning user:', error);
        return NextResponse.json(
            { error: 'Failed to unban user' },
            { status: 500 }
        );
    }
}