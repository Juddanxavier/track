/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ThirdPartyAPIService } from '@/lib/third-party-api-service';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import { CarrierType } from '@/types/shipment';
import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/shipments/[id]/sync
 * 
 * Manually trigger sync for a specific shipment
 * Calls appropriate carrier API based on shipment carrier
 * Updates shipment details and tracking events
 * Handles API errors and updates sync status
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        const shipmentId = params.id;

        // Get the shipment
        const shipment = await shipmentService.getById(shipmentId);
        if (!shipment) {
            return NextResponse.json(
                { error: 'Shipment not found' },
                { status: 404 }
            );
        }

        // Check if shipment has required data for sync
        if (!shipment.carrierTrackingNumber || !shipment.carrier) {
            return NextResponse.json(
                {
                    error: 'Shipment missing required data for sync',
                    details: 'Both carrier and carrierTrackingNumber are required'
                },
                { status: 400 }
            );
        }

        console.log(`Manual sync triggered for shipment ${shipmentId} by user ${session.user.id}`);

        const apiService = new ThirdPartyAPIService();
        const now = new Date();

        try {
            // Call appropriate carrier API based on shipment carrier
            const trackingUpdates = await apiService.getTrackingUpdates(
                shipment.carrierTrackingNumber,
                shipment.carrier as CarrierType
            );

            // Update shipment sync status directly in database
            await db
                .update(shipments)
                .set({
                    lastApiSync: now,
                    apiSyncStatus: 'success',
                    apiError: null,
                    needsReview: false,
                    updatedAt: now,
                })
                .where(eq(shipments.id, shipmentId));

            // Process and add new tracking events
            let eventsAdded = 0;
            if (trackingUpdates && trackingUpdates.length > 0) {
                // Get existing events to avoid duplicates
                const existingEventsResponse = await shipmentEventService.getShipmentEvents(shipmentId, {
                    perPage: 1000, // Get all events to check for duplicates
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
                        shipmentId,
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
                                shipmentId,
                                latestEvent.status,
                                'api_sync',
                                session.user.id,
                                `Status updated from ${shipment.carrier} API sync`,
                                latestEvent.eventTime
                            );
                        } catch (statusError) {
                            console.warn(`Could not update status for shipment ${shipmentId}:`, statusError);
                            // Don't fail the sync if status update fails
                        }
                    }
                }
            }

            // Add sync success event
            await shipmentEventService.addEvent({
                shipmentId,
                eventType: 'api_sync',
                description: `Manual sync completed successfully. ${eventsAdded} new events added.`,
                source: 'api_sync',
                sourceId: session.user.id,
                eventTime: now,
                metadata: {
                    eventsAdded,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    triggeredBy: session.user.id,
                },
            });

            console.log(`Sync completed for shipment ${shipmentId}: ${eventsAdded} new events added`);

            return NextResponse.json({
                message: 'Shipment sync completed successfully',
                result: {
                    shipmentId,
                    eventsAdded,
                    lastSync: now.toISOString(),
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    triggeredBy: session.user.id,
                },
            });

        } catch (apiError) {
            console.error(`API sync failed for shipment ${shipmentId}:`, apiError);

            // Update shipment with error status directly in database
            await db
                .update(shipments)
                .set({
                    lastApiSync: now,
                    apiSyncStatus: 'failed',
                    apiError: apiError instanceof Error ? apiError.message : 'Unknown API error',
                    needsReview: true,
                    updatedAt: now,
                })
                .where(eq(shipments.id, shipmentId));

            // Add sync failure event
            await shipmentEventService.addEvent({
                shipmentId,
                eventType: 'api_sync',
                description: `Manual sync failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
                source: 'api_sync',
                sourceId: session.user.id,
                eventTime: now,
                metadata: {
                    error: apiError instanceof Error ? apiError.message : String(apiError),
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                    triggeredBy: session.user.id,
                },
            });

            return NextResponse.json(
                {
                    error: 'Sync failed',
                    details: apiError instanceof Error ? apiError.message : 'Unknown API error',
                    shipmentId,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.carrierTrackingNumber,
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error(`Manual sync error for shipment ${params.id}:`, error);

        return NextResponse.json(
            {
                error: 'Failed to sync shipment',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}