/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import type { PublicShipmentInfo, PublicShipmentEvent } from '@/types/shipment';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
    // Use IP address for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
    return `tracking:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const limit = rateLimitMap.get(key);

    if (!limit || now > limit.resetTime) {
        // Reset or create new limit
        rateLimitMap.set(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW,
        });
        return { allowed: true };
    }

    if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return { allowed: false, resetTime: limit.resetTime };
    }

    // Increment count
    limit.count++;
    return { allowed: true };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ trackingCode: string }> }
) {
    try {
        const { trackingCode } = await params;

        // Rate limiting
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            const resetTime = rateLimit.resetTime || Date.now() + RATE_LIMIT_WINDOW;
            const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please try again later.',
                    retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': resetTime.toString(),
                    },
                }
            );
        }

        // Validate tracking code format
        if (!trackingCode || typeof trackingCode !== 'string') {
            return NextResponse.json(
                {
                    error: 'Invalid tracking code',
                    message: 'Please provide a valid tracking code.',
                },
                { status: 400 }
            );
        }

        // Get shipment by tracking code
        const shipment = await shipmentService.getByTrackingCode(trackingCode);

        if (!shipment) {
            return NextResponse.json(
                {
                    error: 'Tracking code not found',
                    message: 'The tracking code you entered was not found in our system.',
                },
                { status: 404 }
            );
        }

        // Get shipment events
        const eventsResult = await shipmentEventService.getShipmentEvents(shipment.id);
        const events = eventsResult.events;

        // Create sanitized public tracking info (remove internal system details)
        const publicEvents: PublicShipmentEvent[] = events.map(event => ({
            eventType: event.eventType,
            description: event.description,
            location: event.location || undefined,
            eventTime: event.eventTime,
        }));

        // Determine if user can sign up (no assigned user and has customer email)
        const canSignup = shipment.userAssignmentStatus === 'unassigned' &&
            !!shipment.customerEmail &&
            !shipment.assignedUserId;

        // Prepare pre-filled signup data if signup is available
        const signupPrefilledData = canSignup ? {
            name: shipment.customerName,
            email: shipment.customerEmail,
        } : undefined;

        const publicTrackingInfo: PublicShipmentInfo = {
            trackingCode: shipment.trackingCode,
            status: shipment.status,
            estimatedDelivery: shipment.estimatedDelivery || undefined,
            events: publicEvents,
            canSignup,
            signupPrefilledData,
        };

        // Set rate limit headers for successful requests
        const currentLimit = rateLimitMap.get(rateLimitKey);
        const remaining = currentLimit ? Math.max(0, RATE_LIMIT_MAX_REQUESTS - currentLimit.count) : RATE_LIMIT_MAX_REQUESTS - 1;

        return NextResponse.json(
            {
                success: true,
                data: publicTrackingInfo,
            },
            {
                headers: {
                    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': (currentLimit?.resetTime || Date.now() + RATE_LIMIT_WINDOW).toString(),
                    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
                },
            }
        );
    } catch (error) {
        console.error('Error in public tracking endpoint:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: 'An error occurred while retrieving tracking information. Please try again later.',
            },
            { status: 500 }
        );
    }
}