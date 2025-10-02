/** @format */

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { count } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log('🔄 Testing database connection...');

        // Test basic connection
        const [result] = await db.select({ count: count() }).from(users);
        console.log('✅ Database connection successful!');
        console.log(`📊 Total users in database: ${result.count}`);

        // Test querying users
        const allUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            banned: users.banned,
            createdAt: users.createdAt,
        }).from(users).limit(5);

        // Test admin user exists
        const adminUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.role, 'admin'),
        });

        return NextResponse.json({
            success: true,
            message: 'Database connection successful!',
            data: {
                totalUsers: result.count,
                sampleUsers: allUsers.map(user => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role || 'customer',
                    createdAt: user.createdAt,
                })),
                hasAdmin: !!adminUser,
                adminEmail: adminUser?.email || null,
            }
        });

    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return NextResponse.json({
            success: false,
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}