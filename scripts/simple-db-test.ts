/** @format */

import 'dotenv/config';
import { Pool } from 'pg';

async function testConnection() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });

    try {
        console.log('🔄 Testing PostgreSQL connection...');
        console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));

        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL!');

        // Test basic query
        const result = await client.query('SELECT NOW() as current_time');
        console.log('⏰ Current database time:', result.rows[0].current_time);

        // Test users table
        const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
        console.log('👥 Total users:', usersResult.rows[0].count);

        // Test sample users
        const sampleUsers = await client.query('SELECT id, name, email, role FROM users LIMIT 3');
        console.log('📋 Sample users:');
        sampleUsers.rows.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.role || 'customer'}`);
        });

        client.release();
        await pool.end();

        console.log('🎉 Database test completed successfully!');

    } catch (error) {
        console.error('❌ Database test failed:', error);
        await pool.end();
        process.exit(1);
    }
}

testConnection();