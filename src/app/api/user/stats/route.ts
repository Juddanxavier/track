/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { count, eq, and, gte, sql } from 'drizzle-orm';

// GET /api/user/stats - Get user statistics
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get total users
        const [totalUsersResult] = await db
            .select({ count: count() })
            .from(users);

        // Get active users (not banned)
        const [activeUsersResult] = await db
            .select({ count: count() })
            .from(users)
            .where(eq(users.banned, false));

        // Get banned users
        const [bannedUsersResult] = await db
            .select({ count: count() })
            .from(users)
            .where(eq(users.banned, true));

        // Get verified users
        const [verifiedUsersResult] = await db
            .select({ count: count() })
            .from(users)
            .where(eq(users.emailVerified, true));

        // Get new users in last 30 days
        const [newUsers30DaysResult] = await db
            .select({ count: count() })
            .from(users)
            .where(gte(users.createdAt, thirtyDaysAgo));

        // Get new users in last 7 days
        const [newUsers7DaysResult] = await db
            .select({ count: count() })
            .from(users)
            .where(gte(users.createdAt, sevenDaysAgo));

        // Get users by role
        const usersByRole = await db
            .select({
                role: users.role,
                count: count(),
            })
            .from(users)
            .groupBy(users.role);

        // Get daily registrations for the last 30 days
        const dailyRegistrations = await db
            .select({
                date: sql<string>`DATE(${users.createdAt})`,
                count: count(),
            })
            .from(users)
            .where(gte(users.createdAt, thirtyDaysAgo))
            .groupBy(sql`DATE(${users.createdAt})`)
            .orderBy(sql`DATE(${users.createdAt})`);

        return NextResponse.json({
            totalUsers: totalUsersResult.count,
            activeUsers: activeUsersResult.count,
            bannedUsers: bannedUsersResult.count,
            verifiedUsers: verifiedUsersResult.count,
            newUsers: {
                last30Days: newUsers30DaysResult.count,
                last7Days: newUsers7DaysResult.count,
            },
            usersByRole: usersByRole.reduce((acc, item) => {
                acc[item.role || 'customer'] = item.count;
                return acc;
            }, {} as Record<string, number>),
            dailyRegistrations,
            verificationRate: totalUsersResult.count > 0
                ? Math.round((verifiedUsersResult.count / totalUsersResult.count) * 100)
                : 0,
        });
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user statistics' },
            { status: 500 }
        );
    }
}