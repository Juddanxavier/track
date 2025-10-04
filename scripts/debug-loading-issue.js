#!/usr/bin/env node

/**
 * Debug script to test notification loading issue
 * Usage: node scripts/debug-loading-issue.js
 */

console.log('🔍 Debugging Notification Loading Issue\n');

async function testEndpoints() {
    const baseUrl = 'http://localhost:3000';
    
    try {
        console.log('1. Testing recent notifications endpoint...');
        const recentResponse = await fetch(`${baseUrl}/api/notifications/recent`);
        console.log(`   Status: ${recentResponse.status}`);
        console.log(`   Headers: ${JSON.stringify(Object.fromEntries(recentResponse.headers.entries()), null, 2)}`);
        
        if (recentResponse.ok) {
            const recentData = await recentResponse.json();
            console.log(`   ✅ Response: ${JSON.stringify(recentData, null, 2)}`);
        } else {
            const errorText = await recentResponse.text();
            console.log(`   ❌ Error: ${errorText}`);
        }

        console.log('\n2. Testing unread count endpoint...');
        const unreadResponse = await fetch(`${baseUrl}/api/notifications/unread-count`);
        console.log(`   Status: ${unreadResponse.status}`);
        
        if (unreadResponse.ok) {
            const unreadData = await unreadResponse.json();
            console.log(`   ✅ Response: ${JSON.stringify(unreadData, null, 2)}`);
        } else {
            const errorText = await unreadResponse.text();
            console.log(`   ❌ Error: ${errorText}`);
        }

        console.log('\n3. Testing admin notifications endpoint...');
        const adminResponse = await fetch(`${baseUrl}/api/notifications?admin=true&limit=5`);
        console.log(`   Status: ${adminResponse.status}`);
        
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            console.log(`   ✅ Response: ${JSON.stringify(adminData, null, 2)}`);
        } else {
            const errorText = await adminResponse.text();
            console.log(`   ❌ Error: ${errorText}`);
        }

        console.log('\n4. Testing stats endpoint...');
        const statsResponse = await fetch(`${baseUrl}/api/notifications/stats`);
        console.log(`   Status: ${statsResponse.status}`);
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log(`   ✅ Response: ${JSON.stringify(statsData, null, 2)}`);
        } else {
            const errorText = await statsResponse.text();
            console.log(`   ❌ Error: ${errorText}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure your development server is running:');
        console.log('   npm run dev');
    }
}

console.log('🧪 Testing notification endpoints...\n');
testEndpoints().then(() => {
    console.log('\n✅ Debug test complete!');
    console.log('\n📋 If loading issue persists:');
    console.log('1. Check browser console for errors');
    console.log('2. Check network tab for failed requests');
    console.log('3. Verify user session is loaded');
    console.log('4. Check if polling is starting (look for console logs)');
}).catch(console.error);