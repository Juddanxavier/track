/** @format */

import { z } from 'zod';

// Enums for shipment status, event types, and sources
export const ShipmentStatus = {
    PENDING: 'pending',
    IN_TRANSIT: 'in-transit',
    OUT_FOR_DELIVERY: 'out-for-delivery',
    DELIVERED: 'delivered',
    EXCEPTION: 'exception',
    CANCELLED: 'cancelled',
} as const;

export type ShipmentStatusType = typeof ShipmentStatus[keyof typeof ShipmentStatus];

export const EventType = {
    SHIPMENT_CREATED: 'shipment_created',
    STATUS_CHANGE: 'status_change',
    LOCATION_UPDATE: 'location_update',
    DELIVERY_ATTEMPT: 'delivery_attempt',
    EXCEPTION: 'exception',
    API_SYNC: 'api_sync',
} as const;

export type EventTypeType = typeof EventType[keyof typeof EventType];

export const EventSource = {
    ADMIN_ACTION: 'admin_action',
    API_SYNC: 'api_sync',
    MANUAL: 'manual',
} as const;

export type EventSourceType = typeof EventSource[keyof typeof EventSource];

// Carrier enum for supported carriers
export const Carrier = {
    UPS: 'ups',
    FEDEX: 'fedex',
    DHL: 'dhl',
    USPS: 'usps',
} as const;

export type CarrierType = typeof Carrier[keyof typeof Carrier];

// API sync status enum
export const ApiSyncStatus = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
} as const;

export type ApiSyncStatusType = typeof ApiSyncStatus[keyof typeof ApiSyncStatus];

// Address interface
export interface Address {
    name: string;
    company?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
}

// Package dimensions interface
export interface Dimensions {
    length: number;
    width: number;
    height: number;
    unit: 'in' | 'cm';
}

// Third-party API response interface
export interface ShipmentDetails {
    // Customer Information
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;

    // Package Information
    packageDescription?: string;
    weight?: string;
    dimensions?: Dimensions;
    value?: string;

    // Addresses
    originAddress?: Address;
    destinationAddress?: Address;

    // Status and Delivery
    status: ShipmentStatusType;
    estimatedDelivery?: Date;
    actualDelivery?: Date;

    // Tracking Events
    events: TrackingEvent[];
}

// Tracking event for third-party API responses
export interface TrackingEvent {
    eventType: EventTypeType;
    status?: ShipmentStatusType;
    description: string;
    location?: string;
    eventTime: Date;
    metadata?: Record<string, any>;
}

// API Shipment Data interface for inbound API payloads
export interface APIShipmentData {
    // Required fields
    customerName: string;
    customerEmail: string;
    originAddress: Address;
    destinationAddress: Address;

    // Optional fields
    customerPhone?: string;
    packageDescription?: string;
    weight?: string;
    dimensions?: Dimensions;
    value?: string;
    specialInstructions?: string;
    estimatedDelivery?: string; // ISO date string

    // External reference
    externalId?: string; // Partner's internal ID
    externalSource?: string; // Partner system identifier
}

// Core shipment interface
export interface Shipment {
    id: string;
    internalTrackingCode: string;
    leadId?: string | null;

    // Carrier Information (admin-entered)
    carrier: CarrierType;
    carrierTrackingNumber: string;

    // Customer Information (from third-party API)
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;

    // Package Details (from third-party API)
    packageDescription?: string | null;
    weight?: string | null;
    dimensions?: Dimensions | null;
    value?: string | null;

    // Addresses (from third-party API)
    originAddress?: Address | null;
    destinationAddress?: Address | null;

    // Status and Tracking (from third-party API)
    status: ShipmentStatusType;
    estimatedDelivery?: Date | null;
    actualDelivery?: Date | null;

    // API Integration
    lastApiSync?: Date | null;
    apiSyncStatus: ApiSyncStatusType;
    apiError?: string | null;

    // Metadata
    notes?: string | null;
    needsReview: boolean;
    createdBy: string; // Admin user who created
    createdAt: Date;
    updatedAt: Date;
}

// Shipment event interface
export interface ShipmentEvent {
    id: string;
    shipmentId: string;

    // Event Details
    eventType: EventTypeType;
    status?: ShipmentStatusType | null;
    description: string;
    location?: string | null;

    // Source Information
    source: EventSourceType;
    sourceId?: string | null;

