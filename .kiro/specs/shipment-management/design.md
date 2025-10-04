# Design Document

## Overview

The simplified shipment management system provides a streamlined approach to tracking number management with automatic third-party API integration. Admins manually enter tracking numbers with carrier selection, and the system automatically fetches and populates shipment details from third-party tracking APIs. The design emphasizes simplicity and automation, eliminating complex user management while providing efficient tracking capabilities for both admins and customers.

## Architecture

### Tracking-First Design
The system is built around manual tracking number entry with automatic API integration:
- **Admin Entry**: Simple form for tracking number and carrier selection
- **Third-Party APIs**: Automatic fetching of shipment details from carrier APIs
- **Public Tracking**: Simple tracking interface using internal tracking codes
- **Background Sync**: Periodic updates to keep tracking data current

### System Integration
The shipment management system integrates with existing components:
- **Database Layer**: Extends current Drizzle schema with simplified shipment tracking
- **Authentication**: Uses Better Auth for admin access only
- **API Layer**: Follows Next.js patterns with third-party API integration
- **UI Components**: Builds upon shadcn/ui with tracking-focused interfaces
- **Background Jobs**: Periodic sync jobs for tracking updates

### Simplified Data Flow
The system follows a straightforward data flow:
- **Manual Entry**: Admin enters tracking number and selects carrier
- **API Fetch**: System calls third-party API to get shipment details
- **Data Storage**: Shipment information saved to database
- **Public Access**: Customers track using internal tracking codes
- **Auto Sync**: Background jobs keep tracking data updated

## Components and Interfaces

### Database Schema Extensions

#### Shipments Table
```typescript
export const shipments = pgTable('shipments', {
  id: text('id').primaryKey(),
  internalTrackingCode: text('internal_tracking_code').notNull().unique(), // Internal code (SC123456789)
  
  // Carrier Information (admin-entered)
  carrier: text('carrier').notNull(), // UPS, FedEx, DHL, etc.
  carrierTrackingNumber: text('carrier_tracking_number').notNull(),
  
  // Customer Information (from third-party API)
  customerName: text('customer_name'),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  
  // Package Details (from third-party API)
  packageDescription: text('package_description'),
  weight: text('weight'),
  dimensions: text('dimensions'), // JSON: {length, width, height, unit}
  value: text('value'),
  
  // Addresses (from third-party API)
  originAddress: text('origin_address'), // JSON object
  destinationAddress: text('destination_address'), // JSON object
  
  // Status and Tracking (from third-party API)
  status: text('status').notNull().default('pending'),
  estimatedDelivery: timestamp('estimated_delivery'),
  actualDelivery: timestamp('actual_delivery'),
  
  // API Integration
  lastApiSync: timestamp('last_api_sync'),
  apiSyncStatus: text('api_sync_status').default('pending'), // pending, success, failed
  apiError: text('api_error'), // Last API error message
  
  // Metadata
  notes: text('notes'),
  needsReview: boolean('needs_review').default(false), // Flag for API failures
  createdBy: text('created_by').notNull(), // Admin user who created
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
});
```

#### Shipment Events Table
```typescript
export const shipmentEvents = pgTable('shipment_events', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  
  // Event Details
  eventType: text('event_type').notNull(), // status_change, location_update, delivery_attempt, etc.
  status: text('status'), // New status if this is a status change
  description: text('description').notNull(),
  location: text('location'),
  
  // Source Information
  source: text('source').notNull(), // 'api_sync', 'manual', 'admin'
  
  // Timestamps
  eventTime: timestamp('event_time').notNull(), // When the event actually occurred
  recordedAt: timestamp('recorded_at').$defaultFn(() => new Date()).notNull(), // When we recorded it
  
  // Additional Data
  metadata: text('metadata'), // JSON for additional event data
});
```

### API Endpoints

#### Admin Shipment Management
- `POST /api/shipments` - Create shipment with tracking number and carrier
- `GET /api/shipments` - List shipments with filtering and status
- `GET /api/shipments/[id]` - Get shipment details with tracking history
- `PUT /api/shipments/[id]` - Update shipment details manually
- `DELETE /api/shipments/[id]` - Delete shipment record

#### Public Tracking
- `GET /api/tracking/[internalCode]` - Public tracking endpoint (no auth required)

#### Third-Party API Integration
- `POST /api/shipments/[id]/sync` - Manually trigger API sync for specific shipment
- `POST /api/shipments/sync-all` - Trigger sync for all active shipments

#### Background Jobs
- `POST /api/cron/sync-tracking` - Periodic sync job endpoint

### Service Layer Architecture

