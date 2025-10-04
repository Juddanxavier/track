/** @format */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/helpers/authHelpers';
import { shipmentService } from '@/lib/shipmentService';
import { shipmentEventService } from '@/lib/shipmentEventService';
import type { Shipment, ShipmentEvent } from '@/types/shipment';

// Enhanced shipment info for authenticated users
interface AuthenticatedShipmentInfo extends Shipment {
    events: ShipmentEvent[];
    notificationPreferences?: {
        emailNotifications: boolean;
        smsNotifications: boolean;
        statusUpdates: boolean;
        deliveryReminders: boolean;
    };
    deliveryOptions?: {
        preferredDeliveryTime?: string;
        deliveryInstructions?: string;
        alternateAddress?: string;
    };
}

// GET /api/shipments/my-shipments - Get shipments assigned to the current user
export async function GET(req: NextRequest) {
    try {
        // Check authentication
        const session = await getSession(req);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Parse query parameters for pagination and filtering
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const perPage = Math.min(parseInt(url.searchParams.get('perPage') || '10', 10), 50);
        const status = url.searchParams.get('status');
        const includeEvents = url.searchParams.get('includeEvents') === 'true';

        // Build filters for user's shipments
        const filters: any = {
            assignedUserId: userId,
        };

        // Add status filter if provided
        if (status) {
            filters.status = status.split(',');
        }

        // Get user's shipments
        const result = await shipmentService.searchShipments({
            page,
            perPage,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            filters,
        });

        // If events are requested, fetch them for each shipment
        let enhancedShipments: AuthenticatedShipmentInfo[] = [];

        if (includeEvents) {
            enhancedShipments = await Promise.all(
                result.shipments.map(async (shipment) => {
                    const eventsResult = await shipmentEventService.getShipmentEvents(shipment.id);

                    // Add enhanced information for authenticated users
                    const enhancedShipment: AuthenticatedShipmentInfo = {
                        ...shipment,
                        events: eventsResult.events,
                        // TODO: Fetch actual notification preferences from user settings
                        notificationPreferences: {
                            emailNotifications: true,
                            smsNotifications: false,
                            statusUpdates: true,
                            deliveryReminders: true,
                        },
                        // TODO: Fetch actual delivery options from user preferences
                        deliveryOptions: {
                            deliveryInstructions: shipment.specialInstructions || undefined,
                        },
                    };

                    return enhancedShipment;
                })
            );
        } else {
            // Return basic shipment info without events
            enhancedShipments = result.shipments.map(shipment => ({
                ...shipment,
                events: [],
                notificationPreferences: {
                    emailNotifications: true,
                    smsNotifications: false,
                    statusUpdates: true,
                    deliveryReminders: true,
                },
            }));
        }

        return NextResponse.json({
            success: true,
            data: {
                shipments: enhancedShipments,
                pagination: result.pagination,
                summary: {
                    totalShipments: result.pagination.total,
                    pendingShipments: enhancedShipments.filter(s => s.status === 'pending').length,
                    inTransitShipments: enhancedShipments.filter(s => s.status === 'in-transit').length,
                    deliveredShipments: enhancedShipments.filter(s => s.status === 'delivered').length,
                },
            },
        });

    } catch (error) {
        console.error('Error fetching user shipments:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: 'Failed to fetch your shipments. Please try again later.',
            },
            { status: 500 }
        );
    }
}