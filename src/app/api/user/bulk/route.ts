/** @format */

import { isAdmin, isSuperAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { inArray, eq } from 'drizzle-orm';
import z from 'zod';

const bulkActionSchema = z.object({
    userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
    action: z.enum(['ban', 'unban', 'delete', 'updateRole']),
    data: z.object({
        reason: z.string().optional(),
        expiresAt: z.string().optional().refine((date) => {
            if (!date) return true;
            const parsedDate = new Date(date);
            return !isNaN(parsedDate.getTime());
        }, 'Invalid date format'),
        role: z.enum(['customer', 'admin', 'super-admin']).optional(),
    }).optional(),
});

// POST /api/user/bulk - Bulk operations on users
export async function POST(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = bulkActionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { userIds, action, data } = parsed.data;

        // Validate users exist and get their current data
        const existingUsers = await db
            .select()
            .from(users)
            .where(inArray(users.id, userIds));

        if (existingUsers.length !== userIds.length) {
            return NextResponse.json(
                { error: 'Some users not found' },
                { status: 404 }
            );
        }

        // Check for admin users in operations that shouldn't affect them
        const adminUsers = existingUsers.filter(
            user => user.role === 'admin' || user.role === 'super-admin'
        );

        if ((action === 'ban' || action === 'delete') && adminUsers.length > 0) {
            return NextResponse.json(
                { error: 'Cannot perform this action on admin users' },
                { status: 400 }
            );
        }

        // For role updates, check permissions
        if (action === 'updateRole') {
            if (!data?.role) {
                return NextResponse.json(
                    { error: 'Role is required for updateRole action' },
                    { status: 400 }
                );
            }

            if ((data.role === 'admin' || data.role === 'super-admin') && !(await isSuperAdmin(req))) {
                return NextResponse.json(
                    { error: 'Only super-admin can assign admin roles' },
                    { status: 403 }
                );
            }
        }

        let result;
        const now = new Date();

        switch (action) {
            case 'ban':
                if (!data?.reason) {
                    return NextResponse.json(
                        { error: 'Ban reason is required' },
                        { status: 400 }
                    );
                }

                result = await db
                    .update(users)
                    .set({
                        banned: true,
                        banReason: data.reason,
                        banExpires: data.expiresAt ? new Date(data.expiresAt) : null,
                        updatedAt: now,
                    })
                    .where(inArray(users.id, userIds))
                    .returning({
                        id: users.id,
                        name: users.name,
                        email: users.email,
                        banned: users.banned,
                    });
                break;

            case 'unban':
                result = await db
                    .update(users)
                    .set({
                        banned: false,
                        banReason: null,
                        banExpires: null,
                        updatedAt: now,
                    })
                    .where(inArray(users.id, userIds))
                    .returning({
                        id: users.id,
                        name: users.name,
                        email: users.email,
                        banned: users.banned,
                    });
                break;

            case 'delete':
                await db.delete(users).where(inArray(users.id, userIds));
                result = { deletedCount: userIds.length };
                break;

            case 'updateRole':
                result = await db
                    .update(users)
                    .set({
                        role: data!.role,
                        updatedAt: now,
                    })
                    .where(inArray(users.id, userIds))
                    .returning({
                        id: users.id,
                        name: users.name,
                        email: users.email,
                        role: users.role,
                    });
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            message: `Bulk ${action} completed successfully`,
            result,
            affectedCount: Array.isArray(result) ? result.length : userIds.length,
        });
    } catch (error) {
        console.error('Error performing bulk operation:', error);
        return NextResponse.json(
            { error: 'Failed to perform bulk operation' },
            { status: 500 }
        );
    }
}