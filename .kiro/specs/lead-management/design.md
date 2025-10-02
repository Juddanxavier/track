# Design Document

## Overview

The lead management system will be built as a comprehensive module that integrates seamlessly with the existing user management infrastructure. It will follow the same architectural patterns, using Drizzle ORM for database operations, Next.js API routes for backend functionality, and the existing DataTable component for consistent UI presentation.

The system will track potential customers through a sales pipeline from initial inquiry to successful conversion, with the ability to later transform successful leads into shipment tracking records.

## Architecture

### Database Layer
- **New Table**: `leads` table in the existing PostgreSQL database
- **Relationships**: Foreign key reference to `users` table for customer assignment
- **Migration**: New Drizzle migration to add the leads table
- **Schema**: Follows existing patterns with proper indexing and constraints

### API Layer
- **RESTful Endpoints**: Following the same pattern as `/api/user/*`
- **Route Structure**: `/api/lead/*` with CRUD operations
- **Authentication**: Reuse existing `isAdmin` helper for authorization
- **Validation**: Zod schemas for request/response validation
- **Error Handling**: Consistent error responses matching user API patterns

### Frontend Layer
- **Page Structure**: `/admin/leads` following the same pattern as `/admin/users`
- **Component Reuse**: Leverage existing DataTable, dialog components, and UI patterns
- **State Management**: Client-side state management using React hooks
- **Form Handling**: Consistent form patterns with validation

## Components and Interfaces

### Database Schema

```typescript
// Addition to src/database/schema.ts
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  customerId: text('customer_id').references(() => users.id, { onDelete: 'set null' }),
  originCountry: text('origin_country').notNull(),
  destinationCountry: text('destination_country').notNull(),
  weight: text('weight').notNull(), // Stored as string to handle various units
  status: text('status').notNull().default('new'), // 'new', 'contacted', 'failed', 'success', 'converted'
  notes: text('notes'),
  failureReason: text('failure_reason'),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  contactedAt: timestamp('contacted_at'),
  convertedAt: timestamp('converted_at'),
  failedAt: timestamp('failed_at'), // Track when lead was marked as failed
  successAt: timestamp('success_at'), // Track when lead was marked as successful
  archivedAt: timestamp('archived_at'), // Track when lead was archived
  isArchived: boolean('is_archived').default(false), // Flag for archived leads
  shipmentId: text('shipment_id'), // For future shipment tracking integration
});

// Archive table for long-term storage
export const leadsArchive = pgTable('leads_archive', {
  id: text('id').primaryKey(),
  originalLeadId: text('original_lead_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  customerId: text('customer_id'),
  originCountry: text('origin_country').notNull(),
  destinationCountry: text('destination_country').notNull(),
  weight: text('weight').notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
  failureReason: text('failure_reason'),
  assignedTo: text('assigned_to'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  contactedAt: timestamp('contacted_at'),
  convertedAt: timestamp('converted_at'),
  failedAt: timestamp('failed_at'),
  successAt: timestamp('success_at'),
  archivedAt: timestamp('archived_at').notNull(),
  shipmentId: text('shipment_id'),
});

// Audit log for cleanup actions
export const leadCleanupLog = pgTable('lead_cleanup_log', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull(),
  action: text('action').notNull(), // 'deleted' or 'archived'
  reason: text('reason').notNull(),
  performedAt: timestamp('performed_at').$defaultFn(() => new Date()).notNull(),
  leadData: text('lead_data'), // JSON snapshot of lead before action
});
```

### Type Definitions

```typescript
// src/types/lead.ts
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
```

### API Client

