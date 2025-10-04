# Notification System - Complete Setup Documentation

## Overview

The notification system has been fully implemented and provides a comprehensive solution for real-time notifications in the application. This document covers the complete setup, including templates, seeding, and management tools.

## Features Implemented

### ✅ Core Functionality
- **Real-time notifications** via Server-Sent Events (SSE)
- **Role-based notification filtering** (admin vs customer)
- **Template-based notification system** with dynamic data injection
- **User notification preferences** management
- **Notification bell with unread count** in the UI
- **Comprehensive notification management** page
- **Database seeding** for default templates and preferences

### ✅ Template System
- **Dynamic template rendering** with Mustache-like syntax
- **Conditional content blocks** (`{{#condition}}...{{/condition}}`)
- **Role-based template filtering**
- **Default templates** for all notification types
- **Template management utilities**

### ✅ Database Schema
- **notifications** table with proper indexing
- **notification_preferences** table for user settings
- **notification_templates** table for template management
- **Foreign key constraints** and cascading deletes
- **Optimized indexes** for performance

## Notification Types

### Admin Notifications
- `user_registered` - New user registration
- `lead_converted` - Lead converted to customer
- `lead_assigned` - Lead assigned to admin
- `user_banned` - User banned/unbanned
- `system_cleanup_completed` - Cleanup operations completed
- `system_error` - Critical system errors
- `bulk_action_completed` - Bulk operations completed

### Customer Notifications
- `account_updated` - Profile updated by admin
- `account_status_changed` - Account status changes
- `lead_status_updated` - Lead status changes
- `welcome` - Welcome message for new users

### Universal Notifications
- `system_maintenance` - Maintenance announcements

## Setup Scripts

### Database Migration
```bash
# Apply notification system tables
npm run notification:migrate
```

### Seeding
```bash
# Seed with TypeScript service (recommended)
npm run notification:seed

# Seed with SQL migration
npm run notification:seed-migration

# Complete setup (migration + seeding)
npm run notification:setup
```

### Template Management
```bash
# List all templates
npm run notification:templates list

# Validate all templates
npm run notification:validate

# Test template rendering
npm run notification:test

# Reinitialize default templates
npm run notification:templates reinit

# Run all template operations
npm run notification:templates all
```

## Template Syntax

The notification system uses a Mustache-like template syntax:

### Basic Variable Substitution
```
Title: "New User Registration"
Message: "A new user {{userName}} ({{userEmail}}) has registered as {{userRole}}"
```

### Conditional Blocks
```
Message: "User {{userName}} has been banned{{#banReason}}: {{banReason}}{{/banReason}}"
```

### Inverted Conditionals
```
Message: "Cleanup completed{{^hasErrors}} successfully{{/hasErrors}}"
```

## Usage Examples

### Creating Notifications from Templates
```typescript
import { notificationTemplateManager } from '@/lib/notificationTemplateManager';

// Create single notification
await notificationTemplateManager.createNotificationFromTemplate(
    userId,
    'user_registered',
    {
        userName: 'John Doe',
        userEmail: 'john@example.com',
        userRole: 'customer'
    },
    {
        actionUrl: '/admin/users',
        priority: 'normal'
    }
);

// Create notifications for multiple users
await notificationTemplateManager.createNotificationsFromTemplate(
    userIds,
    'system_maintenance',
    {
        scheduledAt: 'January 15, 2025 at 2:00 AM UTC',
        duration: '2 hours'
    },
    {
        priority: 'high',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
);
```

### Role-Based Filtering
```typescript
// Check if notification type is allowed for role
const isAllowed = await notificationTemplateManager.isNotificationAllowedForRole(
    'user_registered',
    'admin'
);

// Get all notification types for a role
const adminTypes = await notificationTemplateManager.getNotificationTypesForRole('admin');
```

### Managing User Preferences
```typescript
import { notificationService } from '@/lib/notificationService';

// Create default preferences for new user
await notificationService.createDefaultPreferences(userId, userRole);

// Update specific preference
await notificationService.updateUserPreference(
    userId,
    'user_registered',
    true,  // enabled
    false  // emailEnabled
);

// Get user preferences
const preferences = await notificationService.getUserPreferences(userId);
```

## File Structure

