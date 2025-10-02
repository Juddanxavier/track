/** @format */

import type {
    Lead,
    LeadListResponse,
    CreateLeadRequest,
    UpdateLeadRequest,
    UpdateLeadStatusRequest,
    ConvertLeadRequest,
    ApiResponse,
} from '@/types/lead';

class LeadApiClient {
    private baseUrl = '/api/lead';

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const startTime = performance.now();

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Log performance in development
            if (process.env.NODE_ENV === 'development') {
                const duration = performance.now() - startTime;
                console.log(`🚀 API ${options.method || 'GET'} ${endpoint}: ${duration.toFixed(2)}ms`);
            }

            return result;
        } catch (error) {
            // Log failed requests
            if (process.env.NODE_ENV === 'development') {
                const duration = performance.now() - startTime;
                console.error(`❌ API ${options.method || 'GET'} ${endpoint} failed after ${duration.toFixed(2)}ms:`, error);
            }
            throw error;
        }
    }

    // List leads with pagination, search, and filtering
    async getLeads(params?: {
        page?: number;
        perPage?: number;
        q?: string;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
        status?: string;
        originCountry?: string;
        destinationCountry?: string;
        assignedTo?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<LeadListResponse> {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== '') {
                    searchParams.append(key, value.toString());
                }
            });
        }

        const query = searchParams.toString();
        return this.request<LeadListResponse>(query ? `?${query}` : '');
    }

    // Get single lead
    async getLead(id: string): Promise<ApiResponse<Lead>> {
        return this.request<ApiResponse<Lead>>(`/${id}`);
    }

    // Create new lead
    async createLead(data: CreateLeadRequest): Promise<ApiResponse<Lead>> {
        return this.request<ApiResponse<Lead>>('', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Update lead
    async updateLead(id: string, data: UpdateLeadRequest): Promise<ApiResponse<Lead>> {
        return this.request<ApiResponse<Lead>>(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Delete lead
    async deleteLead(id: string): Promise<ApiResponse> {
        return this.request<ApiResponse>(`/${id}`, {
            method: 'DELETE',
        });
    }

    // Update lead status with optional failure reason and notes
    async updateLeadStatus(
        id: string,
        data: UpdateLeadStatusRequest
    ): Promise<ApiResponse<Lead>> {
        return this.request<ApiResponse<Lead>>(`/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Convert successful lead to shipment
    async convertToShipment(
        id: string,
        data?: ConvertLeadRequest
    ): Promise<ApiResponse<Lead>> {
        return this.request<ApiResponse<Lead>>(`/${id}/convert`, {
            method: 'POST',
            body: JSON.stringify(data || {}),
        });
    }

    // Sync customer data or manage customer relationship
    async syncCustomer(
        id: string,
        action: 'update_lead_from_customer' | 'update_customer_from_lead' | 'unlink_customer'
    ): Promise<ApiResponse> {
        return this.request<ApiResponse>(`/${id}/sync-customer`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
    }
}

export const leadApi = new LeadApiClient();