/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { apiIngestionService } from '@/lib/apiIngestionService';
import { BulkIngestSchema, type BulkIngestRequest } from '@/types/shipment';
import { z } from 'zod';

// Rate limiting configuration for bulk operations
const BULK_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const BULK_RATE_LIMIT_MAX_REQUESTS = 10; // 10 bulk requests per 5 minutes per API key
const MAX_BULK_SIZE = 100; // Maximum shipments per bulk request
const bulkRateLimitMap = new Map<string, { count: number; resetTime: number }>();

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
 * Check rate limiting for bulk operations
 */
function checkBulkRateLimit(apiKey: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = `bulk-ingest:${apiKey}`;

    let rateLimitData = bulkRateLimitMap.get(key);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        // Reset or initialize rate limit
        rateLimitData = {
            count: 0,
            resetTime: now + BULK_RATE_LIMIT_WINDOW,
        };
        bulkRateLimitMap.set(key, rateLimitData);
    }

    if (rateLimitData.count >= BULK_RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: rateLimitData.resetTime,
        };
    }

    rateLimitData.count++;
    return {
        allowed: true,
        remaining: BULK_RATE_LIMIT_MAX_REQUESTS - rateLimitData.count,
        resetTime: rateLimitData.resetTime,
    };
}

/**
 * POST /api/shipments/bulk-ingest - Bulk ingest multiple shipments from API
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

        // Check bulk rate limiting
        const rateLimit = checkBulkRateLimit(auth.apiKey!);
        if (!rateLimit.allowed) {
            const resetTimeSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
            return NextResponse.json(
                {
                    error: 'Bulk rate limit exceeded',
                    details: `Too many bulk requests. Try again in ${resetTimeSeconds} seconds.`,
                    rateLimitReset: rateLimit.resetTime,
                },
                {
                    status: 429,
                    headers: {
                        'X-Bulk-RateLimit-Limit': BULK_RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-Bulk-RateLimit-Remaining': '0',
                        'X-Bulk-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        // Parse request body
        const body = await req.json();

        // Validate bulk ingestion request
        const validation = BulkIngestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    error: 'Invalid bulk ingestion request',
                    details: validation.error.issues.map(issue => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                {
                    status: 400,
                    headers: {
                        'X-Bulk-RateLimit-Limit': BULK_RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-Bulk-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-Bulk-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        const { shipments, source } = validation.data;

        // Validate bulk size limit
        if (shipments.length > MAX_BULK_SIZE) {
            return NextResponse.json(
                {
                    error: 'Bulk size limit exceeded',
                    details: `Maximum ${MAX_BULK_SIZE} shipments allowed per bulk request. Received ${shipments.length}.`,
                    maxBulkSize: MAX_BULK_SIZE,
                },
                {
                    status: 413,
                    headers: {
                        'X-Bulk-RateLimit-Limit': BULK_RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-Bulk-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-Bulk-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        // Use the provided source or fall back to auth source
        const ingestionSource = source || auth.source!;

        // Process bulk ingestion
        const startTime = Date.now();
        const result = await apiIngestionService.bulkIngest(shipments, ingestionSource);
        const processingTime = Date.now() - startTime;

        // Prepare response with detailed results
        const response = {
            message: 'Bulk ingestion completed',
            summary: {
                totalProcessed: result.totalProcessed,
                successful: result.successful,
                failed: result.failed,
                successRate: result.totalProcessed > 0 ? (result.successful / result.totalProcessed * 100).toFixed(2) + '%' : '0%',
                processingTimeMs: processingTime,
            },
            createdShipments: result.createdShipments,
            errors: result.errors.map(error => ({
                index: error.index,
                error: error.error,
                customerEmail: error.data?.customerEmail,
                externalId: error.data?.externalId,
            })),
        };

        // Determine response status based on results
        let statusCode = 200;
        if (result.failed > 0 && result.successful === 0) {
            // All failed
            statusCode = 422;
        } else if (result.failed > 0) {
            // Partial success
            statusCode = 207; // Multi-Status
        } else {
            // All successful
            statusCode = 201;
        }

        return NextResponse.json(
            response,
            {
                status: statusCode,
                headers: {
                    'X-Bulk-RateLimit-Limit': BULK_RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-Bulk-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-Bulk-RateLimit-Reset': rateLimit.resetTime.toString(),
                }
            }
        );

    } catch (error: any) {
        console.error('Error processing bulk ingestion:', error);

        // Handle specific bulk ingestion errors
        if (error.message?.includes('Transaction')) {
            return NextResponse.json(
                {
                    error: 'Bulk transaction failed',
                    details: 'Database transaction error during bulk processing. No shipments were created.',
                },
                { status: 500 }
            );
        }

        if (error.message?.includes('timeout')) {
            return NextResponse.json(
                {
                    error: 'Bulk processing timeout',
                    details: 'Bulk ingestion took too long to process. Consider reducing batch size.',
                    maxBulkSize: MAX_BULK_SIZE,
                },
                { status: 408 }
            );
        }

        // Generic server error
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: 'Failed to process bulk ingestion. Please try again later.',
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/shipments/bulk-ingest - Get bulk ingestion information
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

        // Check rate limiting
        const rateLimit = checkBulkRateLimit(auth.apiKey!);

        return NextResponse.json(
            {
                message: 'Bulk ingestion endpoint is available',
                apiSource: auth.source,
                limits: {
                    maxBulkSize: MAX_BULK_SIZE,
                    rateLimit: {
                        limit: BULK_RATE_LIMIT_MAX_REQUESTS,
                        remaining: rateLimit.remaining,
                        windowMinutes: BULK_RATE_LIMIT_WINDOW / (60 * 1000),
                        resetTime: rateLimit.resetTime,
                    },
                },
                usage: {
                    description: 'Send POST request with array of shipment objects',
                    contentType: 'application/json',
                    bodySchema: {
                        shipments: 'Array of shipment objects (max ' + MAX_BULK_SIZE + ')',
                        source: 'Optional source identifier (defaults to x-api-source header)',
                    },
                },
                responseFormats: {
                    201: 'All shipments created successfully',
                    207: 'Partial success - some shipments failed',
                    422: 'All shipments failed validation',
                },
            },
            {
                headers: {
                    'X-Bulk-RateLimit-Limit': BULK_RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-Bulk-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-Bulk-RateLimit-Reset': rateLimit.resetTime.toString(),
                }
            }
        );

    } catch (error) {
        console.error('Error getting bulk ingestion info:', error);
        return NextResponse.json(
            { error: 'Failed to get bulk ingestion information' },
            { status: 500 }
        );
    }
}