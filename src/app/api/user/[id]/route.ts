/** @format */

import { getSession, isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';
import z from 'zod';

const updateUserSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    role: z.string().optional(),
    banned: z.boolean().optional(),
    banReason: z.string().optional(),
    banExpires: z.string().optional().refine((date) => {
        if (!date) return true;
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
    }, 'Invalid date format'),
    emailVerified: z.boolean().optional(),
    image: z.string().optional().refine((url) => {
        if (!url) return true;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }, 'Invalid URL format'),
    avatar: z.string().optional(),
    avatarUrl: z.string().optional().refine((url) => {
        if (!url) return true;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }, 'Invalid URL format'),
});

// GET /api/user/[id] - Get single user
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Users can view their own profile, admins can view any profile
    const isOwnProfile = session.user.id === id;
    const isAdminUser = await isAdmin(req);

    if (!isOwnProfile && !isAdminUser) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const user = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, id),
            columns: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                avatar: true,
                avatarUrl: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                country: true,
                zipCode: true,
                role: true,
                banned: true,
                banReason: true,
                banExpires: true,
                createdAt: true,
                updatedAt: true,
                stripeCustomerId: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // If not admin, hide sensitive fields
        if (!isAdminUser) {
            const { role, banned, banReason, banExpires, stripeCustomerId, ...publicUser } = user;
            return NextResponse.json({ user: publicUser });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user' },
            { status: 500 }
        );
    }
}

// PUT /api/user/[id] - Update user
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Users can update their own profile, admins can update any profile
    const isOwnProfile = session.user.id === id;
    const isAdminUser = await isAdmin(req);

    if (!isOwnProfile && !isAdminUser) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = updateUserSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const updateData = parsed.data;

        // Non-admin users cannot update certain fields
        if (!isAdminUser) {
            const { role, banned, banReason, banExpires, emailVerified, ...allowedFields } = updateData;
            Object.assign(updateData, allowedFields);
        }

        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, id),
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // If email is being updated, check for conflicts
        if (updateData.email && updateData.email !== existingUser.email) {
            const emailExists = await db.query.users.findFirst({
                where: (u, { eq, and, ne }) => and(eq(u.email, updateData.email!), ne(u.id, id)),
            });

            if (emailExists) {
                return NextResponse.json(
                    { error: 'Email already in use' },
                    { status: 409 }
                );
            }
        }

        // Update user
        const [updatedUser] = await db
            .update(users)
            .set({
                ...updateData,
                banExpires: updateData.banExpires ? new Date(updateData.banExpires) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                emailVerified: users.emailVerified,
                image: users.image,
                avatar: users.avatar,
                avatarUrl: users.avatarUrl,
                phone: users.phone,
                address: users.address,
                city: users.city,
                state: users.state,
                country: users.country,
                zipCode: users.zipCode,
                role: users.role,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                stripeCustomerId: users.stripeCustomerId,
            });

        // Trigger notification events for user updates (admin only)
        if (isAdminUser && !isOwnProfile) {
            try {
                // Check for ban/unban changes
                const wasBanned = existingUser.banned;
                const isBanned = updatedUser.banned;

                if (!wasBanned && isBanned) {
                    // User was banned
                    await notificationEventHandlers.handleUserBan({
                        id: updatedUser.id,
                        name: updatedUser.name || '',
                        email: updatedUser.email,
                        banReason: updatedUser.banReason,
                        bannedBy: session.user.id,
                    });
                } else if (wasBanned && !isBanned) {
                    // User was unbanned
                    await notificationEventHandlers.handleUserUnban({
                        id: updatedUser.id,
                        name: updatedUser.name || '',
                        email: updatedUser.email,
                        unbannedBy: session.user.id,
                    });
                }

                // Check for other profile changes
                const changes: string[] = [];
                if (updateData.name && updateData.name !== existingUser.name) changes.push('name');
                if (updateData.email && updateData.email !== existingUser.email) changes.push('email');
                if (updateData.phone && updateData.phone !== existingUser.phone) changes.push('phone');
                if (updateData.role && updateData.role !== existingUser.role) changes.push('role');
                if (updateData.address && updateData.address !== existingUser.address) changes.push('address');

                if (changes.length > 0) {
                    // Profile was updated by admin
                    await notificationEventHandlers.handleAccountUpdate({
                        id: updatedUser.id,
                        name: updatedUser.name || '',
                        email: updatedUser.email,
                        updatedBy: session.user.id,
                        changes,
                    });
                }
            } catch (notificationError) {
                console.error('Failed to send user update notifications:', notificationError);
                // Don't fail user update if notifications fail
            }
        }

        // If not admin, hide sensitive fields in response
        if (!isAdminUser) {
            const { role, banned, banReason, banExpires, stripeCustomerId, ...publicUser } = updatedUser;
            return NextResponse.json({ user: publicUser });
        }

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}

// DELETE /api/user/[id] - Delete user (admin only)
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

        // Prevent deletion of admin users (optional safety check)
        if (existingUser.role === 'admin' || existingUser.role === 'super-admin') {
            return NextResponse.json(
                { error: 'Cannot delete admin users' },
                { status: 400 }
            );
        }

        // Delete user (cascade will handle related records)
        await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 }
        );
    }
}