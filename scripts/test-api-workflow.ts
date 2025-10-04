/** @format */

/**
 * API-based test script for lead-to-shipment-to-delivery workflow
 * This script tests the complete functionality through API endpoints
 */

interface TestResult {
    step: string;
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

class APIWorkflowTester {
    private results: TestResult[] = [];
    private baseUrl = 'http://localhost:3000';
    private testLeadId: string = '';
    private testShipmentId: string = '';
    private testTrackingCode: string = '';

    private log(step: string, success: boolean, message: string, data?: any, error?: string) {
        const result: TestResult = { step, success, message, data, error };
        this.results.push(result);

        const status = success ? '✅' : '❌';
        console.log(`${status} ${step}: ${message}`);
        if (error) {
            console.error(`   Error: ${error}`);
        }
        if (data && success) {
            console.log(`   Data:`, JSON.stringify(data, null, 2));
        }
    }

    async runAPIWorkflowTest(): Promise<TestResult[]> {
        console.log('🚀 Starting API-based lead-to-shipment-to-delivery workflow test...\n');

        try {
            // Step 1: Test shipment creation API
            await this.testShipmentCreationAPI();

            // Step 2: Test shipment retrieval API
            await this.testShipmentRetrievalAPI();

            // Step 3: Test shipment status update API
            await this.testShipmentStatusUpdateAPI();

            // Step 4: Test shipments list API
            await this.testShipmentsListAPI();

            // Step 5: Test public tracking API
            await this.testPublicTrackingAPI();

            // Step 6: Test shipment stats API
            await this.testShipmentStatsAPI();

        } catch (error) {
            this.log('FATAL_ERROR', false, 'Test execution failed', null, error instanceof Error ? error.message : String(error));
        }

        // Print summary
        this.printSummary();
        return this.results;
    }

