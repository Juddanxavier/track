/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq, or } from 'drizzle-orm';
import { trackingService } from '@/lib/trackingService';
import { createTrackingAdapter, getTrackingAdapterConfig } from '@/lib/trackingApiAdapter';
import { shipmentEventService } from '@/lib/shipmentEventService';
import {
    APIIntegrationError,
    ShipmentError,
    WebhookPayload,
    Shipment,
    ShipmentStatusType,
} from '@/types/shipment';

/**
 * POST /api/webhooks/shipment-tracking
 * 
 * Webhook endpoint for receiving real-time tracking updates from third-party providers
 * Supports ShipEngine and other tracking API providers
 */
export async function POST(request: NextRequest) {
    try {
        // Get the raw body for signature validation
        const body = await request.text();
        let payload: any;

        try {
            payload = JSON.parse(body);
        } catch (error) {
            console.error('Invalid JSON in webhook payload:', error);
            return NextResponse.json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        // Get signature from headers (different providers use different header names)
        const signature =
            request.headers.get('x-shipengine-signature') ||
            request.headers.get('x-signature') ||
            request.headers.get('signature') ||
            '';

        // Get the tracking adapter for validation
        const adapterConfig = getTrackingAdapterConfig();
        if (!adapterConfig) {
            console.error('No tracking API configuration found for webhook validation');
            return NextResponse.json(
                { error: 'Tracking API not configured' },
                { status: 503 }
            );
        }

        const adapter = createTrackingAdapter(adapterConfig.provider, adapterConfig.config);

        // Validate webhook signature
        const isValidSignature = adapter.validateWebhook(payload, signature);
        if (!isValidSignature) {
            console.error('Invalid webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Parse the webhook payload
        let webhookData: WebhookPayload;
        try {
            webhookData = adapter.parseWebhookPayload(payload);
        } catch (error) {
            console.error('Failed to parse webhook payload:', error);
            return NextResponse.json(
                { error: 'Invalid webhook payload format' },
                { status: 400 }
            );
        }

        // Find the shipment by API tracking ID or courier tracking number
        const shipmentResults = await db
            .select()
            .from(shipments)
            .where(
                or(
                    eq(shipments.apiTrackingId, webhookData.trackingId),
                    eq(shipments.courierTrackingNumber, webhookData.trackingId)
                )
            );

        if (shipmentResults.length === 0) {
            console.warn(`No shipment found for tracking ID: ${webhookData.trackingId}`);
            // Return 200 to acknowledge receipt even if we don't have the shipment
            // This prevents the webhook provider from retrying
            return NextResponse.json(
                { message: 'Webhook received but no matching shipment found' },
                { status: 200 }
            );
        }

        const shipmentRecord = shipmentResults[0];
        const shipment: Shipment = {
            ...shipmentRecord,
            status: shipmentRecord.status as ShipmentStatusType,
            apiProvider: shipmentRecord.apiProvider as any,
            originAddress: JSON.parse(shipmentRecord.originAddress),
            destinationAddress: JSON.parse(shipmentRecord.destinationAddress),
            dimensions: shipmentRecord.dimensions ? JSON.parse(shipmentRecord.dimensions) : null,
        };

        console.log(`Processing webhook for shipment ${shipment.id} (tracking: ${webhookData.trackingId})`);

        // Process the webhook events
        const processedEvents: string[] = [];
        const errors: string[] = [];

        for (const apiEvent of webhookData.events) {
            try {
                // Map API event to internal status
                const mappedStatus = mapApiEventToStatus(apiEvent.eventType, apiEvent.description);

                // Add the event to the shipment
                await shipmentEventService.addEvent({
                    shipmentId: shipment.id,
                    eventType: apiEvent.eventType as any,
                    status: mappedStatus,
                    description: apiEvent.description,
                    location: apiEvent.location,
                    source: 'webhook',
                    sourceId: adapter.getProviderName(),
                    eventTime: apiEvent.eventTime,
                    metadata: {
                        ...apiEvent.metadata,
                        webhookTimestamp: webhookData.timestamp,
                        originalEventType: apiEvent.eventType,
                    },
                });

                // Update shipment status if this event represents a status change
                if (mappedStatus && mappedStatus !== shipment.status) {
                    try {
                        // Import shipmentService dynamically to avoid circular imports
                        const { shipmentService } = await import('@/lib/shipmentService');

                        await shipmentService.updateStatus(
                            shipment.id,
                            mappedStatus,
                            'webhook',
                            adapter.getProviderName(),
                            `Status updated via webhook: ${apiEvent.description}`,
                            apiEvent.eventTime
                        );

                        // Update API sync timestamp
                        await db
                            .update(shipments)
                            .set({
                                lastApiSync: new Date(),
                                updatedAt: new Date(),
                            })
                            .where(eq(shipments.id, shipment.id));

                        console.log(`Updated shipment ${shipment.id} status from ${shipment.status} to ${mappedStatus}`);
                    } catch (statusError) {
                        console.warn(`Could not update status for shipment ${shipment.id}:`, statusError);
                        errors.push(`Status update failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`);
                    }
                }

                processedEvents.push(`${apiEvent.eventType}: ${apiEvent.description}`);
            } catch (eventError) {
                console.error(`Failed to process event for shipment ${shipment.id}:`, eventError);
                errors.push(`Event processing failed: ${eventError instanceof Error ? eventError.message : String(eventError)}`);
            }
        }

        // Log webhook processing result
        await shipmentEventService.addEvent({
            shipmentId: shipment.id,
            eventType: 'location_update',
            description: `Webhook processed: ${processedEvents.length} events processed${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
            source: 'webhook',
            sourceId: adapter.getProviderName(),
            eventTime: new Date(),
            metadata: {
                processedEvents,
                errors,
                webhookTimestamp: webhookData.timestamp,
                provider: adapter.getProviderName(),
            },
        });

        console.log(`Webhook processing completed for shipment ${shipment.id}: ${processedEvents.length} events, ${errors.length} errors`);

        return NextResponse.json({
            message: 'Webhook processed successfully',
            shipmentId: shipment.id,
            processedEvents: processedEvents.length,
            errors: errors.length,
        });

    } catch (error) {
        console.error('Webhook processing error:', error);

        // Log the error but still return 200 to prevent retries for permanent failures
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (error instanceof APIIntegrationError || error instanceof ShipmentError) {
            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error processing webhook' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/webhooks/shipment-tracking
 * 
 * Health check endpoint for webhook configuration
 */
export async function GET() {
    try {
        const adapterConfig = getTrackingAdapterConfig();

        return NextResponse.json({
            message: 'Shipment tracking webhook endpoint is active',
            provider: adapterConfig?.provider || 'none',
            configured: !!adapterConfig,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Webhook configuration error',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

/**
 * Map API event type and description to internal shipment status
 */
function mapApiEventToStatus(eventType: string, description: string): ShipmentStatusType | undefined {
    const normalizedEventType = eventType.toLowerCase();
    const normalizedDescription = description.toLowerCase();

    // Direct event type mapping
    switch (normalizedEventType) {
        case 'pickup':
        case 'picked_up':
        case 'collected':
            return 'in-transit';

        case 'in_transit':
        case 'in-transit':
        case 'transit':
            return 'in-transit';

        case 'out_for_delivery':
        case 'out-for-delivery':
        case 'loaded_for_delivery':
            return 'out-for-delivery';

        case 'delivered':
        case 'delivery':
            return 'delivered';

        case 'exception':
        case 'delay':
        case 'hold':
            return 'exception';

        case 'cancelled':
        case 'canceled':
        case 'returned':
            return 'cancelled';
    }

    // Description-based mapping as fallback
    if (normalizedDescription.includes('delivered') || normalizedDescription.includes('signed for')) {
        return 'delivered';
    }

    if (normalizedDescription.includes('out for delivery') ||
        normalizedDescription.includes('loaded for delivery') ||
        normalizedDescription.includes('on vehicle for delivery')) {
        return 'out-for-delivery';
    }

    if (normalizedDescription.includes('in transit') ||
        normalizedDescription.includes('departed') ||
        normalizedDescription.includes('arrived at') ||
        normalizedDescription.includes('picked up')) {
        return 'in-transit';
    }

    if (normalizedDescription.includes('exception') ||
        normalizedDescription.includes('delay') ||
        normalizedDescription.includes('hold') ||
        normalizedDescription.includes('failed delivery') ||
        normalizedDescription.includes('delivery attempt')) {
        return 'exception';
    }

    if (normalizedDescription.includes('cancelled') ||
        normalizedDescription.includes('returned to sender') ||
        normalizedDescription.includes('refused')) {
        return 'cancelled';
    }

    // No status change for other events (location updates, etc.)
    return undefined;
}

/**
 * Validate webhook request headers and payload structure
 */
function validateWebhookRequest(request: NextRequest, payload: any): {
    isValid: boolean;
    error?: string;
} {
    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return {
            isValid: false,
            error: 'Invalid content type. Expected application/json',
        };
    }

    // Basic payload structure validation
    if (!payload || typeof payload !== 'object') {
        return {
            isValid: false,
            error: 'Invalid payload structure',
        };
    }

    return { isValid: true };
}

/**
 * Rate limiting for webhook endpoints
 */
const webhookRateLimit = new Map<string, { count: number; resetTime: number }>();
const WEBHOOK_RATE_LIMIT = 100; // requests per minute
const WEBHOOK_RATE_WINDOW = 60 * 1000; // 1 minute

function checkWebhookRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientLimit = webhookRateLimit.get(clientId);

    if (!clientLimit || now > clientLimit.resetTime) {
        webhookRateLimit.set(clientId, {
            count: 1,
            resetTime: now + WEBHOOK_RATE_WINDOW,
        });
        return true;
    }

    if (clientLimit.count >= WEBHOOK_RATE_LIMIT) {
        return false;
    }

    clientLimit.count++;
    return true;
}