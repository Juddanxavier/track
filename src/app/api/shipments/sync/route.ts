/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ThirdPartyAPIService } from '@/lib/third-party-api-service';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { CarrierType, ShipmentStatusType } from '@/types/shipment';
import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';

/**
 * POST /api/shipments/sync
 * 
 * Bulk sync for all active shipments
 * - Syncs all shipments that are not delivered or cancelled
 * - Respects carrier API rate limits with delays
 * - Provides progress tracking and error reporting
 * - Updates sync status for each shipment
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await auth.api.getSession({
            headers: request.headers,
        });
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is admin
        if (session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        console.log(`Bulk sync triggered by user ${session.user.id}`);

        // Get all active shipments (not delivered or cancelled)
        const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery', 'exception'];

        const activeShipments = await db
            .select()
            .from(shipments)
            .where(
                and(
                    inArray(shipments.status, activeStatuses),
                    isNotNull(shipments.carrierTrackingNumber),
                    isNotNull(shipments.carrier)
                )
            );

        if (activeShipments.length === 0) {
            return NextResponse.json({
                message: 'No active shipments found to sync',
                result: {
                    totalShipments: 0,
                    successful: 0,
                    failed: 0,
                    skipped: 0,
                    results: [],
                    triggeredBy: session.user.id,
                },
            });
        }

        console.log(`Found ${activeShipments.length} active shipments to sync`);

        const apiService = new ThirdPartyAPIService();
        const syncResults = [];
        let successful = 0;
        let failed = 0;
        let skipped = 0;

        // Process shipments with rate limiting
        for (let i = 0; i < activeShipments.length; i++) {
            const shipment = activeShipments[i];
            const now = new Date();

            try {
                console.log(`Syncing shipment ${i + 1}/${activeShipments.length}: ${shipment.id}`);

                // Skip if missing required data
                if (!shipment.carrierTrackingNumber || !shipment.carrier) {
                    console.warn(`Skipping shipment ${shipment.id}: missing tracking number or carrier`);
                    skipped++;
                    syncResults.push({
                        shipmentId: shipment.id,
                        success: false,
                        error: 'Missing required data for sync',
                        skipped: true,
                        carrier: shipment.carrier,
                        trackingNumber: shipment.carrierTrackingNumber,
                    });
                    continue;
                }

                // Call appropriate carrier API
                const trackingUpdates = await apiService.getTrackingUpdates(
                    shipment.carrierTrackingNumber,
                    shipment.carrier as CarrierType
                );

                // Update shipment sync status
                await db
                    .update(shipments)
                    .set({
                        lastApiSync: now,
                        apiSyncStatus: 'success',
                        apiError: null,
                        needsReview: false,
                        updatedAt: now,
                    })
                    .where(eq(shipments.id, shipment.id));

                // Process and add new tracking events
                let eventsAdded = 0;
                if (trackingUpdates && trackingUpdates.length > 0) {
                    // Get existing events to avoid duplicates
                    const existingEventsResponse = await shipmentEventService.getShipmentEvents(shipment.id, {
                        perPage: 1000,
                        filters: { source: ['api_sync'] }
                    });
                    const existingEventTimes = new Set(
                        existingEventsResponse.events
                            .filter(e => e.source === 'api_sync')
                            .map(e => e.eventTime.getTime())
                    );

                    // Filter out events we've already processed
                    const newEvents = trackingUpdates.filter(
                        event => !existingEventTimes.has(event.eventTime.getTime())
                    );

                    // Sort events by time (oldest first)
                    newEvents.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());

                    // Add new events
                    for (const event of newEvents) {
                        await shipmentEventService.addEvent({
                            shipmentId: shipment.id,
                            eventType: event.eventType,
                            status: event.status,
                            description: event.description,
                            location: event.location,
                            source: 'api_sync',
                            sourceId: session.user.id,
                            eventTime: event.eventTime,
                            metadata: event.metadata,
                        });
                        eventsAdded++;
                    }

                    // Update shipment status if there's a newer status from API
                    if (newEvents.length > 0) {
                        const latestEvent = newEvents[newEvents.length - 1];
                        if (latestEvent.status && latestEvent.status !== shipment.status) {
                            try {
                                await shipmentService.updateStatus(
                                    shipment.id,
                                    latestEvent.status,
                                    'api_sync',
                                    session.user.id,
                                    `Status updated from ${shipment.carrier} API bulk sync`,
                                    latestEvent.eventTime
                                );
                            } catch (statusError) {
                                console.warn(`Could not update status for shipment ${shipment.id}:`, statusError);
                                // Don't fail the sync if status update fails
                            }
                        }
                    }
                }

                // Add sync success event
                await shipmentEventService.addEvent({
                    shipmentId: shipment.id,
                    eventType: 'api_sync',
                    description: `Bulk sync completed successfully. ${eventsAdded} new events added.`,
                    source: 'api_sync',
                    sourceId: session.user.id,
                    eventTime: now,
                    metadata: {
                        eventsAdded,
                        carrier: shipment.carrier,
                        trackingNumber: shipment.carrierTrackingNumber,
                        triggeredBy: session.user.id,
                        bulkSync: true,
                    },
                });

                successful++;
                syncResults.push({
                    shipmentId: shipment.id,
                    success: true,
                    eventsAdded,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    lastSync: now.toISOString(),
                });

                console.log(`Sync completed for shipment ${shipment.id}: ${eventsAdded} new events added`);

            } catch (apiError) {
                console.error(`API sync failed for shipment ${shipment.id}:`, apiError);

                // Update shipment with error status
                await db
                    .update(shipments)
                    .set({
                        lastApiSync: now,
                        apiSyncStatus: 'failed',
                        apiError: apiError instanceof Error ? apiError.message : 'Unknown API error',
                        needsReview: true,
                        updatedAt: now,
                    })
                    .where(eq(shipments.id, shipment.id));

                // Add sync failure event
                await shipmentEventService.addEvent({
                    shipmentId: shipment.id,
                    eventType: 'api_sync',
                    description: `Bulk sync failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
                    source: 'api_sync',
                    sourceId: session.user.id,
                    eventTime: now,
                    metadata: {
                        error: apiError instanceof Error ? apiError.message : String(apiError),
                        carrier: shipment.carrier,
                        trackingNumber: shipment.carrierTrackingNumber,
                        triggeredBy: session.user.id,
                        bulkSync: true,
                    },
                });

                failed++;
                syncResults.push({
                    shipmentId: shipment.id,
                    success: false,
                    error: apiError instanceof Error ? apiError.message : 'Unknown API error',
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                });
            }

            // Rate limiting: Add delay between API calls to respect carrier limits
            // Adjust delay based on carrier and API limits
            if (i < activeShipments.length - 1) {
                const delay = getCarrierDelay(shipment.carrier as CarrierType);
                if (delay > 0) {
                    console.log(`Rate limiting: waiting ${delay}ms before next API call`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        const totalProcessed = successful + failed + skipped;

        console.log(`Bulk sync completed: ${successful} successful, ${failed} failed, ${skipped} skipped out of ${totalProcessed} total`);

        return NextResponse.json({
            message: `Bulk sync completed. ${successful} successful, ${failed} failed, ${skipped} skipped.`,
            result: {
                totalShipments: activeShipments.length,
                successful,
                failed,
                skipped,
                results: syncResults,
                triggeredBy: session.user.id,
                completedAt: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error('Bulk sync error:', error);

        return NextResponse.json(
            {
                error: 'Failed to perform bulk sync',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

/**
 * Get appropriate delay between API calls based on carrier rate limits
 */
function getCarrierDelay(carrier: CarrierType): number {
    // Rate limiting delays in milliseconds
    // These should be adjusted based on actual carrier API limits
    const delays: Record<CarrierType, number> = {
        ups: 1000,    // 1 second between UPS API calls
        fedex: 1500,  // 1.5 seconds between FedEx API calls
        dhl: 2000,    // 2 seconds between DHL API calls
        usps: 500,    // 0.5 seconds between USPS API calls
    };

    return delays[carrier] || 1000; // Default 1 second delay
}