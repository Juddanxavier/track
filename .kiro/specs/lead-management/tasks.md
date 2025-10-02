# Implementation Plan

- [-] 1. Set up database schema and types








  - Add leads table to database schema with proper relationships and constraints
  - Create database migration for the new leads table
  - Define TypeScript interfaces for Lead entities and API requests/responses
  - _Requirements: 1.1, 2.1, 4.1_

- [x] 2. Implement core API infrastructure





- [x] 2.1 Create lead API route handlers


  - Implement GET /api/lead for listing leads with pagination, search, and filtering
  - Implement POST /api/lead for creating new leads with validation
  - Implement GET /api/lead/[id] for retrieving single lead details
  - _Requirements: 1.1, 1.3, 4.1, 4.2, 4.4_



- [x] 2.2 Implement lead update and delete operations

  - Implement PUT /api/lead/[id] for updating lead information
  - Implement DELETE /api/lead/[id] for removing leads with confirmation
  - Add proper error handling and validation for all operations


  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

- [x] 2.3 Implement status management endpoints

  - Create endpoint for updating lead status with timestamp tracking
  - Implement status-specific logic for contacted, failed, and success transitions
  - Add validation for status transitions and required fields
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2.4 Write API unit tests






  - Create unit tests for all CRUD operations
  - Test validation schemas and error handling
  - Test authentication and authorization
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1_

- [x] 3. Create lead API client and utilities





- [x] 3.1 Implement lead API client


  - Create leadApi client following userApi patterns
  - Implement methods for all CRUD operations with proper typing
  - Add error handling and response transformation
  - _Requirements: 4.1, 4.2, 5.1, 6.1_

- [x] 3.2 Create lead utility functions


  - Implement status badge styling and display logic
  - Create country selection utilities and validation
  - Add weight formatting and validation helpers
  - _Requirements: 3.1, 4.2, 8.1_

- [x] 4. Build lead management UI components





- [x] 4.1 Create lead data table columns and configuration


  - Define column structure for lead display with sorting and filtering
  - Implement status badges with appropriate colors and icons
  - Add action buttons for edit, delete, and convert operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.2_

- [x] 4.2 Implement AddLeadDialog component


  - Create form with customer selection dropdown and manual entry option
  - Add origin/destination country selection with validation
  - Implement weight input with unit selection
  - Add form validation and error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_


- [x] 4.3 Implement EditLeadDialog component

  - Create edit form pre-populated with existing lead data
  - Allow updating all lead fields except ID
  - Implement status update functionality with appropriate validations
  - Add notes and failure reason fields for status changes
  - _Requirements: 5.1, 5.2, 5.3, 3.4_

- [x] 4.4 Implement DeleteLeadDialog component


  - Create confirmation dialog following existing patterns
  - Add special warning for successful leads before deletion
  - Implement delete operation with proper error handling
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 4.5 Write component unit tests
  - Test form validation and submission
  - Test dialog interactions and state management
  - Test error handling and loading states
  - _Requirements: 1.1, 4.1, 5.1, 6.1_

- [x] 5. Create lead management page





- [x] 5.1 Implement main leads page layout


  - Create /admin/leads page following user management structure
  - Integrate DataTable component with lead-specific columns
  - Add search and filter functionality for leads
  - Implement pagination and sorting controls
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2_

- [x] 5.2 Add lead management navigation and routing


  - Update admin navigation to include leads section
  - Ensure proper routing and page access controls
  - Add breadcrumb navigation for consistency
  - _Requirements: 8.1, 8.2_


- [x] 5.3 Implement lead filtering and search functionality

  - Add status filter dropdown with multi-select capability
  - Implement country-based filtering for origin and destination
  - Add date range filtering for lead creation and contact dates
  - Create search functionality across customer name, email, and countries
  - _Requirements: 4.4, 4.5_

- [x] 6. Implement lead conversion functionality





- [x] 6.1 Create ConvertLeadDialog component


  - Build dialog for converting successful leads to shipments
  - Pre-populate shipment form with lead data
  - Add conversion confirmation and success handling
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6.2 Implement conversion API endpoint


  - Create POST /api/lead/[id]/convert endpoint
  - Add validation for lead status before conversion
  - Implement shipment record creation (placeholder for future)
  - Update lead status to 'converted' with timestamp
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]* 6.3 Write conversion feature tests
  - Test conversion dialog functionality
  - Test API endpoint validation and error handling
  - Test status updates and data integrity
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7. Add customer integration features





