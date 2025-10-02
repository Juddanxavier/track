/** @format */

export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zipCode?: string | null;
    role?: string | null;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    stripeCustomerId?: string | null;
}

export interface PublicUser {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserListResponse {
    users: User[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface UserStatsResponse {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    verifiedUsers: number;
    newUsers: {
        last30Days: number;
        last7Days: number;
    };
    usersByRole: Record<string, number>;
    dailyRegistrations: Array<{
        date: string;
        count: number;
    }>;
    verificationRate: number;
}

export interface CreateUserRequest {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    role?: string;
    banned?: boolean;
    banReason?: string;
    password?: string;
    sendWelcomeEmail?: boolean;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    role?: string;
    banned?: boolean;
    banReason?: string;
    banExpires?: string;
    emailVerified?: boolean;
    image?: string;
    avatar?: string;
    avatarUrl?: string;
}

export interface BanUserRequest {
    reason: string;
    expiresAt?: string;
}

export interface UpdateRoleRequest {
    role: 'customer' | 'admin' | 'super-admin';
}

export interface BulkActionRequest {
    userIds: string[];
    action: 'ban' | 'unban' | 'delete' | 'updateRole';
    data?: {
        reason?: string;
        expiresAt?: string;
        role?: 'customer' | 'admin' | 'super-admin';
    };
}

export interface ApiResponse<T = any> {
    message?: string;
    error?: string;
    details?: any;
    user?: T;
    users?: T[];
    result?: T;
    affectedCount?: number;
}