    private async testShipmentCreationAPI() {
        try {
            const shipmentData = {
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                customerPhone: '+1234567890',
                packageDescription: 'Test Package',
                weight: '5kg',
                originAddress: {
                    name: 'Test Sender',
                    addressLine1: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    postalCode: '10001',
                    country: 'United States',
                },
                destinationAddress: {
                    name: 'John Doe',
                    addressLine1: '456 Oak Ave',
                    city: 'Toronto',
                    state: 'ON',
                    postalCode: 'M5V 3A8',
                    country: 'Canada',
                },
                courier: 'FedEx',
                courierTrackingNumber: 'FDX123456789',
                estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };

            const response = await fetch(`${this.baseUrl}/api/shipments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shipmentData),
            });

            if (response.ok) {
                const result = await response.json();
                this.testShipmentId = result.shipment.id;
                this.testTrackingCode = result.shipment.trackingCode;

                this.log('SHIPMENT_CREATION_API', true, 'Shipment created via API successfully', {
                    shipmentId: this.testShipmentId,
                    trackingCode: this.testTrackingCode,
                    status: result.shipment.status
                });
            } else {
                const error = await response.text();
                throw new Error(`API returned ${response.status}: ${error}`);
            }
        } catch (error) {
            this.log('SHIPMENT_CREATION_API', false, 'Failed to create shipment via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testShipmentRetrievalAPI() {
        if (!this.testShipmentId) {
            this.log('SHIPMENT_RETRIEVAL_API', false, 'Skipped - no shipment ID available');
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/shipments/${this.testShipmentId}`);

            if (response.ok) {
                const shipment = await response.json();

                if (shipment.id === this.testShipmentId && shipment.trackingCode === this.testTrackingCode) {
                    this.log('SHIPMENT_RETRIEVAL_API', true, 'Shipment retrieved via API successfully', {
                        shipmentId: shipment.id,
                        trackingCode: shipment.trackingCode,
                        eventsCount: shipment.events?.length || 0
                    });
                } else {
                    throw new Error('Retrieved shipment data does not match expected values');
                }
            } else {
                const error = await response.text();
                throw new Error(`API returned ${response.status}: ${error}`);
            }
        } catch (error) {
            this.log('SHIPMENT_RETRIEVAL_API', false, 'Failed to retrieve shipment via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testShipmentStatusUpdateAPI() {
        if (!this.testShipmentId) {
            this.log('SHIPMENT_STATUS_UPDATE_API', false, 'Skipped - no shipment ID available');
            return;
        }

        try {
            const statusUpdates = [
                { status: 'in-transit', notes: 'Package picked up by courier' },
                { status: 'out-for-delivery', notes: 'Package out for delivery' },
                { status: 'delivered', notes: 'Package delivered successfully' }
            ];

            for (const update of statusUpdates) {
                const response = await fetch(`${this.baseUrl}/api/shipments/${this.testShipmentId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(update),
                });

                if (response.ok) {
                    const result = await response.json();
                    this.log('SHIPMENT_STATUS_UPDATE_API', true, `Status updated to ${update.status} via API`, {
                        status: update.status,
                        notes: update.notes
                    });
                } else {
                    const error = await response.text();
                    throw new Error(`Status update failed: ${response.status}: ${error}`);
                }

                // Add small delay between updates
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            this.log('SHIPMENT_STATUS_UPDATE_API', false, 'Failed to update shipment status via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testShipmentsListAPI() {
        try {
            const response = await fetch(`${this.baseUrl}/api/shipments?page=1&perPage=10`);

            if (response.ok) {
                const result = await response.json();

                if (result.shipments && Array.isArray(result.shipments) && result.pagination) {
                    this.log('SHIPMENTS_LIST_API', true, 'Shipments list retrieved via API successfully', {
                        totalShipments: result.pagination.total,
                        currentPage: result.pagination.page,
                        shipmentsInPage: result.shipments.length
                    });
                } else {
                    throw new Error('Invalid shipments list response format');
                }
            } else {
                const error = await response.text();
                throw new Error(`API returned ${response.status}: ${error}`);
            }
        } catch (error) {
            this.log('SHIPMENTS_LIST_API', false, 'Failed to retrieve shipments list via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testPublicTrackingAPI() {
        if (!this.testTrackingCode) {
            this.log('PUBLIC_TRACKING_API', false, 'Skipped - no tracking code available');
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/tracking/${this.testTrackingCode}`);

            if (response.ok) {
                const trackingInfo = await response.json();

                if (trackingInfo.trackingCode === this.testTrackingCode) {
                    this.log('PUBLIC_TRACKING_API', true, 'Public tracking information retrieved via API successfully', {
                        trackingCode: trackingInfo.trackingCode,
                        status: trackingInfo.status,
                        eventsCount: trackingInfo.events?.length || 0
                    });
                } else {
                    throw new Error('Retrieved tracking data does not match expected tracking code');
                }
            } else {
                const error = await response.text();
                throw new Error(`API returned ${response.status}: ${error}`);
            }
        } catch (error) {
            this.log('PUBLIC_TRACKING_API', false, 'Failed to retrieve public tracking information via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private async testShipmentStatsAPI() {
        try {
            const response = await fetch(`${this.baseUrl}/api/shipments/stats`);

            if (response.ok) {
                const stats = await response.json();

                if (typeof stats.total === 'number' && typeof stats.pending === 'number') {
                    this.log('SHIPMENT_STATS_API', true, 'Shipment statistics retrieved via API successfully', {
                        total: stats.total,
                        pending: stats.pending,
                        inTransit: stats.inTransit,
                        delivered: stats.delivered,
                        exception: stats.exception,
                        recentCount: stats.recentCount
                    });
                } else {
                    throw new Error('Invalid shipment stats response format');
                }
            } else {
                const error = await response.text();
                throw new Error(`API returned ${response.status}: ${error}`);
            }
        } catch (error) {
            this.log('SHIPMENT_STATS_API', false, 'Failed to retrieve shipment statistics via API', null, error instanceof Error ? error.message : String(error));
        }
    }

    private printSummary() {
        console.log('\n📊 API Test Summary:');
        console.log('====================');

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log(`Total API Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed API Tests:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.step}: ${r.message}`));
        }

        console.log('\n🎯 API Workflow Test Complete!');
        console.log('\n📝 Note: These tests require the application to be running on localhost:3000');
        console.log('   and proper authentication. Some tests may fail due to authentication requirements.');
    }
}

// Main execution
async function main() {
    const tester = new APIWorkflowTester();
    const results = await tester.runAPIWorkflowTest();

    // Exit with appropriate code
    const hasFailures = results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { APIWorkflowTester };