#### ShipmentService
```typescript
class ShipmentService {
  // Shipment Management
  async createShipment(trackingNumber: string, carrier: string, adminId: string): Promise<Shipment>
  async updateShipment(shipmentId: string, updates: Partial<Shipment>): Promise<Shipment>
  async deleteShipment(shipmentId: string): Promise<void>
  
  // Query and Retrieval
  async getShipments(filters: ShipmentFilters): Promise<PaginatedShipments>
  async getShipmentById(shipmentId: string): Promise<Shipment>
  async getShipmentByInternalCode(internalCode: string): Promise<Shipment>
  
  // Public Tracking
  async getPublicTrackingInfo(internalCode: string): Promise<PublicTrackingInfo>
}
```

#### TrackingService
```typescript
class TrackingService {
  async generateInternalTrackingCode(): Promise<string>
  async syncShipmentWithAPI(shipmentId: string): Promise<void>
  async syncAllActiveShipments(): Promise<SyncResult[]>
  async getTrackingEvents(shipmentId: string): Promise<TrackingEvent[]>
}
```

#### ThirdPartyAPIService
```typescript
class ThirdPartyAPIService {
  async fetchShipmentDetails(trackingNumber: string, carrier: string): Promise<ShipmentDetails>
  async getTrackingUpdates(trackingNumber: string, carrier: string): Promise<TrackingEvent[]>
  async validateTrackingNumber(trackingNumber: string, carrier: string): Promise<boolean>
}
```

#### CarrierAPIAdapters
```typescript
interface CarrierAPIAdapter {
  getShipmentDetails(trackingNumber: string): Promise<ShipmentDetails>
  getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]>
  validateTrackingNumber(trackingNumber: string): Promise<boolean>
}

class UPSAdapter implements CarrierAPIAdapter {
  // UPS-specific implementation
}

class FedExAdapter implements CarrierAPIAdapter {
  // FedEx-specific implementation
}

class DHLAdapter implements CarrierAPIAdapter {
  // DHL-specific implementation
}
```

## Data Models

### Core Data Structures

#### Shipment Model
```typescript
interface Shipment {
  id: string;
  internalTrackingCode: string;
  
  // Carrier Information (admin-entered)
  carrier: string;
  carrierTrackingNumber: string;
  
  // Customer (from third-party API)
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  
  // Package (from third-party API)
  packageDescription?: string;
  weight?: string;
  dimensions?: PackageDimensions;
  value?: string;
  
  // Addresses (from third-party API)
  originAddress?: Address;
  destinationAddress?: Address;
  
  // Status and Tracking
  status: ShipmentStatus;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  
  // API Integration
  lastApiSync?: Date;
  apiSyncStatus: ApiSyncStatus;
  apiError?: string;
  
  // Metadata
  notes?: string;
  needsReview: boolean;
  createdBy: string; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}
```

#### Third-Party API Response Models
```typescript
interface ShipmentDetails {
  // Customer Information
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  
  // Package Information
  packageDescription?: string;
  weight?: string;
  dimensions?: PackageDimensions;
  value?: string;
  
  // Addresses
  originAddress?: Address;
  destinationAddress?: Address;
  
  // Status and Delivery
  status: ShipmentStatus;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  
  // Tracking Events
  events: TrackingEvent[];
}
```

#### Dashboard Models
```typescript
interface ShipmentStats {
  totalShipments: number;
  activeShipments: number;
  deliveredShipments: number;
  needsReview: number;
  recentlyCreated: number;
  apiSyncFailures: number;
}

interface PublicTrackingInfo {
  internalTrackingCode: string;
  carrier: string;
  carrierTrackingNumber: string;
  status: ShipmentStatus;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  events: PublicTrackingEvent[];
}
```

#### Address Model
```typescript
interface Address {
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
```

#### Tracking Event Model
```typescript
interface TrackingEvent {
  id: string;
  shipmentId: string;
  eventType: EventType;
  status?: ShipmentStatus;
  description: string;
  location?: string;
  source: EventSource;
  eventTime: Date;
  recordedAt: Date;
  metadata?: Record<string, any>;
}

interface PublicTrackingEvent {
  eventType: EventType;
  status?: ShipmentStatus;
  description: string;
  location?: string;
  eventTime: Date;
}
```

### Enums and Constants

