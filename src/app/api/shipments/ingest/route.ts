/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { apiIngestionService } from '@/lib/apiIngestionService';
import { APIShipmentDataSchema, type APIShipmentDataRequest } from '@/types/shipment';
import { z } from 'zod';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per API key
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// API authentication schema
const AuthHeaderSchema = z.object({
    'x-api-key': z.string().min(1, 'API key is required'),
    'x-api-source': z.string().min(1, 'API source identifier is required'),
});

/**
 * Validate API authentication
 */
function validateApiAuth(headers: Headers): { valid: boolean; apiKey?: string; source?: string; error?: string } {
    const authHeaders = {
        'x-api-key': headers.get('x-api-key'),
        'x-api-source': headers.get('x-api-source'),
    };

    const parsed = AuthHeaderSchema.safeParse(authHeaders);
    if (!parsed.success) {
        return {
            valid: false,
            error: 'Missing or invalid authentication headers. Required: x-api-key, x-api-source',
        };
    }

    // TODO: Implement proper API key validation against database
    // For now, accept any non-empty API key
    const { 'x-api-key': apiKey, 'x-api-source': source } = parsed.data;

    return {
        valid: true,
        apiKey,
        source,
    };
}

/**
 * Check rate limiting for API key
 */
function checkRateLimit(apiKey: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = `ingest:${apiKey}`;

    let rateLimitData = rateLimitMap.get(key);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        // Reset or initialize rate limit
        rateLimitData = {
            count: 0,
            resetTime: now + RATE_LIMIT_WINDOW,
        };
        rateLimitMap.set(key, rateLimitData);
    }

    if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: rateLimitData.resetTime,
        };
    }

    rateLimitData.count++;
    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - rateLimitData.count,
        resetTime: rateLimitData.resetTime,
    };
}

/**
 * POST /api/shipments/ingest - Ingest single shipment from API
 */
export async function POST(req: NextRequest) {
    try {
        // Validate API authentication
        const auth = validateApiAuth(req.headers);
        if (!auth.valid) {
            return NextResponse.json(
                {
                    error: 'Authentication failed',
                    details: auth.error
                },
                { status: 401 }
            );
        }

        // Check rate limiting
        const rateLimit = checkRateLimit(auth.apiKey!);
        if (!rateLimit.allowed) {
            const resetTimeSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    details: `Too many requests. Try again in ${resetTimeSeconds} seconds.`,
                    rateLimitReset: rateLimit.resetTime,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        // Parse request body
        const body = await req.json();

        // Validate shipment data payload
        const validation = APIShipmentDataSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    error: 'Invalid shipment data',
                    details: validation.error.issues.map(issue => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                {
                    status: 400,
                    headers: {
                        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        // Ingest shipment using the API ingestion service
        const shipment = await apiIngestionService.ingestFromAPI(validation.data, auth.source!);

        return NextResponse.json(
            {
                message: 'Shipment ingested successfully',
                shipment: {
                    id: shipment.id,
                    trackingCode: shipment.trackingCode,
                    customerName: shipment.customerName,
                    customerEmail: shipment.customerEmail,
                    status: shipment.status,
                    userAssignmentStatus: shipment.userAssignmentStatus,
                    trackingAssignmentStatus: shipment.trackingAssignmentStatus,
                    createdAt: shipment.createdAt,
                },
                trackingCode: shipment.trackingCode,
            },
            {
                status: 201,
                headers: {
                    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetTime.toString(),
                }
            }
        );

    } catch (error: any) {
        console.error('Error ingesting shipment:', error);

        // Handle specific ingestion errors
        if (error.message?.includes('Validation failed')) {
            return NextResponse.json(
                {
                    error: 'Shipment validation failed',
                    details: error.message,
                },
                { status: 422 }
            );
        }

        if (error.message?.includes('Duplicate shipment')) {
            return NextResponse.json(
                {
                    error: 'Duplicate shipment detected',
                    details: error.message,
                },
                { status: 409 }
            );
        }

        if (error.message?.includes('tracking code')) {
            return NextResponse.json(
                {
                    error: 'Tracking code generation failed',
                    details: 'Unable to generate unique tracking code. Please try again.',
                },
                { status: 500 }
            );
        }

        // Generic server error
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: 'Failed to process shipment ingestion. Please try again later.',
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/shipments/ingest - Get API ingestion information (for testing/debugging)
 */
export async function GET(req: NextRequest) {
    try {
        // Validate API authentication
        const auth = validateApiAuth(req.headers);
        if (!auth.valid) {
            return NextResponse.json(
                {
                    error: 'Authentication failed',
                    details: auth.error
                },
                { status: 401 }
            );
        }

        // Check rate limiting (lighter limit for GET requests)
        const rateLimit = checkRateLimit(auth.apiKey!);

        return NextResponse.json(
            {
                message: 'API ingestion endpoint is available',
                apiSource: auth.source,
                rateLimit: {
                    limit: RATE_LIMIT_MAX_REQUESTS,
                    remaining: rateLimit.remaining,
                    resetTime: rateLimit.resetTime,
                },
                endpoints: {
                    ingest: 'POST /api/shipments/ingest',
                    bulkIngest: 'POST /api/shipments/bulk-ingest',
                    status: 'GET /api/shipments/ingest/status',
                },
                requiredHeaders: {
                    'x-api-key': 'Your API key',
                    'x-api-source': 'Your system identifier',
                    'content-type': 'application/json',
                },
            },
            {
                headers: {
                    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': rateLimit.resetTime.toString(),
                }
            }
        );

    } catch (error) {
        console.error('Error getting ingestion info:', error);
        return NextResponse.json(
            { error: 'Failed to get ingestion information' },
            { status: 500 }
        );
    }
}