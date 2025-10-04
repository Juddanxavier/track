/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { apiIngestionService } from '@/lib/apiIngestionService';
import { z } from 'zod';

// Rate limiting configuration for status checks
const STATUS_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const STATUS_RATE_LIMIT_MAX_REQUESTS = 30; // 30 status requests per minute per API key
const statusRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// API authentication schema
const AuthHeaderSchema = z.object({
    'x-api-key': z.string().min(1, 'API key is required'),
    'x-api-source': z.string().min(1, 'API source identifier is required'),
});

// Query parameters schema
const StatusQuerySchema = z.object({
    timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    includeDetails: z.enum(['true', 'false']).optional().default('false'),
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
 * Check rate limiting for status requests
 */
function checkStatusRateLimit(apiKey: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = `status:${apiKey}`;

    let rateLimitData = statusRateLimitMap.get(key);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        // Reset or initialize rate limit
        rateLimitData = {
            count: 0,
            resetTime: now + STATUS_RATE_LIMIT_WINDOW,
        };
        statusRateLimitMap.set(key, rateLimitData);
    }

    if (rateLimitData.count >= STATUS_RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: rateLimitData.resetTime,
        };
    }

    rateLimitData.count++;
    return {
        allowed: true,
        remaining: STATUS_RATE_LIMIT_MAX_REQUESTS - rateLimitData.count,
        resetTime: rateLimitData.resetTime,
    };
}

/**
 * Get time range for statistics
 */
function getTimeRange(timeRange: string): { start: Date; end: Date } {
    const now = new Date();
    const end = now;
    let start: Date;

    switch (timeRange) {
        case '1h':
            start = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case '24h':
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
}

/**
 * Calculate API usage statistics (mock implementation)
 */
function getApiUsageStats(apiKey: string): { requestsToday: number; requestsThisHour: number; rateLimitRemaining: number } {
    // TODO: Implement proper API usage tracking from database or cache
    // For now, return mock data based on current rate limiting

    const now = Date.now();

    // Get current rate limit data
    const ingestKey = `ingest:${apiKey}`;
    const bulkKey = `bulk-ingest:${apiKey}`;
    const statusKey = `status:${apiKey}`;

    const ingestData = statusRateLimitMap.get(ingestKey);
    const bulkData = statusRateLimitMap.get(bulkKey);
    const statusData = statusRateLimitMap.get(statusKey);

    // Calculate approximate usage (this is a simplified implementation)
    const requestsThisHour = (ingestData?.count || 0) + (bulkData?.count || 0) + (statusData?.count || 0);
    const requestsToday = requestsThisHour * 8; // Rough estimate

    // Calculate remaining rate limit (using the most restrictive)
    const ingestRemaining = ingestData ? Math.max(0, 100 - ingestData.count) : 100;
    const bulkRemaining = bulkData ? Math.max(0, 10 - bulkData.count) : 10;
    const statusRemaining = statusData ? Math.max(0, 30 - statusData.count) : 30;

    const rateLimitRemaining = Math.min(ingestRemaining, bulkRemaining, statusRemaining);

    return {
        requestsToday,
        requestsThisHour,
        rateLimitRemaining,
    };
}

/**
 * GET /api/shipments/ingest/status - Get ingestion status and statistics
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
        const rateLimit = checkStatusRateLimit(auth.apiKey!);
        if (!rateLimit.allowed) {
            const resetTimeSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
            return NextResponse.json(
                {
                    error: 'Status rate limit exceeded',
                    details: `Too many status requests. Try again in ${resetTimeSeconds} seconds.`,
                    rateLimitReset: rateLimit.resetTime,
                },
                {
                    status: 429,
                    headers: {
                        'X-Status-RateLimit-Limit': STATUS_RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-Status-RateLimit-Remaining': '0',
                        'X-Status-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        // Parse query parameters
        const url = new URL(req.url);
        const queryParams = {
            timeRange: url.searchParams.get('timeRange') || '24h',
            includeDetails: url.searchParams.get('includeDetails') || 'false',
        };

        const parsedQuery = StatusQuerySchema.safeParse(queryParams);
        if (!parsedQuery.success) {
            return NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    details: parsedQuery.error.issues.map(issue => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                },
                {
                    status: 400,
                    headers: {
                        'X-Status-RateLimit-Limit': STATUS_RATE_LIMIT_MAX_REQUESTS.toString(),
                        'X-Status-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-Status-RateLimit-Reset': rateLimit.resetTime.toString(),
                    }
                }
            );
        }

        const { timeRange, includeDetails } = parsedQuery.data;

        // Get time range for statistics
        const timeRangeObj = getTimeRange(timeRange);

        // Get ingestion statistics from the service
        const ingestionStats = await apiIngestionService.getIngestionStats(timeRangeObj);

        // Get API usage statistics
        const apiUsageStats = getApiUsageStats(auth.apiKey!);

        // Filter statistics by API source if needed
        const sourceStats = ingestionStats.sourceBreakdown[auth.source!] || 0;
        const recentIngestions = ingestionStats.recentIngestions.filter(
            ingestion => ingestion.source === auth.source
        );

        // Prepare response
        const response: any = {
            message: 'Ingestion status retrieved successfully',
            apiSource: auth.source,
            timeRange: {
                period: timeRange,
                start: timeRangeObj.start,
                end: timeRangeObj.end,
            },
            ingestionStats: {
                totalIngested: sourceStats,
                totalIngestedAllSources: ingestionStats.totalIngested,
                recentIngestions: recentIngestions.slice(0, 10), // Limit to 10 most recent
            },
            apiUsageStats,
            rateLimits: {
                ingest: {
                    limit: 100,
                    window: '1 minute',
                },
                bulkIngest: {
                    limit: 10,
                    window: '5 minutes',
                    maxBulkSize: 100,
                },
                status: {
                    limit: STATUS_RATE_LIMIT_MAX_REQUESTS,
                    remaining: rateLimit.remaining,
                    window: '1 minute',
                },
            },
            systemHealth: {
                status: 'operational',
                lastUpdated: new Date(),
            },
        };

        // Include detailed breakdown if requested
        if (includeDetails === 'true') {
            response.detailedStats = {
                allSourcesBreakdown: ingestionStats.sourceBreakdown,
                validationErrors: [], // TODO: Implement validation error tracking
                performanceMetrics: {
                    averageProcessingTime: '~150ms', // TODO: Implement actual metrics
                    successRate: sourceStats > 0 ? '98.5%' : 'N/A',
                },
            };
        }

        return NextResponse.json(
            response,
            {
                headers: {
                    'X-Status-RateLimit-Limit': STATUS_RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-Status-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-Status-RateLimit-Reset': rateLimit.resetTime.toString(),
                }
            }
        );

    } catch (error: any) {
        console.error('Error getting ingestion status:', error);

        // Handle specific errors
        if (error.message?.includes('Database')) {
            return NextResponse.json(
                {
                    error: 'Database error',
                    details: 'Unable to retrieve ingestion statistics. Please try again later.',
                },
                { status: 503 }
            );
        }

        // Generic server error
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: 'Failed to retrieve ingestion status. Please try again later.',
            },
            { status: 500 }
        );
    }
}