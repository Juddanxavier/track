/** @format */

import { NextRequest } from 'next/server';

// GET /api/notifications/sse - Deprecated SSE endpoint (migrated to polling)
export async function GET(req: NextRequest) {
    console.log('⚠️ SSE endpoint accessed - system has migrated to polling');

    return new Response('SSE endpoint deprecated. System now uses polling for notifications.', {
        status: 410, // Gone
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache'
        }
    });
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS(req: NextRequest) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : req.headers.get('origin') || '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Cache-Control, Authorization, Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400', // 24 hours
            'Vary': 'Origin',
        },
    });
}

