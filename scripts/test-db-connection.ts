/** @format */

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { count } from 'drizzle-orm';

async function testDatabaseConnection() {
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

        console.log('\n👥 Sample users:');
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role || 'customer'}`);
        });

        // Test admin user exists
        const adminUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.role, 'admin'),
        });

        if (adminUser) {
            console.log(`\n🔑 Admin user found: ${adminUser.email}`);
        } else {
            console.log('\n⚠️  No admin user found. Run the seed script to create one.');
        }

        console.log('\n🎉 Database connection test completed successfully!');

    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

testDatabaseConnection();