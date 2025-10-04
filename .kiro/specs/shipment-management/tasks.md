# Implementation Plan

- [x] 1. Update database schema for simplified tracking workflow

- [x] 1.1 Simplify shipment table schema for tracking-focused workflow
  - Remove user assignment fields (assignedUserId, userAssignmentStatus, etc.)
  - Remove signup management fields (signupToken, signupTokenExpiry, etc.)
  - Add carrier and carrierTrackingNumber fields
  - Add internalTrackingCode field for public tracking
  - Add apiSyncStatus and apiError fields for third-party integration
  - Add needsReview boolean for flagging API failures
  - Update existing schema in src/database/schema.ts
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 1.2 Create database migration for simplified schema
  - Generate migration to remove assignment-related columns
  - Add new carrier and API integration columns
  - Add indexes for carrier and sync status queries
  - Test migration on development database
  - _Requirements: 1.1, 2.1_

- [x] 1.3 Update TypeScript interfaces for simplified workflow
  - Remove assignment-related interfaces and enums
  - Create simplified Shipment interface with carrier fields
  - Add ShipmentDetails interface for third-party API responses
  - Add carrier enum and API sync status enum
  - Update Zod schemas for shipment validation
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Implement third-party API integration services

- [x] 2.1 Create carrier API adapter interfaces
  - Define CarrierAPIAdapter interface for third-party integrations
  - Create UPSAdapter, FedExAdapter, DHLAdapter implementations
  - Add methods for fetching shipment details and tracking events
  - Include tracking number validation by carrier
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2.2 Build ThirdPartyAPIService for carrier integration
  - Implement fetchShipmentDetails method with carrier routing
  - Add getTrackingUpdates method for periodic syncing
  - Include error handling and retry logic for API failures
  - Add rate limiting and quota management
  - _Requirements: 2.1, 2.2, 2.4, 5.4_

- [x] 2.3 Create tracking code generation service
  - Implement generateInternalTrackingCode method
  - Ensure unique code generation with sufficient entropy
  - Add validation to prevent code collisions
  - _Requirements: 1.4_

- [ ]* 2.4 Write unit tests for third-party API services
  - Test carrier API adapters with mock responses
  - Test error handling and retry logic
  - Test tracking code generation and uniqueness
  - _Requirements: 2.1, 2.2, 1.4_

- [x] 3. Build shipment management API endpoints


- [x] 3.1 Create POST /api/shipments endpoint for manual entry
  - Implement shipment creation with tracking number and carrier
  - Add validation for tracking number format by carrier
  - Trigger immediate API fetch for shipment details
  - Generate internal tracking code automatically
  - Return success response with internal tracking code
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.2 Update GET /api/shipments endpoint for admin dashboard
  - Add filtering by carrier, status, and sync status
  - Include pagination and sorting capabilities
  - Add needsReview filter for failed API syncs
  - Return shipment list with status indicators
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 3.3 Create GET /api/shipments/[id] endpoint for details
  - Return complete shipment details including tracking events
  - Include API sync status and error information
  - Add tracking history timeline
  - _Requirements: 3.3, 3.5_

- [x] 3.4 Create PUT /api/shipments/[id] endpoint for updates
  - Allow manual updates to shipment information
  - Add validation for status changes
  - Log manual updates in tracking events
  - _Requirements: 3.5_

- [ ]* 3.5 Write API endpoint tests
  - Test shipment creation with various carriers
  - Test validation and error handling
  - Test filtering and pagination
  - _Requirements: 1.1, 1.2, 3.1, 3.2_
-

- [ ] 4. Implement background sync and tracking updates




- [x] 4.1 Create POST /api/shipments/[id]/sync endpoint


  - Implement manual sync trigger for specific shipment
  - Call appropriate carrier API based on shipment carrier
  - Update shipment details and tracking events
  - Handle API errors and update sync status
  - _Requirements: 2.1, 2.2, 5.1_

- [x] 4.2 Create POST /api/shipments/sync endpoint for bulk sync







  - Implement bulk sync for all active shipments (renamed from sync-all)
  - Add progress tracking and error reporting
  - Respect carrier API rate limits
  - Update sync status for each shipment
  - _Requirements: 5.1, 5.4_

- [x] 4.3 Create POST /api/cron/sync-tracking endpoint for background jobs



  - Implement periodic sync job for active shipments
  - Add exponential backoff for failed syncs
  - Stop syncing delivered shipments
  - Log sync results and errors
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 4.4 Write tests for sync functionality
  - Test manual and automatic sync operations
  - Test error handling and retry logic
  - Test rate limiting and backoff strategies
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 5. Build public tracking interface

- [x] 5.1 Create GET /api/tracking/[internalCode] endpoint
  - Implement public tracking lookup by internal code
  - Return sanitized tracking information for customers
  - Include tracking events timeline
  - Add rate limiting to prevent abuse
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 5.2 Update public tracking page UI
  - Create simple tracking form for internal code entry
  - Display tracking timeline with status updates
  - Show carrier information and estimated delivery
  - Add error handling for invalid codes
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ]* 5.3 Write tests for public tracking
  - Test tracking lookup and data sanitization
  - Test rate limiting and error handling
  - Test UI components and user interactions
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 6. Build admin dashboard UI








- [x] 6.1 Update shipments list page for simplified workflow


  - Remove assignment status indicators and user-related columns
  - Add carrier and sync status columns
  - Implement filtering by carrier, status, and sync status
  - Add "Needs Review" filter for failed API syncs
  - Include quick action buttons for manual sync
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.2 Create shipment creation modal






  - Build form with tracking number input and carrier selection
  - Add real-time validation for tracking number formats
  - Show loading state during API fetch
  - Display success message with internal tracking code
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 6.3 Create shipment details modal


  - Display complete shipment information and tracking history
  - Show API sync status and error details
  - Add manual sync button for failed syncs
  - Include edit capabilities for manual corrections
  - _Requirements: 3.3, 3.5_

- [x] 6.4 Add dashboard statistics


  - Create stats cards for total, active, delivered shipments
  - Add "Needs Review" count for failed API syncs
  - Include recent activity feed
  - _Requirements: 3.1, 3.4_

- [ ]* 6.5 Write UI component tests
  - Test shipment creation form and validation
  - Test filtering and search functionality
  - Test modal interactions and data display
  - _Requirements: 1.1, 3.1, 3.2_

- [ ] 7. Final integration and testing

- [ ] 7.1 Update navigation and admin interface
  - Remove user management and assignment-related navigation
  - Add shipment management focused navigation
  - Update admin dashboard with simplified metrics
  - _Requirements: 3.1_

- [ ] 7.2 Test complete tracking workflow
  - Verify end-to-end functionality from admin entry to public tracking
  - Test third-party API integration and data population
  - Validate background sync and error handling
  - Test public tracking interface and rate limiting
  - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [ ]* 7.3 Write comprehensive integration tests
  - Test complete shipment creation and tracking workflows
  - Test error scenarios and recovery mechanisms
  - Test performance with multiple carriers and high volume
  - Test security measures and rate limiting effectiveness
  - _Requirements: All requirements_