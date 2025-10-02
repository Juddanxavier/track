/** @format */

import 'dotenv/config';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testUserAPI() {
    console.log('🧪 Testing User Management API...');
    console.log('API Base URL:', API_BASE);

    try {
        // Test 1: Get user statistics
        console.log('\n📊 Testing GET /api/user/stats');
        const statsResponse = await fetch(`${API_BASE}/api/user/stats`);
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log('✅ Stats retrieved:', {
                totalUsers: stats.totalUsers,
                activeUsers: stats.activeUsers,
                bannedUsers: stats.bannedUsers,
                verificationRate: stats.verificationRate
            });
        } else {
            console.log('⚠️  Stats endpoint returned:', statsResponse.status, await statsResponse.text());
        }

        // Test 2: List users
        console.log('\n👥 Testing GET /api/user');
        const usersResponse = await fetch(`${API_BASE}/api/user?page=1&perPage=10`);
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            console.log('✅ Users retrieved:', {
                count: usersData.users?.length || 0,
                pagination: usersData.pagination
            });

            if (usersData.users && usersData.users.length > 0) {
                console.log('📋 First user:', {
                    id: usersData.users[0].id,
                    name: usersData.users[0].name,
                    email: usersData.users[0].email,
                    role: usersData.users[0].role
                });
            }
        } else {
            console.log('⚠️  Users endpoint returned:', usersResponse.status, await usersResponse.text());
        }

        // Test 3: Test database connection endpoint
        console.log('\n🔌 Testing GET /api/test-db');
        const dbTestResponse = await fetch(`${API_BASE}/api/test-db`);
        if (dbTestResponse.ok) {
            const dbData = await dbTestResponse.json();
            console.log('✅ Database test:', {
                success: dbData.success,
                totalUsers: dbData.data?.totalUsers,
                hasAdmin: dbData.data?.hasAdmin,
                adminEmail: dbData.data?.adminEmail
            });
        } else {
            console.log('⚠️  DB test endpoint returned:', dbTestResponse.status, await dbTestResponse.text());
        }

        console.log('\n🎉 API tests completed!');
        console.log('\n📝 Next steps:');
        console.log('1. Visit http://localhost:3000/api/test-db to see database status');
        console.log('2. Use the admin user (killerbean122@gmail.com) to test the API');
        console.log('3. Check the examples/user-management-usage.md for API usage');

    } catch (error) {
        console.error('❌ API test failed:', error);
    }
}

testUserAPI();