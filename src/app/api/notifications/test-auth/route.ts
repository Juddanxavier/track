/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';

// GET /api/notifications/test-auth - Test authentication for SSE debugging
export async function GET(req: NextRequest) {
    try {
        console.log('🔍 Testing authentication...');
        console.log('   Headers:', Object.fromEntries(req.headers.entries()));

        const session = await getSession(req);

        if (!session?.user?.id) {
            console.log('❌ No session found');
            return NextResponse.json({
                authenticated: false,
                error: 'No session found',
                headers: Object.fromEntries(req.headers.entries())
            }, { status: 401 });
        }

        console.log(`✅ Session found for user: ${session.user.id}`);

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.user.id,
                email: session.user.email,
                role: session.user.role
            },
            sessionData: session,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Auth test error:', error);
        return NextResponse.json({
            authenticated: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}