```typescript
// src/lib/leadApi.ts
class LeadApiClient {
  private baseUrl = '/api/lead';
  
  // Methods following the same pattern as userApi.ts:
  // - getLeads(params?) -> LeadListResponse
  // - getLead(id) -> ApiResponse<Lead>
  // - createLead(data) -> ApiResponse<Lead>
  // - updateLead(id, data) -> ApiResponse<Lead>
  // - deleteLead(id) -> ApiResponse
  // - updateLeadStatus(id, status, reason?) -> ApiResponse<Lead>
  // - convertToShipment(id) -> ApiResponse
  // - getArchivedLeads(params?) -> ArchivedLeadListResponse
  // - runCleanup() -> ApiResponse<CleanupSummary>
  // - getCleanupLog(params?) -> CleanupLogResponse
}

// Cleanup service for automated lifecycle management
class LeadCleanupService {
  // - identifyLeadsForDeletion() -> Lead[]
  // - identifyLeadsForArchival() -> Lead[]
  // - deleteExpiredFailedLeads() -> CleanupResult
  // - archiveSuccessfulLeads() -> CleanupResult
  // - logCleanupAction(leadId, action, reason, leadData) -> void
  // - sendCleanupNotification(summary) -> void
}
```

### UI Components

#### Lead Management Page
- **Location**: `src/app/admin/leads/page.tsx`
- **Features**: DataTable with leads, search/filter functionality, action buttons
- **Layout**: Follows the same structure as user management page

#### Lead Dialogs
- **AddLeadDialog**: Form for creating new leads with customer selection
- **EditLeadDialog**: Form for updating lead information
- **DeleteLeadDialog**: Confirmation dialog for lead deletion
- **ConvertLeadDialog**: Dialog for converting successful leads to shipments

#### DataTable Columns
- Customer Name (with email subtitle)
- Origin → Destination countries
- Weight
- Status (with colored badges)
- Assigned To
- Created Date
- Actions (Edit, Delete, Convert)

## Lead Lifecycle Management

### Automated Cleanup Architecture

The system implements automated lead lifecycle management through a scheduled cleanup service that runs periodically to maintain database hygiene and comply with data retention policies.

#### Cleanup Service Design

```typescript
// src/lib/leadCleanupService.ts
export class LeadCleanupService {
  private readonly FAILED_LEAD_RETENTION_DAYS = 45;
  private readonly SUCCESS_LEAD_ARCHIVE_DAYS = 90; // Configurable
  
  async runScheduledCleanup(): Promise<CleanupSummary> {
    const deletionResults = await this.deleteExpiredFailedLeads();
    const archivalResults = await this.archiveSuccessfulLeads();
    
    const summary = {
      deletedCount: deletionResults.count,
      archivedCount: archivalResults.count,
      errors: [...deletionResults.errors, ...archivalResults.errors],
      runAt: new Date()
    };
    
    await this.sendCleanupNotification(summary);
    return summary;
  }
}
```

#### Cleanup Execution Methods

The system supports multiple cleanup execution approaches for different deployment environments:

**Method 1: Traditional Cron Job (Server Environments)**
```typescript
// scripts/cleanup-cron.ts
import cron from 'node-cron';
import { LeadCleanupService } from '../src/lib/leadCleanupService';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const cleanupService = new LeadCleanupService();
  await cleanupService.runScheduledCleanup();
});
```

**Method 2: API Route + External Scheduler (Cloud/Serverless)**
```typescript
// src/app/api/lead/cleanup/cron/route.ts
export async function POST(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const cleanupService = new LeadCleanupService();
  const result = await cleanupService.runScheduledCleanup();
  return Response.json(result);
}
```

**Trigger Options:**
1. **Server Cron**: Traditional cron job for dedicated servers
2. **Vercel Cron**: Using Vercel's cron job feature
3. **GitHub Actions**: Scheduled workflow to hit cleanup endpoint
4. **External Services**: Uptime monitors, cron services, or cloud schedulers
5. **Manual Execution**: Admin-triggered cleanup via UI

#### Archive Strategy

- **Successful Leads**: Moved to `leads_archive` table after configurable period
- **Failed Leads**: Permanently deleted after 45 days
- **Audit Trail**: All actions logged in `lead_cleanup_log` table
- **Data Integrity**: Full lead snapshot stored before deletion/archival

### API Endpoints for Lifecycle Management

