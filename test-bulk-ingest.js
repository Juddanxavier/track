/** @format */

// Simple test for the bulk-ingest endpoint
const testBulkIngest = async () => {
    const baseUrl = 'http://localhost:3000';
    
    const testData = {
        shipments: [
            {
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                customerPhone: '+1-555-0123',
                originAddress: {
                    name: 'Acme Corp',
                    addressLine1: '123 Business St',
                    city: 'New York',
                    state: 'NY',
                    postalCode: '10001',
                    country: 'US',
                },
                destinationAddress: {
                    name: 'John Doe',
                    addressLine1: '456 Home Ave',
                    city: 'Los Angeles',
                    state: 'CA',
                    postalCode: '90210',
                    country: 'US',
                },
                packageDescription: 'Test package 1',
                weight: '2.5 lbs',
                value: '$50.00',
                externalId: 'BULK-TEST-001',
            },
            {
                customerName: 'Jane Smith',
                customerEmail: 'jane.smith@example.com',
                originAddress: {
                    name: 'Beta Corp',
                    addressLine1: '789 Office Blvd',
                    city: 'Chicago',
                    state: 'IL',
                    postalCode: '60601',
                    country: 'US',
                },
                destinationAddress: {
                    name: 'Jane Smith',
                    addressLine1: '321 Residential St',
                    city: 'Miami',
                    state: 'FL',
                    postalCode: '33101',
                    country: 'US',
                },
                packageDescription: 'Test package 2',
                weight: '1.0 lbs',
                value: '$25.00',
                externalId: 'BULK-TEST-002',
            }
        ],
        source: 'test-bulk-api'
    };

    try {
        console.log('🧪 Testing bulk-ingest endpoint...');
        
        const response = await fetch(`${baseUrl}/api/shipments/bulk-ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-api-key-123',
                'x-api-source': 'test-system',
            },
            body: JSON.stringify(testData),
        });

        const result = await response.json();
        
        console.log('📊 Response Status:', response.status);
        console.log('📋 Response Headers:');
        console.log('  Rate Limit:', response.headers.get('X-Bulk-RateLimit-Limit'));
        console.log('  Remaining:', response.headers.get('X-Bulk-RateLimit-Remaining'));
        console.log('  Reset:', response.headers.get('X-Bulk-RateLimit-Reset'));
        
        console.log('📦 Response Body:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('✅ Bulk ingestion test completed successfully!');
        } else {
            console.log('❌ Bulk ingestion test failed');
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
};

// Test GET endpoint info
const testBulkIngestInfo = async () => {
    const baseUrl = 'http://localhost:3000';
    
    try {
        console.log('\n🔍 Testing bulk-ingest info endpoint...');
        
        const response = await fetch(`${baseUrl}/api/shipments/bulk-ingest`, {
            method: 'GET',
            headers: {
                'x-api-key': 'test-api-key-123',
                'x-api-source': 'test-system',
            },
        });

        const result = await response.json();
        
        console.log('📊 Info Response Status:', response.status);
        console.log('📋 Info Response:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('✅ Bulk ingestion info test completed successfully!');
        } else {
            console.log('❌ Bulk ingestion info test failed');
        }

    } catch (error) {
        console.error('❌ Info test error:', error.message);
    }
};

// Run tests
const runTests = async () => {
    await testBulkIngestInfo();
    await testBulkIngest();
};

runTests().catch(console.error);