- [x] 7.1 Implement customer selection in lead forms


  - Add customer dropdown with search functionality
  - Implement auto-population of customer details when selected
  - Allow manual entry when no existing customer is found
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7.2 Create customer relationship management


  - Link leads to existing users through customerId field
  - Display customer information in lead details
  - Handle customer updates and relationship maintenance
  - _Requirements: 2.1, 2.2, 2.4, 8.3_

- [x] 8. Implement admin assignment and tracking





- [x] 8.1 Add admin assignment functionality


  - Create admin selection dropdown for lead assignment
  - Implement assignment tracking and history
  - Add assignment filters and views
  - _Requirements: 2.1, 4.4_

- [x] 8.2 Create lead activity tracking


  - Implement timestamp tracking for status changes
  - Add activity log for lead modifications
  - Create audit trail for lead lifecycle
  - _Requirements: 3.1, 3.2, 5.3_

- [x] 9. Finalize integration and polish





- [x] 9.1 Integrate with existing authentication system


  - Ensure admin-only access to lead management
  - Implement proper role-based permissions
  - Add security validation for all operations
  - _Requirements: 8.1, 8.3_

- [x] 9.2 Add error handling and user feedback


  - Implement toast notifications for all operations
  - Add loading states for async operations
  - Create proper error messages and validation feedback
  - _Requirements: 1.4, 4.1, 5.2, 6.3_

- [x] 9.3 Optimize performance and user experience


  - Implement efficient data loading and caching
  - Add debounced search functionality
  - Optimize database queries with proper indexing
  - _Requirements: 4.1, 4.4, 4.5_

- [ ]* 9.4 Create end-to-end tests
  - Test complete lead lifecycle from creation to conversion
  - Test user permissions and access controls
  - Test cross-browser compatibility and responsiveness
  - _Requirements: 1.1, 3.1, 4.1, 7.1_

- [x] 10. Implement lead lifecycle management system





  - Create automated cleanup service for failed and successful leads
  - Implement archive functionality and audit logging
  - Add admin interfaces for managing cleanup operations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_


- [x] 10.1 Extend database schema for lifecycle tracking

  - Add timestamp fields for failedAt, successAt, and archivedAt to leads table
  - Create leads_archive table for storing archived successful leads
  - Create lead_cleanup_log table for audit trail of cleanup actions
  - Add database migration for new schema changes
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 10.2 Implement lead cleanup service


  - Create LeadCleanupService class with methods for identifying expired leads
  - Implement automatic deletion of failed leads after 45 days
  - Implement archival of successful leads after configurable period
  - Add comprehensive logging for all cleanup actions
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 10.3 Create cleanup API endpoints


  - Implement GET /api/lead/cleanup/status for cleanup configuration
  - Create POST /api/lead/cleanup/run for manual cleanup execution
  - Add GET /api/lead/cleanup/log for audit log access
  - Implement GET /api/lead/archive for archived leads retrieval
  - Add PUT /api/lead/cleanup/config for configuration management
  - _Requirements: 8.4, 8.5, 8.6_

- [x] 10.4 Build cleanup management UI components


  - Create CleanupConfigDialog for managing retention periods
  - Implement ArchivedLeadsView for browsing archived leads
  - Add CleanupLogView for viewing audit trail
  - Create manual cleanup trigger button with confirmation
  - _Requirements: 8.5, 8.6_

- [x] 10.5 Implement scheduled cleanup execution


  - Create traditional cron job script for server environments
  - Implement secure API endpoint for external scheduler triggers
  - Add authentication and security validation for cron endpoint
  - Set up error handling and retry logic for failed cleanup operations
  - Implement notification system for cleanup summaries
  - Create monitoring and alerting for cleanup failures
  - _Requirements: 8.1, 8.6_

- [ ]* 10.6 Write lifecycle management tests
  - Test cleanup service logic for identifying expired leads
  - Test archival and deletion operations with data integrity
  - Test API endpoints for cleanup management
  - Test scheduled execution and error handling
  - _Requirements: 8.1, 8.2, 8.3, 8.4_