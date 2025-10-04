# Implementation Plan

- [x] 1. Set up database schema and types
  - Add notification tables to database schema with proper indexes
  - Create TypeScript interfaces for notification system
  - Generate and run database migrations
  - _Requirements: 8.1, 8.2_

- [x] 1.5. Remove Socket.IO dependencies and setup SSE utilities






  - Remove socket.io and socket.io-client packages from package.json
  - Create SSE utility functions and TypeScript types
  - Add SSE connection management utilities
  - _Requirements: 7.1, 7.2_

- [x] 2. Create core notification service layer








  - [x] 2.1 Implement NotificationService class with CRUD operations


    - Write service class for creating, reading, updating notifications
    - Implement user preference management methods
    - Add notification template handling
    - _Requirements: 7.1, 7.2, 6.1_
  
  - [x] 2.2 Create notification event handlers and triggers


    - Write event handlers for user registration, lead conversion, admin actions
    - Implement role-based notification filtering logic
    - Add notification template rendering system
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [x] 3. Build API endpoints for notification system





  - [x] 3.1 Create notification CRUD API routes


    - Implement GET /api/notifications for fetching user notifications
    - Create POST /api/notifications for creating notifications
    - Add PATCH /api/notifications/[id] for marking as read
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [x] 3.2 Implement notification preferences API


    - Create GET/PUT /api/notifications/preferences endpoints
    - Add validation for preference updates
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 3.3 Build SSE endpoint for real-time delivery





    - Implement /api/notifications/sse endpoint with SSE streaming
    - Add authentication middleware for SSE connections
    - Create user connection management and cleanup
    - Implement notification broadcasting to SSE connections
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.2_
-

- [x] 4. Create notification UI components



-

  - [x] 4.1 Build enhanced NotificationBell component with animated badge




    - Create bell icon component with animated unread count badge
    - Implement badge styling with red circle, white text, and "99+" overflow
    - Add pulse animation for new notifications and smooth transitions
    - Implement click handler for dropdown toggle
    - Add real-time badge updates via SSE
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 4.2 Implement NotificationDropdown component


    - Create dropdown showing recent 5 notifications
    - Add mark as read functionality and "View All" link
    - Implement empty state and loading states
    - _Requirements: 1.3, 2.3_
  
  - [x] 4.3 Create NotificationsPage component


    - Build full notifications page with pagination
    - Add filtering by type and read status
    - Implement bulk actions (mark all as read)
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 4.4 Build NotificationPreferences component


    - Create preferences form with toggle switches
    - Add email notification preferences
    - Implement save functionality with validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Integrate notification system with existing features





  - [x] 5.1 Add notification triggers to user management


    - Integrate notification creation in user registration flow
    - Add notifications for user banning/unbanning actions
    - Hook into user profile update events
    - _Requirements: 3.1, 3.4, 4.2_
  
  - [x] 5.2 Integrate with lead management system


    - Add notifications for lead conversion events
    - Create notifications for lead status changes
    - Integrate with lead assignment actions
    - _Requirements: 3.2, 4.4_
  -

  - [x] 5.3 Add notification bell to app layout with SSE integration




    - Integrate enhanced NotificationBell component into app sidebar header
    - Add SSE connection management at app level
    - Implement notification context provider with SSE client
    - Add connection status indicators and error handling
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 7.1, 7.6_


- [x] 6. Implement SSE real-time notification delivery





  - [x] 6.1 Create SSE client connection management


    - Build client-side SSE connection handler with reconnection logic
    - Implement connection state management and error handling
    - Add automatic reconnection with exponential backoff
    - Create SSE event listeners for notifications
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.4_
  
  - [x] 6.2 Add SSE notification broadcasting system


    - Create server-side SSE connection manager for user connections
    - Implement user-specific message broadcasting
    - Add connection cleanup on client disconnect
    - Create event handlers for notification and read status updates
    - _Requirements: 5.1, 5.2, 5.3, 7.2, 7.3, 7.5_
  
  - [x] 6.3 Add unread count API and real-time updates


    - Create /api/notifications/unread-count endpoint
    - Implement real-time unread count broadcasting via SSE
    - Add optimistic updates for badge count changes
    - Create fallback polling mechanism for connection failures
    - _Requirements: 1.7, 7.3, 7.6_
-

- [x] 7. Create notification templates and seed data




  - [x] 7.1 Implement notification templates system


    - Create default notification templates for all notification types
    - Add template rendering with dynamic data injection
    - Implement role-based template filtering
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_
  
  - [x] 7.2 Create database seeding for notification system


    - Add migration script for notification tables
    - Create seed data for default notification templates
    - Add default notification preferences for existing users
    - _Requirements: 6.1, 7.1, 7.2_

- [ ]* 8. Add comprehensive testing
  - [ ]* 8.1 Write unit tests for notification service
    - Test NotificationService CRUD operations
    - Test event handlers and notification creation logic
    - Test template rendering and role filtering
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 8.2 Write component tests for notification UI
    - Test NotificationBell component interactions
    - Test NotificationDropdown functionality
    - Test NotificationsPage filtering and pagination
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_
  
  - [ ]* 8.3 Write integration tests for API endpoints
    - Test notification CRUD API endpoints
    - Test SSE connection and message delivery
    - Test notification preferences API
    - _Requirements: 2.1, 2.2, 5.1, 6.1_
  
  - [ ] 8.4 Write end-to-end notification flow tests

    - Test complete notification creation to delivery flow
    - Test real-time notification updates in UI
    - Test notification preferences affecting delivery
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

- [x] 9. Clean up SSE implementation and migrate to polling
  - Remove problematic SSE-related files and dependencies
  - Clean up unused SSE utilities, hooks, and components
  - Update documentation to reflect polling-based approach
  - Remove SSE-specific API endpoints that are no longer needed
  - _Requirements: 7.1, 7.2_