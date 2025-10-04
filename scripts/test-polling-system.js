#!/usr/bin/env node

/**
 * Simple test to verify the polling notification system is working
 * Usage: node scripts/test-polling-system.js
 */

console.log('🧪 Testing Polling Notification System\n');

// Test the notification endpoints
async function testNotificationEndpoints() {
    const baseUrl = 'http://localhost:3000';
    
    try {
        console.log('1. Testing recent notifications endpoint...');
        const recentResponse = await fetch(`${baseUrl}/api/notifications/recent`);
        console.log(`   Status: ${recentResponse.status}`);
        
        if (recentResponse.ok) {
            const recentData = await recentResponse.json();
            console.log(`   ✅ Recent notifications: ${recentData.notifications?.length || 0} found`);
        } else {
            console.log(`   ❌ Failed: ${recentResponse.statusText}`);
        }

        console.log('\n2. Testing unread count endpoint...');
        const unreadResponse = await fetch(`${baseUrl}/api/notifications/unread-count`);
        console.log(`   Status: ${unreadResponse.status}`);
        
        if (unreadResponse.ok) {
            const unreadData = await unreadResponse.json();
            console.log(`   ✅ Unread count: ${unreadData.unreadCount || 0}`);
        } else {
            console.log(`   ❌ Failed: ${unreadResponse.statusText}`);
        }

        console.log('\n3. Testing deprecated SSE endpoint...');
        const sseResponse = await fetch(`${baseUrl}/api/notifications/sse`);
        console.log(`   Status: ${sseResponse.status} (should be 410 Gone)`);
        
        if (sseResponse.status === 410) {
            console.log('   ✅ SSE endpoint properly deprecated');
        } else {
            console.log('   ⚠️ SSE endpoint status unexpected');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure your development server is running:');
        console.log('   npm run dev');
    }
}

// Instructions for manual testing
function showManualTestInstructions() {
    console.log('\n📋 Manual Testing Instructions:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Open your browser to http://localhost:3000');
    console.log('3. Log in as a user');
    console.log('4. Open browser dev tools and check console logs');
    console.log('5. Look for these polling messages:');
    console.log('   - "🚀 Initializing notification polling system"');
    console.log('   - "✅ Starting notification polling"');
    console.log('   - "📡 Polling for notifications..." (every 15 seconds)');
    console.log('6. Check the notification bell - should show "🟢 Connected" instead of "⚪ Offline mode"');
    console.log('\n🔧 If still showing offline:');
    console.log('   - Check browser console for errors');
    console.log('   - Verify user session is loaded');
    console.log('   - Try refreshing the page');
    console.log('   - Check network tab for API calls every 15 seconds');
}

// Run tests
async function runTests() {
    await testNotificationEndpoints();
    showManualTestInstructions();
    
    console.log('\n✅ Polling system test complete!');
}

runTests().catch(console.error);