    // Timestamps
    eventTime: Date;
    recordedAt: Date;

    // Additional Data
    metadata?: Record<string, any> | null;
}

// Zod validation schemas
export const AddressSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    company: z.string().optional(),
    addressLine1: z.string().min(1, 'Address line 1 is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    phone: z.string().optional(),
});

export const DimensionsSchema = z.object({
    length: z.number().positive('Length must be positive'),
    width: z.number().positive('Width must be positive'),
    height: z.number().positive('Height must be positive'),
    unit: z.enum(['in', 'cm']),
});

// Carrier and API sync status validation schemas
export const CarrierSchema = z.enum(['ups', 'fedex', 'dhl', 'usps']);
export const ApiSyncStatusSchema = z.enum(['pending', 'success', 'failed']);

export const CreateShipmentSchema = z.object({
    leadId: z.string().optional(),

    // Carrier Information (admin-entered)
    carrier: CarrierSchema,
    carrierTrackingNumber: z.string().min(1, 'Carrier tracking number is required'),

    // Customer Information (optional - from third-party API)
    customerName: z.string().optional(),
    customerEmail: z.string().email('Valid email is required').optional(),
    customerPhone: z.string().optional(),

    // Package Details (optional - from third-party API)
    packageDescription: z.string().optional(),
    weight: z.string().optional(),
    dimensions: DimensionsSchema.optional(),
    value: z.string().optional(),

    // Addresses (optional - from third-party API)
    originAddress: AddressSchema.optional(),
    destinationAddress: AddressSchema.optional(),

    // Status and Tracking
    status: z.enum(['pending', 'in-transit', 'out-for-delivery', 'delivered', 'exception', 'cancelled']).optional(),
    estimatedDelivery: z.date().optional(),
    actualDelivery: z.date().optional(),

    // API Integration
    apiSyncStatus: ApiSyncStatusSchema.optional(),
    apiError: z.string().optional(),

    // Metadata
    notes: z.string().optional(),
    needsReview: z.boolean().optional(),
});

export const UpdateShipmentSchema = z.object({
    // Carrier Information
    carrier: CarrierSchema.optional(),
    carrierTrackingNumber: z.string().min(1).optional(),

    // Customer Information
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email('Valid email is required').optional(),
    customerPhone: z.string().optional(),

    // Package Details
    packageDescription: z.string().optional(),
    weight: z.string().optional(),
    dimensions: DimensionsSchema.optional(),
    value: z.string().optional(),

    // Addresses
    originAddress: AddressSchema.optional(),
    destinationAddress: AddressSchema.optional(),

    // Status and Tracking
    status: z.enum(['pending', 'in-transit', 'out-for-delivery', 'delivered', 'exception', 'cancelled']).optional(),
    estimatedDelivery: z.date().optional(),
    actualDelivery: z.date().optional(),

    // API Integration
    apiSyncStatus: ApiSyncStatusSchema.optional(),
    apiError: z.string().optional(),

    // Metadata
    notes: z.string().optional(),
    needsReview: z.boolean().optional(),
});

export const CreateShipmentEventSchema = z.object({
    shipmentId: z.string().min(1, 'Shipment ID is required'),

    // Event Details
    eventType: z.enum(['shipment_created', 'status_change', 'location_update', 'delivery_attempt', 'exception', 'api_sync']),
    status: z.enum(['pending', 'in-transit', 'out-for-delivery', 'delivered', 'exception', 'cancelled']).optional(),
    description: z.string().min(1, 'Description is required'),
    location: z.string().optional(),

    // Source Information
    source: z.enum(['admin_action', 'api_sync', 'manual']),
    sourceId: z.string().optional(),

    // Timestamps
    eventTime: z.date(),

    // Additional Data
    metadata: z.record(z.string(), z.any()).optional(),
});

// API Shipment Data validation schema
export const APIShipmentDataSchema = z.object({
    // Required fields
    customerName: z.string().min(1, 'Customer name is required'),
    customerEmail: z.string().email('Valid email is required'),
    originAddress: AddressSchema,
    destinationAddress: AddressSchema,

    // Optional fields
    customerPhone: z.string().optional(),
    packageDescription: z.string().optional(),
    weight: z.string().optional(),
    dimensions: DimensionsSchema.optional(),
    value: z.string().optional(),
    specialInstructions: z.string().optional(),
    estimatedDelivery: z.string().datetime('Invalid datetime format').optional(),

    // External reference
    externalId: z.string().optional(),
    externalSource: z.string().optional(),
});



