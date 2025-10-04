/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { NextRequest, NextResponse } from 'next/server';
import { shipmentService } from '@/lib/shipmentService';
import {
    ShipmentSearchParamsSchema,
    CreateShipmentSchema,
    type ShipmentSearchParams,
    type CreateShipmentRequest
} from '@/types/shipment';
import { auth } from '@/lib/auth';

// GET /api/shipments - List shipments with filtering and pagination
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const url = new URL(req.url);
        const searchParams = Object.fromEntries(url.searchParams);

        // Parse query parameters
        const queryParams: any = {};

        // Handle pagination
        if (searchParams.page) {
            queryParams.page = parseInt(searchParams.page, 10);
        }
        if (searchParams.perPage) {
            queryParams.perPage = parseInt(searchParams.perPage, 10);
        }

        // Handle sorting
        if (searchParams.sortBy) {
            queryParams.sortBy = searchParams.sortBy;
        }
        if (searchParams.sortOrder) {
            queryParams.sortOrder = searchParams.sortOrder;
        }

        // Handle search and filters for simplified workflow
        const filters: any = {};

        // Simple text searches
        if (searchParams.q) {
            // Global search - search across multiple fields
            filters.customerName = searchParams.q;
        }
        if (searchParams.customerName) {
            filters.customerName = searchParams.customerName;
        }
        if (searchParams.customerEmail) {
            filters.customerEmail = searchParams.customerEmail;
        }
        if (searchParams.internalTrackingCode) {
            filters.internalTrackingCode = searchParams.internalTrackingCode;
        }
        if (searchParams.carrierTrackingNumber) {
            filters.carrierTrackingNumber = searchParams.carrierTrackingNumber;
        }

        // Array filters for simplified workflow
        if (searchParams.status) {
            filters.status = Array.isArray(searchParams.status)
                ? searchParams.status
                : searchParams.status.split(',');
        }
        if (searchParams.carrier) {
            filters.carrier = Array.isArray(searchParams.carrier)
                ? searchParams.carrier
                : searchParams.carrier.split(',');
        }
        if (searchParams.apiSyncStatus) {
            filters.apiSyncStatus = Array.isArray(searchParams.apiSyncStatus)
                ? searchParams.apiSyncStatus
                : searchParams.apiSyncStatus.split(',');
        }

        // Needs review filter for failed API syncs
        if (searchParams.needsReview === 'true') {
            filters.needsReview = true;
        }

        // Date range filters
        if (searchParams.dateStart || searchParams.dateEnd) {
            filters.dateRange = {};
            if (searchParams.dateStart) {
                filters.dateRange.start = new Date(searchParams.dateStart);
            }
            if (searchParams.dateEnd) {
                filters.dateRange.end = new Date(searchParams.dateEnd);
            }
        }

        if (searchParams.deliveryStart || searchParams.deliveryEnd) {
            filters.estimatedDeliveryRange = {};
            if (searchParams.deliveryStart) {
                filters.estimatedDeliveryRange.start = new Date(searchParams.deliveryStart);
            }
            if (searchParams.deliveryEnd) {
                filters.estimatedDeliveryRange.end = new Date(searchParams.deliveryEnd);
            }
        }

        if (Object.keys(filters).length > 0) {
            queryParams.filters = filters;
        }

        // Validate parameters
        const parsed = ShipmentSearchParamsSchema.safeParse(queryParams);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    details: parsed.error.issues
                },
                { status: 400 }
            );
        }

        // Search shipments
        const result = await shipmentService.searchShipments(parsed.data);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching shipments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shipments' },
            { status: 500 }
        );
    }
}

// POST /api/shipments - Create new shipment with manual entry
export async function POST(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Validate required fields for simplified workflow
        if (!body.carrierTrackingNumber || !body.carrier) {
            return NextResponse.json(
                {
                    error: 'Carrier tracking number and carrier are required',
                    details: ['carrierTrackingNumber and carrier fields are mandatory']
                },
                { status: 400 }
            );
        }

        // Validate carrier tracking number format
        const { ThirdPartyAPIService } = await import('@/lib/third-party-api-service');
        const apiService = new ThirdPartyAPIService();

        const isValidFormat = await apiService.validateTrackingNumber(
            body.carrierTrackingNumber,
            body.carrier
        );

        if (!isValidFormat) {
            return NextResponse.json(
                {
                    error: 'Invalid tracking number format for the selected carrier',
                    details: [`Tracking number ${body.carrierTrackingNumber} is not valid for ${body.carrier}`]
                },
                { status: 422 }
            );
        }

        // Check for duplicate tracking number
        const existingShipment = await shipmentService.getByCarrierTrackingNumber(
            body.carrierTrackingNumber,
            body.carrier
        );

        if (existingShipment) {
            return NextResponse.json(
                {
                    error: 'Tracking number already exists',
                    details: [`A shipment with tracking number ${body.carrierTrackingNumber} for ${body.carrier} already exists`],
                    existingShipmentId: existingShipment.id
                },
                { status: 409 }
            );
        }

        // Get current user for audit trail
        const session = await auth.api.getSession({
            headers: req.headers,
        });

        const createdBy = session?.user?.id;

        // Create shipment with simplified workflow
        const shipment = await shipmentService.createFromTrackingNumber(
            body.carrierTrackingNumber,
            body.carrier,
            createdBy
        );

        return NextResponse.json(
            {
                shipment: {
                    id: shipment.id,
                    internalTrackingCode: shipment.internalTrackingCode,
                    carrier: shipment.carrier,
                    carrierTrackingNumber: shipment.carrierTrackingNumber,
                    status: shipment.status,
                    apiSyncStatus: shipment.apiSyncStatus,
                    needsReview: shipment.needsReview,
                    createdAt: shipment.createdAt
                },
                message: 'Shipment created successfully',
                internalTrackingCode: shipment.internalTrackingCode
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error('Error creating shipment:', error);

        // Handle specific shipment errors
        if (error.code === 'TRACKING_CODE_ERROR') {
            return NextResponse.json(
                { error: 'Failed to generate unique internal tracking code' },
                { status: 500 }
            );
        }

        if (error.code === 'API_INTEGRATION_ERROR') {
            return NextResponse.json(
                {
                    error: 'Failed to fetch shipment details from carrier API',
                    details: error.message,
                    note: 'Shipment was created but marked for manual review'
                },
                { status: 207 } // Partial success
            );
        }

        if (error.code === 'DUPLICATE_TRACKING_NUMBER') {
            return NextResponse.json(
                { error: 'Tracking number already exists in the system' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create shipment' },
            { status: 500 }
        );
    }
}