```typescript
// New endpoints for cleanup management
GET /api/lead/cleanup/status - Get cleanup configuration and last run info
POST /api/lead/cleanup/run - Manually trigger cleanup process
GET /api/lead/cleanup/log - Get cleanup audit log with pagination
GET /api/lead/archive - Get archived leads with filtering
PUT /api/lead/cleanup/config - Update cleanup configuration (retention periods)
```

## Data Models

### Lead Status Flow
```
new → contacted → failed/success → converted (success only)
                     ↓         ↓
              (45 days) → DELETE
                              ↓
                        (configurable) → ARCHIVE
```

### Status Definitions
- **new**: Initial lead entry, no contact made
- **contacted**: Lead has been contacted by sales team
- **failed**: Lead did not convert, with optional failure reason
- **success**: Lead agreed to proceed with shipping
- **converted**: Successful lead converted to actual shipment

### Customer Integration
- Leads can be linked to existing customers via `customerId`
- If no customer exists, lead stores customer details directly
- Customer selection dropdown in forms shows existing customers
- Auto-population of customer details when customer is selected

### Weight Handling
- Stored as string to accommodate various units (kg, lbs, tons)
- Frontend validation for numeric values
- Unit selection dropdown in forms

## Error Handling

### API Error Responses
- Consistent error format matching user API patterns
- Proper HTTP status codes (400, 401, 403, 404, 500)
- Detailed validation errors for form submissions
- Graceful handling of database constraints

### Frontend Error Handling
- Toast notifications for success/error messages
- Form validation with inline error display
- Loading states during API operations
- Retry mechanisms for failed requests

### Database Constraints
- Foreign key constraints with proper cascade behavior
- Unique constraints where appropriate
- Not null constraints for required fields
- Check constraints for status values

## Testing Strategy

### API Testing
- Unit tests for API route handlers
- Integration tests for database operations
- Validation testing for request/response schemas
- Authentication and authorization testing

### Frontend Testing
- Component unit tests for dialogs and forms
- Integration tests for lead management page
- User interaction testing with React Testing Library
- Form validation testing

### Database Testing
- Migration testing for schema changes
- Constraint testing for data integrity
- Performance testing for queries with pagination
- Relationship testing between leads and users

### End-to-End Testing
- Complete lead lifecycle testing (create → update → convert)
- User permission testing for admin access
- Cross-browser compatibility testing
- Mobile responsiveness testing

## Integration Points

### User Management Integration
- Reuse existing authentication and authorization
- Customer selection from existing users table
- Admin assignment using existing admin users
- Consistent UI patterns and components

### Future Shipment Integration
- `shipmentId` field prepared for future linking
- Status tracking to support conversion workflow
- Data structure designed to support shipment creation
- API endpoints structured for future expansion

### Existing Infrastructure Reuse
- DataTable component for consistent UI
- Database connection and ORM patterns
- API route structure and middleware
- Form components and validation patterns
- Toast notification system
- Loading states and error handling

### Lifecycle Management Integration
- Scheduled task execution (Node.js cron or external scheduler)
- Email notification system for cleanup summaries
- Configuration management for retention periods
- Audit logging infrastructure
- Archive data access patterns

## Performance Considerations

### Database Optimization
- Proper indexing on frequently queried fields (status, countries, dates)
- Pagination for large lead datasets
- Efficient joins for customer information
- Query optimization for filtering and sorting

### Frontend Optimization
- Lazy loading for large lead lists
- Debounced search functionality
- Optimistic updates for better UX
- Efficient re-rendering with proper React patterns

### Caching Strategy
- API response caching where appropriate
- Client-side state management for frequently accessed data
- Database query optimization with proper indexing
- Static asset optimization for country lists

## Security Considerations

### Access Control
- Admin-only access to lead management
- Role-based permissions for different operations
- Secure API endpoints with proper authentication
- Input validation and sanitization

### Data Protection
- Sensitive customer information handling
- Audit trail for lead modifications
- Secure data transmission (HTTPS)
- Proper error message handling to prevent information leakage

### Input Validation
- Server-side validation for all inputs
- SQL injection prevention through ORM
- XSS prevention in frontend components
- CSRF protection for state-changing operations