/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { ThirdPartyAPIService } from '@/lib/third-party-api-service';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { CarrierType, ShipmentStatusType } from '@/types/shipment';
import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq, and, inArray, isNotNull, lt, or, isNull } from 'drizzle-orm';

/**
 * POST /api/cron/sync-tracking
 * 
 * Periodic sync job for active shipments
 * - Implements exponential backoff for failed syncs
 * - Stops syncing delivered shipments
 * - Logs sync results and errors
 * - Designed to be called by cron jobs or schedulers
 */
export async function POST(request: NextRequest) {
    try {
        // Verify this is a legitimate cron request
        // In production, you might want to verify a secret token or IP whitelist
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            console.warn('Unauthorized cron sync attempt');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('Starting periodic sync job for active shipments');

        const now = new Date();
        const apiService = new ThirdPartyAPIService();

        // Get active shipments that need syncing
        // - Not delivered or cancelled
        // - Have tracking number and carrier
        // - Either never synced OR last sync was more than 1 hour ago OR failed sync with backoff period expired
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const activeStatuses: ShipmentStatusType[] = ['pending', 'in-transit', 'out-for-delivery', 'exception'];

        const shipmentsToSync = await db
            .select()
            .from(shipments)
            .where(
                and(
                    inArray(shipments.status, activeStatuses),
                    isNotNull(shipments.carrierTrackingNumber),
                    isNotNull(shipments.carrier),
                    or(
                        // Never synced
                        isNull(shipments.lastApiSync),
                        // Last successful sync was more than 1 hour ago
                        and(
                            lt(shipments.lastApiSync, oneHourAgo),
                            eq(shipments.apiSyncStatus, 'success')
                        ),
                        // Failed sync with backoff period expired
                        and(
                            eq(shipments.apiSyncStatus, 'failed'),
                            lt(shipments.lastApiSync, getBackoffTime(now))
                        )
                    )
                )
            );

        if (shipmentsToSync.length === 0) {
            console.log('No shipments need syncing at this time');
            return NextResponse.json({
                message: 'No shipments need syncing',
                result: {
                    totalShipments: 0,
                    successful: 0,
                    failed: 0,
                    skipped: 0,
                    results: [],
                    completedAt: now.toISOString(),
                },
            });
        }

        console.log(`Found ${shipmentsToSync.length} shipments that need syncing`);

        const syncResults = [];
        let successful = 0;
        let failed = 0;
        let skipped = 0;

        // Process shipments with rate limiting and exponential backoff
        for (let i = 0; i < shipmentsToSync.length; i++) {
            const shipment = shipmentsToSync[i];
            const syncTime = new Date();

            try {
                console.log(`Syncing shipment ${i + 1}/${shipmentsToSync.length}: ${shipment.id}`);

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

                // Check if this shipment should be skipped due to exponential backoff
                if (shipment.apiSyncStatus === 'failed' && shipment.lastApiSync) {
                    const backoffTime = getBackoffTime(now, shipment.lastApiSync);
                    if (shipment.lastApiSync > backoffTime) {
                        console.log(`Skipping shipment ${shipment.id}: still in backoff period`);
                        skipped++;
                        syncResults.push({
                            shipmentId: shipment.id,
                            success: false,
                            error: 'Still in exponential backoff period',
                            skipped: true,
                            carrier: shipment.carrier,
                            trackingNumber: shipment.carrierTrackingNumber,
                            nextRetryAfter: getNextRetryTime(shipment.lastApiSync).toISOString(),
                        });
                        continue;
                    }
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
                        lastApiSync: syncTime,
                        apiSyncStatus: 'success',
                        apiError: null,
                        needsReview: false,
                        updatedAt: syncTime,
                    })
                    .where(eq(shipments.id, shipment.id));

                // Process and add new tracking events
                let eventsAdded = 0;
                let statusUpdated = false;

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
                            sourceId: 'cron-job',
                            eventTime: event.eventTime,
                            metadata: {
                                ...event.metadata,
                                cronSync: true,
                            },
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
                                    'cron-job',
                                    `Status updated from ${shipment.carrier} API periodic sync`,
                                    latestEvent.eventTime
                                );
                                statusUpdated = true;

                                // If shipment is now delivered, stop future syncing
                                if (latestEvent.status === 'delivered') {
                                    console.log(`Shipment ${shipment.id} delivered - will stop periodic syncing`);
                                }
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
                    description: `Periodic sync completed successfully. ${eventsAdded} new events added.${statusUpdated ? ' Status updated.' : ''}`,
                    source: 'api_sync',
                    sourceId: 'cron-job',
                    eventTime: syncTime,
                    metadata: {
                        eventsAdded,
                        statusUpdated,
                        carrier: shipment.carrier,
                        trackingNumber: shipment.carrierTrackingNumber,
                        cronSync: true,
                        periodicSync: true,
                    },
                });

                successful++;
                syncResults.push({
                    shipmentId: shipment.id,
                    success: true,
                    eventsAdded,
                    statusUpdated,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    lastSync: syncTime.toISOString(),
                });

                console.log(`Periodic sync completed for shipment ${shipment.id}: ${eventsAdded} new events added${statusUpdated ? ', status updated' : ''}`);

            } catch (apiError) {
                console.error(`Periodic sync failed for shipment ${shipment.id}:`, apiError);

                // Update shipment with error status and implement exponential backoff
                const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';

                await db
                    .update(shipments)
                    .set({
                        lastApiSync: syncTime,
                        apiSyncStatus: 'failed',
                        apiError: errorMessage,
                        needsReview: true,
                        updatedAt: syncTime,
                    })
                    .where(eq(shipments.id, shipment.id));

                // Add sync failure event
                await shipmentEventService.addEvent({
                    shipmentId: shipment.id,
                    eventType: 'api_sync',
                    description: `Periodic sync failed: ${errorMessage}`,
                    source: 'api_sync',
                    sourceId: 'cron-job',
                    eventTime: syncTime,
                    metadata: {
                        error: errorMessage,
                        carrier: shipment.carrier,
                        trackingNumber: shipment.carrierTrackingNumber,
                        cronSync: true,
                        periodicSync: true,
                        nextRetryAfter: getNextRetryTime(syncTime).toISOString(),
                    },
                });

                failed++;
                syncResults.push({
                    shipmentId: shipment.id,
                    success: false,
                    error: errorMessage,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    nextRetryAfter: getNextRetryTime(syncTime).toISOString(),
                });
            }

            // Rate limiting: Add delay between API calls to respect carrier limits
            if (i < shipmentsToSync.length - 1) {
                const delay = getCarrierDelay(shipment.carrier as CarrierType);
                if (delay > 0) {
                    console.log(`Rate limiting: waiting ${delay}ms before next API call`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        const totalProcessed = successful + failed + skipped;
        const completedAt = new Date();

        console.log(`Periodic sync job completed: ${successful} successful, ${failed} failed, ${skipped} skipped out of ${totalProcessed} total`);

        return NextResponse.json({
            message: `Periodic sync completed. ${successful} successful, ${failed} failed, ${skipped} skipped.`,
            result: {
                totalShipments: shipmentsToSync.length,
                successful,
                failed,
                skipped,
                results: syncResults,
                startedAt: now.toISOString(),
                completedAt: completedAt.toISOString(),
                duration: completedAt.getTime() - now.getTime(),
            },
        });

    } catch (error) {
        console.error('Periodic sync job error:', error);

        return NextResponse.json(
            {
                error: 'Failed to perform periodic sync',
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
    // Rate limiting delays in milliseconds for cron jobs (more conservative)
    const delays: Record<CarrierType, number> = {
        ups: 2000,    // 2 seconds between UPS API calls
        fedex: 3000,  // 3 seconds between FedEx API calls
        dhl: 4000,    // 4 seconds between DHL API calls
        usps: 1000,   // 1 second between USPS API calls
    };

    return delays[carrier] || 2000; // Default 2 second delay
}

/**
 * Calculate the backoff time for failed syncs using exponential backoff
 * First retry: 5 minutes
 * Second retry: 15 minutes
 * Third retry: 45 minutes
 * Fourth retry: 2 hours
 * Fifth+ retry: 6 hours
 */
function getBackoffTime(currentTime: Date, lastFailTime?: Date): Date {
    if (!lastFailTime) {
        return new Date(currentTime.getTime() - 5 * 60 * 1000); // 5 minutes ago
    }

    // Calculate how many times this has failed by looking at the time since last failure
    const timeSinceFailure = currentTime.getTime() - lastFailTime.getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const fifteenMinutes = 15 * 60 * 1000;
    const fortyFiveMinutes = 45 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000;
    const sixHours = 6 * 60 * 60 * 1000;

    // Determine backoff period based on how long it's been failing
    let backoffPeriod: number;
    if (timeSinceFailure < fiveMinutes) {
        backoffPeriod = fiveMinutes;
    } else if (timeSinceFailure < fifteenMinutes) {
        backoffPeriod = fifteenMinutes;
    } else if (timeSinceFailure < fortyFiveMinutes) {
        backoffPeriod = fortyFiveMinutes;
    } else if (timeSinceFailure < twoHours) {
        backoffPeriod = twoHours;
    } else {
        backoffPeriod = sixHours;
    }

    return new Date(currentTime.getTime() - backoffPeriod);
}

/**
 * Get the next retry time for a failed sync
 */
function getNextRetryTime(lastFailTime: Date): Date {
    const now = new Date();
    const timeSinceFailure = now.getTime() - lastFailTime.getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const fifteenMinutes = 15 * 60 * 1000;
    const fortyFiveMinutes = 45 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000;
    const sixHours = 6 * 60 * 60 * 1000;

    // Determine next retry time based on exponential backoff
    if (timeSinceFailure < fiveMinutes) {
        return new Date(lastFailTime.getTime() + fiveMinutes);
    } else if (timeSinceFailure < fifteenMinutes) {
        return new Date(lastFailTime.getTime() + fifteenMinutes);
    } else if (timeSinceFailure < fortyFiveMinutes) {
        return new Date(lastFailTime.getTime() + fortyFiveMinutes);
    } else if (timeSinceFailure < twoHours) {
        return new Date(lastFailTime.getTime() + twoHours);
    } else {
        return new Date(lastFailTime.getTime() + sixHours);
    }
}