/** @format */

export interface LinkedCustomer {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role?: string | null;
}

export interface Lead {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string | null;
    customerId?: string | null;
    originCountry: string;
    destinationCountry: string;
    weight: string;
    status: 'new' | 'contacted' | 'failed' | 'success' | 'converted';
    notes?: string | null;
    failureReason?: string | null;
    assignedTo?: string | null;
    createdAt: Date;
    updatedAt: Date;
    contactedAt?: Date | null;
    convertedAt?: Date | null;
    failedAt?: Date | null;
    successAt?: Date | null;
    archivedAt?: Date | null;
    isArchived: boolean;
    shipmentId?: string | null;
    linkedCustomer?: LinkedCustomer | null;
}

export interface LeadListResponse {
    leads: Lead[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface CreateLeadRequest {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerId?: string;
    originCountry: string;
    destinationCountry: string;
    weight: string;
    notes?: string;
    assignedTo?: string;
}

export interface UpdateLeadRequest {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerId?: string;
    originCountry?: string;
    destinationCountry?: string;
    weight?: string;
    status?: 'new' | 'contacted' | 'failed' | 'success' | 'converted';
    notes?: string;
    failureReason?: string;
    assignedTo?: string;
}

export interface UpdateLeadStatusRequest {
    status: 'new' | 'contacted' | 'failed' | 'success' | 'converted';
    failureReason?: string;
    notes?: string;
}

export interface ConvertLeadRequest {
    shipmentData?: {
        // Placeholder for future shipment fields
        trackingNumber?: string;
        estimatedDelivery?: string;
    };
}

export interface LeadActivity {
    id: string;
    leadId: string;
    userId?: string | null;
    action: 'created' | 'updated' | 'status_changed' | 'assigned' | 'converted' | 'deleted';
    field?: string | null; // Field that was changed (e.g., 'status', 'assignedTo', 'customerName')
    oldValue?: string | null; // Previous value
    newValue?: string | null; // New value
    description: string; // Human-readable description of the change
    metadata?: string | null; // JSON string for additional data
    createdAt: Date;
    user?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

export interface LeadActivityListResponse {
    activities: LeadActivity[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ArchivedLead {
    id: string;
    originalLeadId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string | null;
    customerId?: string | null;
    originCountry: string;
    destinationCountry: string;
    weight: string;
    status: 'success' | 'converted';
    notes?: string | null;
    assignedTo?: string | null;
    createdAt: Date;
    updatedAt: Date;
    contactedAt?: Date | null;
    convertedAt?: Date | null;
    successAt?: Date | null;
    archivedAt: Date;
    shipmentId?: string | null;
}

export interface CleanupLogEntry {
    id: string;
    leadId: string;
    action: 'deleted' | 'archived';
    reason: string;
    performedAt: Date;
    leadData?: string | null;
}

export interface ArchivedLeadListResponse {
    archivedLeads: ArchivedLead[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface CleanupLogResponse {
    entries: CleanupLogEntry[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface CleanupSummary {
    deletedCount: number;
    archivedCount: number;
    errors: string[];
    runAt: Date;
}

export interface CleanupConfig {
    failedLeadRetentionDays: number;
    successLeadArchiveDays: number;
    lastRunAt?: Date | null;
    isEnabled: boolean;
}

export interface ApiResponse<T = any> {
    message?: string;
    error?: string;
    details?: any;
    lead?: T;
    leads?: T[];
    result?: T;
    affectedCount?: number;
}