```typescript
enum ShipmentStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in-transit',
  OUT_FOR_DELIVERY = 'out-for-delivery',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception',
  CANCELLED = 'cancelled'
}

enum ApiSyncStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed'
}

enum Carrier {
  UPS = 'ups',
  FEDEX = 'fedex',
  DHL = 'dhl',
  USPS = 'usps'
}

enum EventType {
  SHIPMENT_CREATED = 'shipment_created',
  STATUS_CHANGE = 'status_change',
  LOCATION_UPDATE = 'location_update',
  DELIVERY_ATTEMPT = 'delivery_attempt',
  EXCEPTION = 'exception',
  API_SYNC = 'api_sync'
}

enum EventSource {
  ADMIN_ACTION = 'admin_action',
  API_SYNC = 'api_sync',
  MANUAL = 'manual'
}
```

## Error Handling

### Shipment Creation Errors
- **400 Bad Request**: Invalid tracking number format or missing carrier
- **409 Conflict**: Duplicate tracking number already exists
- **422 Unprocessable Entity**: Invalid carrier or tracking number combination
- **403 Forbidden**: Insufficient admin permissions
- **500 Internal Server Error**: Database or processing failures

### Third-Party API Errors
- **503 Service Unavailable**: Carrier API temporarily unavailable
- **404 Not Found**: Tracking number not found in carrier system
- **401 Unauthorized**: Invalid API credentials for carrier
- **429 Too Many Requests**: Carrier API rate limit exceeded
- **422 Unprocessable Entity**: Invalid tracking number format for carrier

### Public Tracking Errors
- **404 Not Found**: Invalid internal tracking code
- **429 Too Many Requests**: Public endpoint rate limiting
- **503 Service Unavailable**: Tracking service temporarily down

### Background Sync Errors
- **API Connection Failures**: Retry with exponential backoff
- **Rate Limit Handling**: Respect carrier API quotas and delays
- **Data Inconsistency**: Flag shipments for manual review
- **Timeout Handling**: Graceful degradation for slow APIs

### Data Validation
- **Tracking Number Validation**: Format validation per carrier
- **Carrier Selection**: Validate supported carriers
- **Admin Authentication**: Ensure proper admin access
- **Input Sanitization**: Prevent injection attacks

## Testing Strategy

### Unit Tests
- **Shipment Service**: Test shipment creation, validation, and CRUD operations
- **Third-Party API Service**: Test API calls, response parsing, and error handling
- **Tracking Service**: Test internal code generation and sync logic
- **Public Tracking**: Test tracking code lookup and data sanitization

### Integration Tests
- **Shipment Creation Flow**: Test complete flow from admin entry to API fetch
- **Background Sync**: Test periodic sync jobs and error recovery
- **Public Tracking**: Test end-to-end tracking lookup and display
- **Admin Dashboard**: Test filtering, pagination, and bulk operations

### API Testing
- **Carrier API Integration**: Test with real carrier APIs (sandbox environments)
- **Error Scenarios**: Test API failures, timeouts, and invalid responses
- **Rate Limiting**: Test carrier API quota handling and backoff strategies
- **Public Endpoint**: Test rate limiting and caching for public tracking

### Performance Testing
- **Background Sync**: Test performance with large numbers of active shipments
- **Admin Dashboard**: Test query performance with filtering and pagination
- **Public Tracking**: Test caching effectiveness and response times
- **Concurrent Operations**: Test multiple admin users creating shipments simultaneously

## Security Considerations

### Admin Access Security
- **Authentication**: Restrict shipment creation to authenticated admin users only
- **Authorization**: Implement role-based access control for shipment operations
- **Audit Logging**: Log all admin actions with user ID and timestamp
- **Session Management**: Secure admin session handling and timeout

### Third-Party API Security
- **API Key Management**: Secure storage and rotation of carrier API credentials
- **Rate Limiting**: Respect carrier API quotas and implement backoff strategies
- **Data Validation**: Validate all data received from third-party APIs
- **Error Handling**: Prevent sensitive API information from leaking in error messages

### Public Tracking Security
- **Rate Limiting**: Prevent enumeration attacks on internal tracking codes
- **Data Sanitization**: Return only customer-appropriate information
- **No Admin Data Exposure**: Ensure public tracking doesn't expose admin-only information
- **Tracking Code Entropy**: Ensure internal codes have sufficient randomness to prevent guessing

### Data Protection
- **PII Handling**: Secure handling of customer personal information from APIs
- **Data Retention**: Implement appropriate retention policies for tracking data
- **Access Logging**: Track access to shipment information for compliance
- **Input Sanitization**: Prevent injection attacks through tracking number inputs

### Background Job Security
- **Secure Scheduling**: Protect sync job endpoints from unauthorized access
- **Error Logging**: Log sync failures without exposing sensitive data
- **Resource Limits**: Prevent sync jobs from consuming excessive resources
- **Graceful Degradation**: Handle API failures without system compromise