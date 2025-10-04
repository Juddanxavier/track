/** @format */

/**
 * Test script for the periodic sync cron endpoint
 * 
 * This script tests the /api/cron/sync-tracking endpoint
 * to ensure it works correctly for background sync jobs.
 */

async function testCronSync() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    console.log('Testing periodic sync cron endpoint...');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Using cron secret: ${cronSecret ? 'Yes' : 'No'}`);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add authorization header if cron secret is configured
        if (cronSecret) {
            headers['Authorization'] = `Bearer ${cronSecret}`;
        }

        const response = await fetch(`${baseUrl}/api/cron/sync-tracking`, {
            method: 'POST',
            headers,
        });

        const data = await response.json();

        console.log('\n--- Response ---');
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ Cron sync endpoint test successful!');

            if (data.result) {
                const { totalShipments, successful, failed, skipped, duration } = data.result;
                console.log(`\n📊 Sync Results:`);
                console.log(`- Total shipments processed: ${totalShipments}`);
                console.log(`- Successful syncs: ${successful}`);
                console.log(`- Failed syncs: ${failed}`);
                console.log(`- Skipped syncs: ${skipped}`);
                console.log(`- Duration: ${duration}ms`);
            }
        } else {
            console.log('\n❌ Cron sync endpoint test failed!');

            if (response.status === 401) {
                console.log('💡 Tip: Make sure CRON_SECRET is set in your environment if you want to use authentication');
            }
        }

    } catch (error) {
        console.error('\n❌ Error testing cron sync endpoint:', error);

        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
            console.log('💡 Tip: Make sure your development server is running (npm run dev)');
        }
    }
}

// Run the test
testCronSync().catch(console.error);