/** @format */

import type {
    User,
    UserListResponse,
    UserStatsResponse,
    CreateUserRequest,
    UpdateUserRequest,
    BanUserRequest,
    UpdateRoleRequest,
    BulkActionRequest,
    ApiResponse,
} from '@/types/user';

class UserApiClient {
    private baseUrl = '/api/user';

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
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

        return response.json();
    }

    // List users with pagination and search
    async getUsers(params?: {
        page?: number;
        perPage?: number;
        q?: string;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
    }): Promise<UserListResponse> {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    searchParams.append(key, value.toString());
                }
            });
        }

        const query = searchParams.toString();
        return this.request<UserListResponse>(query ? `?${query}` : '');
    }

    // Get single user
    async getUser(id: string): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>(`/${id}`);
    }

    // Create new user
    async createUser(data: CreateUserRequest): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>('', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Update user
    async updateUser(id: string, data: UpdateUserRequest): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>(`/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Delete user
    async deleteUser(id: string): Promise<ApiResponse> {
        return this.request<ApiResponse>(`/${id}`, {
            method: 'DELETE',
        });
    }

    // Ban user
    async banUser(id: string, data: BanUserRequest): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>(`/${id}/ban`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Unban user
    async unbanUser(id: string): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>(`/${id}/ban`, {
            method: 'DELETE',
        });
    }

    // Update user role
    async updateUserRole(id: string, data: UpdateRoleRequest): Promise<ApiResponse<User>> {
        return this.request<ApiResponse<User>>(`/${id}/role`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Bulk operations
    async bulkAction(data: BulkActionRequest): Promise<ApiResponse> {
        return this.request<ApiResponse>('/bulk', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Get user statistics
    async getStats(): Promise<UserStatsResponse> {
        return this.request<UserStatsResponse>('/stats');
    }
}

export const userApi = new UserApiClient();