```
src/
├── lib/
│   ├── notificationService.ts              # Core notification service
│   ├── notificationTemplateManager.ts     # Template management
│   ├── notificationBroadcaster.ts         # Real-time broadcasting
│   ├── notificationEventHandlers.ts       # Event handlers
│   └── sseConnectionManager.ts            # SSE connection management
├── components/notifications/
│   ├── NotificationBell.tsx               # Bell icon component
│   ├── NotificationDropdown.tsx           # Dropdown component
│   └── NotificationPreferences.tsx        # Preferences component
├── app/
│   ├── api/notifications/                 # API endpoints
│   └── dashboard/notifications/           # Notifications page
├── types/
│   └── notification.ts                    # TypeScript interfaces
└── database/
    └── schema.ts                          # Database schema

scripts/
├── seed-notification-system.ts           # TypeScript seeding
├── apply-notification-seeding.ts         # SQL migration seeding
├── setup-notification-system.ts          # Complete setup
└── manage-notification-templates.ts      # Template management

migrations/
├── 0006_add_notification_system.sql      # Schema migration
└── 0008_seed_notification_system.sql     # Seeding migration
```

## API Endpoints

### Notification Management
- `GET /api/notifications` - Get user notifications with pagination
- `POST /api/notifications` - Create new notification
- `PATCH /api/notifications/[id]` - Mark notification as read
- `DELETE /api/notifications/[id]` - Delete notification
- `POST /api/notifications/mark-all-read` - Mark all as read
- `GET /api/notifications/recent` - Get recent notifications for dropdown

### Preferences
- `GET /api/notifications/preferences` - Get user preferences
- `PUT /api/notifications/preferences` - Update all preferences
- `PUT /api/notifications/preferences/[type]` - Update specific preference

### Real-time
- `GET /api/notifications/sse` - Server-Sent Events endpoint

## Testing

### Unit Tests (Optional)
The system includes comprehensive testing capabilities:

```bash
# Run notification system tests
npm run test -- notification

# Run with coverage
npm run test:coverage -- notification
```

### Manual Testing
```bash
# Test template rendering
npm run notification:test

# Validate all templates
npm run notification:validate

# Create sample notifications (development only)
npm run notification:seed
```

## Performance Considerations

### Database Optimization
- **Composite indexes** for common query patterns
- **Pagination** for large notification lists
- **Automatic cleanup** of expired notifications
- **Efficient unread count** queries

### Real-time Performance
- **Connection pooling** for SSE connections
- **Memory-efficient** connection tracking
- **Automatic reconnection** with exponential backoff
- **Graceful degradation** when SSE unavailable

### Caching Strategy
- **Template caching** for frequently used templates
- **User preference caching** for active sessions
- **Optimistic updates** for better UX

## Security

### Authentication & Authorization
- **JWT token validation** for all endpoints
- **User-specific data access** only
- **Role-based notification filtering**
- **Rate limiting** on notification creation

### Data Privacy
- **No sensitive data** in notification messages
- **Proper data retention** policies
- **Audit logging** for notification access
- **Cross-user data protection**

## Monitoring & Maintenance

### Health Checks
```bash
# Verify system status
npm run notification:validate

# Check template integrity
npm run notification:test
```

### Maintenance Tasks
```bash
# Update templates
npm run notification:templates reinit

# Clean up expired notifications (automatic via cron)
# Handled by notificationService.cleanupExpiredNotifications()
```

## Troubleshooting

### Common Issues

1. **Templates not found**
   ```bash
   npm run notification:seed
   ```

2. **Preferences missing for users**
   ```bash
   npm run notification:seed-migration
   ```

3. **SSE connection issues**
   - Check browser console for connection errors
   - Verify JWT token validity
   - Check server logs for SSE errors

4. **Template rendering errors**
   ```bash
   npm run notification:test
   ```

### Debug Commands
```bash
# List all templates
npm run notification:templates list

# Validate system
npm run notification:validate

# Check seeding status
npm run notification:seed-migration
```

## Migration from Previous Versions

If upgrading from a previous version:

1. **Run the migration**:
   ```bash
   npm run notification:migrate
   ```

2. **Seed the system**:
   ```bash
   npm run notification:seed
   ```

3. **Verify setup**:
   ```bash
   npm run notification:validate
   ```

## Future Enhancements

### Planned Features
- **Email notifications** (infrastructure ready)
- **Push notifications** for mobile
- **Notification scheduling** for future delivery
- **Advanced template editor** UI
- **Notification analytics** and reporting

### Extensibility
The system is designed for easy extension:
- Add new notification types in `NOTIFICATION_TYPES`
- Create new templates via `NotificationTemplateManager`
- Extend event handlers in `notificationEventHandlers.ts`
- Add new API endpoints following existing patterns

## Support

For issues or questions:
1. Check this documentation
2. Run diagnostic commands (`npm run notification:validate`)
3. Check application logs
4. Review the notification system code in `src/lib/notification*`

---

**Status**: ✅ Complete and Production Ready
**Last Updated**: January 3, 2025
**Version**: 1.0.0