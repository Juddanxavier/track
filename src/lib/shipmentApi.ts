/** @format */

import {
    Shipment,
    ShipmentListResponse,
    CreateShipmentRequest,
    UpdateShipmentRequest,
    ManualStatusUpdateRequest,
    ShipmentWithEvents,
    ApiResponse,
} from '@/types/shipment';

interface ShipmentSearchParams {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    q?: string;
    status?: string;
    courier?: string;
    customerName?: string;
    trackingCode?: string;
    dateStart?: string;
    dateEnd?: string;
    deliveryStart?: string;
    deliveryEnd?: string;
}

class ShipmentApi {
    private baseUrl = '/api/shipments';

    async getShipments(params: ShipmentSearchParams = {}): Promise<ShipmentListResponse> {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, value.toString());
            }
        });

        const url = `${this.baseUrl}?${searchParams.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch shipments' }));
            throw new Error(error.error || 'Failed to fetch shipments');
        }

        return response.json();
    }

    async getShipment(id: string): Promise<ShipmentWithEvents> {
        const response = await fetch(`${this.baseUrl}/${id}`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch shipment' }));
            throw new Error(error.error || 'Failed to fetch shipment');
        }

        const data = await response.json();
        return data.shipment;
    }

    async createShipment(shipmentData: CreateShipmentRequest): Promise<Shipment> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(shipmentData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create shipment' }));
            throw new Error(error.error || 'Failed to create shipment');
        }

        const data = await response.json();
        return data.shipment;
    }

    async updateShipment(id: string, updates: UpdateShipmentRequest): Promise<Shipment> {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update shipment' }));
            throw new Error(error.error || 'Failed to update shipment');
        }

        const data = await response.json();
        return data.shipment;
    }

    async updateShipmentStatus(id: string, statusUpdate: ManualStatusUpdateRequest): Promise<Shipment> {
        const response = await fetch(`${this.baseUrl}/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(statusUpdate),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update shipment status' }));
            throw new Error(error.error || 'Failed to update shipment status');
        }

        const data = await response.json();
        return data.shipment;
    }

    async deleteShipment(id: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to delete shipment' }));
            throw new Error(error.error || 'Failed to delete shipment');
        }
    }

    async syncShipmentWithAPI(id: string): Promise<Shipment> {
        const response = await fetch(`${this.baseUrl}/${id}/sync`, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to sync shipment' }));
            throw new Error(error.error || 'Failed to sync shipment');
        }

        const data = await response.json();
        return data.shipment;
    }

    async getPublicTracking(trackingCode: string): Promise<any> {
        const response = await fetch(`/api/tracking/${trackingCode}`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch tracking information' }));
            throw new Error(error.error || 'Failed to fetch tracking information');
        }

        return response.json();
    }
}

export const shipmentApi = new ShipmentApi();