// Request/Response types
export interface CreateShipmentRequest extends z.infer<typeof CreateShipmentSchema> { }

export interface UpdateShipmentRequest extends z.infer<typeof UpdateShipmentSchema> { }

export interface CreateShipmentEventRequest extends z.infer<typeof CreateShipmentEventSchema> { }

export interface APIShipmentDataRequest extends z.infer<typeof APIShipmentDataSchema> { }





// Bulk operation request types
export interface BulkIngestRequest {
    shipments: APIShipmentDataRequest[];
    source: string;
}



export interface ShipmentListResponse {
    shipments: Shipment[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ShipmentEventListResponse {
    events: ShipmentEvent[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface TrackingResponse {
    shipment: Shipment;
    events: ShipmentEvent[];
    lastUpdated: Date;
}

export interface ShipmentSummary {
    totalShipments: number;
    pendingShipments: number;
    inTransitShipments: number;
    outForDeliveryShipments: number;
    deliveredShipments: number;
    exceptionShipments: number;
    cancelledShipments: number;
}

// Dashboard statistics interface
export interface ShipmentStats {
    totalShipments: number;
    activeShipments: number;
    deliveredShipments: number;
    needsReview: number;
    recentlyCreated: number;
    apiSyncFailures: number;
}

// Validation result interface for API ingestion
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
}

// Paginated shipments response
export interface PaginatedShipments {
    shipments: Shipment[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    stats?: ShipmentStats;
}

// Public shipment info for tracking without authentication
export interface PublicTrackingInfo {
    internalTrackingCode: string;
    carrier: CarrierType;
    carrierTrackingNumber: string;
    status: ShipmentStatusType;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    events: PublicTrackingEvent[];
}

// Public tracking event (sanitized for customers)
export interface PublicTrackingEvent {
    eventType: EventTypeType;
    status?: ShipmentStatusType;
    description: string;
    location?: string;
    eventTime: Date;
}

// Bulk ingestion result interface
export interface BulkIngestResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Array<{
        index: number;
        error: string;
        data?: any;
    }>;
    createdShipments: string[]; // Array of created shipment IDs
}





// Ingestion status response interface
export interface IngestionStatusResponse {
    totalIngested: number;
    recentIngestions: Array<{
        source: string;
        count: number;
        timestamp: Date;
    }>;
    validationErrors: Array<{
        source: string;
        error: string;
        count: number;
    }>;
    apiUsageStats: {
        requestsToday: number;
        requestsThisHour: number;
        rateLimitRemaining: number;
    };
}

export interface ApiResponse<T = any> {
    message?: string;
    error?: string;
    details?: any;
    shipment?: T;
    shipments?: T[];
    event?: T;
    events?: T[];
    result?: T;
    affectedCount?: number;
}

// Additional types for filtering and searching
export interface ShipmentFilters {
    status?: ShipmentStatusType[];
    carrier?: CarrierType[];
    customerName?: string;
    customerEmail?: string;
    internalTrackingCode?: string;
    carrierTrackingNumber?: string;
    createdBy?: string;
    dateRange?: {
        start?: Date;
        end?: Date;
    };
    estimatedDeliveryRange?: {
        start?: Date;
        end?: Date;
    };
    apiSyncStatus?: ApiSyncStatusType[];
    needsReview?: boolean;
}

export interface ShipmentSearchParams {
    page?: number;
    perPage?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'estimatedDelivery' | 'customerName' | 'status' | 'carrier';
    sortOrder?: 'asc' | 'desc';
    filters?: ShipmentFilters;
}

export interface ShipmentEventFilters {
    eventType?: EventTypeType[];
    source?: EventSourceType[];
    dateRange?: {
        start?: Date;
        end?: Date;
    };
}

export interface ShipmentEventSearchParams {
    page?: number;
    perPage?: number;
    sortBy?: 'eventTime' | 'recordedAt' | 'eventType';
    sortOrder?: 'asc' | 'desc';
    filters?: ShipmentEventFilters;
}

// Types for lead conversion
export interface ConvertLeadToShipmentRequest {
    // Package Details
    packageDescription?: string;
    weight?: string;
    dimensions?: Dimensions;
    value?: string;

    // Addresses (may override lead data)
    originAddress?: Address;
    destinationAddress?: Address;

    // Shipping Details
    courier: string;
    courierTrackingNumber?: string;
    shippingMethod?: string;

    // Status and Tracking
    estimatedDelivery?: Date;

    // API Integration
    apiTrackingId?: string;

    // Metadata
    notes?: string;
    specialInstructions?: string;
}

export const ConvertLeadToShipmentSchema = z.object({
    // Package Details
    packageDescription: z.string().optional(),
    weight: z.string().optional(),
    dimensions: DimensionsSchema.optional(),
    value: z.string().optional(),

    // Addresses (may override lead data)
    originAddress: AddressSchema.optional(),
    destinationAddress: AddressSchema.optional(),

    // Shipping Details
    courier: z.string().min(1, 'Courier is required'),
    courierTrackingNumber: z.string().optional(),
    shippingMethod: z.string().optional(),

    // Status and Tracking
    estimatedDelivery: z.date().optional(),

    // API Integration
    apiProvider: z.enum(['shipengine', 'manual']).optional(),
    apiTrackingId: z.string().optional(),

    // Metadata
    notes: z.string().optional(),
    specialInstructions: z.string().optional(),
});



// Types for API integration
export interface APITrackingResponse {
    trackingId: string;
    status: string;
    events: APITrackingEvent[];
    estimatedDelivery?: Date;
    actualDelivery?: Date;
}

export interface APITrackingEvent {
    eventType: string;
    status?: string;
    description: string;
    location?: string;
    eventTime: Date;
    metadata?: Record<string, any>;
}

// Types for webhook processing
export interface WebhookPayload {
    trackingId: string;
    events: APITrackingEvent[];
    signature?: string;
    timestamp?: Date;
}

// Types for manual status updates
export interface ManualStatusUpdateRequest {
    status: ShipmentStatusType;
    notes?: string;
    eventTime?: Date;
}

export const ManualStatusUpdateSchema = z.object({
    status: z.enum(['pending', 'in-transit', 'out-for-delivery', 'delivered', 'exception', 'cancelled']),
    notes: z.string().optional(),
    eventTime: z.date().optional(),
});

// Extended shipment type with events
export interface ShipmentWithEvents extends Shipment {
    events: ShipmentEvent[];
}

// Types for bulk operations
export interface BulkUpdateShipmentsRequest {
    shipmentIds: string[];
    updates: Partial<UpdateShipmentRequest>;
}

export interface BulkStatusUpdateRequest {
    shipmentIds: string[];
    status: ShipmentStatusType;
    notes?: string;
}

// Validation schemas for filtering
export const ShipmentFiltersSchema = z.object({
    status: z.array(z.enum(['pending', 'in-transit', 'out-for-delivery', 'delivered', 'exception', 'cancelled'])).optional(),
    carrier: z.array(CarrierSchema).optional(),
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    internalTrackingCode: z.string().optional(),
    carrierTrackingNumber: z.string().optional(),
    createdBy: z.string().optional(),
    dateRange: z.object({
        start: z.date().optional(),
        end: z.date().optional(),
    }).optional(),
    estimatedDeliveryRange: z.object({
        start: z.date().optional(),
        end: z.date().optional(),
    }).optional(),
    apiSyncStatus: z.array(ApiSyncStatusSchema).optional(),
    needsReview: z.boolean().optional(),
});

// Bulk ingestion validation schema
export const BulkIngestSchema = z.object({
    shipments: z.array(APIShipmentDataSchema).min(1, 'At least one shipment is required'),
    source: z.string().min(1, 'Source is required'),
});





export const ShipmentSearchParamsSchema = z.object({
    page: z.number().int().positive().optional(),
    perPage: z.number().int().positive().max(100).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'estimatedDelivery', 'customerName', 'status', 'carrier']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    filters: ShipmentFiltersSchema.optional(),
});

// Constants for internal tracking code generation
export const INTERNAL_TRACKING_CODE_PREFIX = 'SC';
export const INTERNAL_TRACKING_CODE_LENGTH = 11; // SC + 9 digits
export const INTERNAL_TRACKING_CODE_PATTERN = /^SC\d{9}$/;

// Helper function types
export type TrackingCodeGenerator = () => Promise<string>;
export type ShipmentValidator = (shipment: Partial<Shipment>) => Promise<boolean>;
export type AddressFormatter = (address: Address) => string;

// Type guard and helper functions for database mapping
export function isValidCarrier(carrier: string | null): carrier is CarrierType {
    if (!carrier) return false;
    return Object.values(Carrier).includes(carrier as CarrierType);
}

export function isValidApiSyncStatus(status: string | null): status is ApiSyncStatusType {
    if (!status) return false;
    return Object.values(ApiSyncStatus).includes(status as ApiSyncStatusType);
}

// Database row type (what comes from the database)
export interface ShipmentRow {
    id: string;
    internalTrackingCode: string;
    leadId?: string | null;
    carrier: string;
    carrierTrackingNumber: string;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    packageDescription?: string | null;
    weight?: string | null;
    dimensions?: string | null; // JSON string
    value?: string | null;
    originAddress?: string | null; // JSON string
    destinationAddress?: string | null; // JSON string
    status: string;
    estimatedDelivery?: Date | null;
    actualDelivery?: Date | null;
    lastApiSync?: Date | null;
    apiSyncStatus: string;
    apiError?: string | null;
    notes?: string | null;
    needsReview: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

// Service layer interfaces (for implementation reference)
export interface ShipmentServiceInterface {
    // Shipment Management
    createShipment(trackingNumber: string, carrier: CarrierType, adminId: string): Promise<Shipment>;
    updateShipment(shipmentId: string, updates: Partial<Shipment>): Promise<Shipment>;
    deleteShipment(shipmentId: string): Promise<void>;

    // Query and Retrieval
    getShipments(filters: ShipmentFilters): Promise<PaginatedShipments>;
    getShipmentById(shipmentId: string): Promise<Shipment>;
    getShipmentByInternalCode(internalCode: string): Promise<Shipment>;

    // Public Tracking
    getPublicTrackingInfo(internalCode: string): Promise<PublicTrackingInfo>;
}

export interface TrackingServiceInterface {
    generateInternalTrackingCode(): Promise<string>;
    syncShipmentWithAPI(shipmentId: string): Promise<void>;
    syncAllActiveShipments(): Promise<SyncResult[]>;
    getTrackingEvents(shipmentId: string): Promise<TrackingEvent[]>;
}

export interface ThirdPartyAPIServiceInterface {
    fetchShipmentDetails(trackingNumber: string, carrier: CarrierType): Promise<ShipmentDetails>;
    getTrackingUpdates(trackingNumber: string, carrier: CarrierType): Promise<TrackingEvent[]>;
    validateTrackingNumber(trackingNumber: string, carrier: CarrierType): Promise<boolean>;
}

// Sync result interface for background jobs
export interface SyncResult {
    shipmentId: string;
    success: boolean;
    error?: string;
    updatedAt: Date;
}



// Status transition validation
export const VALID_STATUS_TRANSITIONS: Record<ShipmentStatusType, ShipmentStatusType[]> = {
    'pending': ['in-transit', 'cancelled'],
    'in-transit': ['out-for-delivery', 'delivered', 'exception', 'cancelled'],
    'out-for-delivery': ['delivered', 'exception', 'in-transit'],
    'delivered': [], // Terminal state
    'exception': ['in-transit', 'out-for-delivery', 'cancelled'],
    'cancelled': [], // Terminal state
};

// Courier configuration type
export interface CourierConfig {
    name: string;
    apiEndpoint?: string;
    apiKey?: string;
    trackingUrlTemplate?: string;
    supportedServices: string[];
    defaultService?: string;
}

// Error types for shipment operations
export class ShipmentError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ShipmentError';
    }
}

export class TrackingCodeError extends ShipmentError {
    constructor(message: string, details?: any) {
        super(message, 'TRACKING_CODE_ERROR', details);
    }
}

export class InvalidStatusTransitionError extends ShipmentError {
    constructor(from: ShipmentStatusType, to: ShipmentStatusType) {
        super(
            `Invalid status transition from ${from} to ${to}`,
            'INVALID_STATUS_TRANSITION',
            { from, to }
        );
    }
}

export class APIIntegrationError extends ShipmentError {
    constructor(message: string, provider: string, details?: any) {
        super(message, 'API_INTEGRATION_ERROR', { provider, ...details });
    }
}