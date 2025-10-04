# Notification API Endpoints

This document describes the notification system API endpoints that have been implemented.

## Authentication

All endpoints require authentication via session cookies. Users can only access their own notifications, except for admin-only endpoints.

## Endpoints

### GET /api/notifications
Fetch user notifications with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Items per page (default: 20, max: 100)
- `unreadOnly` (optional): Filter to unread notifications only (default: false)
- `type` (optional): Filter by notification type

**Response:**
```json
{
  "notifications": [...],
  "unreadCount": 5,
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 50,
    "hasNext": true
  }
}
```

### POST /api/notifications
Create a new notification (admin only).

**Request Body:**
```json
{
  "userId": "user-id", // or "userIds": ["user1", "user2"]
  "type": "notification_type",
  "title": "Optional title",
  "message": "Optional message",
  "data": { "key": "value" },
  "actionUrl": "/optional/url",
  "priority": "normal", // low, normal, high, urgent
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### PATCH /api/notifications/[id]
Mark a specific notification as read.

### DELETE /api/notifications/[id]
Delete a specific notification.

### POST /api/notifications/mark-all-read
Mark all notifications as read for the current user.

### GET /api/notifications/unread-count
Get the unread notification count for the current user.

**Response:**
```json
{
  "unreadCount": 5
}
```

### GET /api/notifications/recent
Get the 5 most recent notifications for dropdown display.

**Response:**
```json
{
  "notifications": [...]
}
```

## Notification Preferences

### GET /api/notifications/preferences
Get all notification preferences for the current user.

### PUT /api/notifications/preferences
Update notification preferences (bulk or single).

**Bulk Update Request:**
```json
{
  "preferences": [
    {
      "type": "user_registered",
      "enabled": true,
      "emailEnabled": false
    }
  ]
}
```

**Single Update Request:**
```json
{
  "type": "user_registered",
  "enabled": true,
  "emailEnabled": false
}
```

### GET /api/notifications/preferences/[type]
Get a specific notification preference.

### PUT /api/notifications/preferences/[type]
Update a specific notification preference.

## Real-time Notifications (SSE)

### GET /api/notifications/sse
Server-Sent Events endpoint for real-time notifications with enhanced connection management.

**Features:**
- User-specific message routing
- Automatic connection cleanup on disconnect
- Heartbeat monitoring with timeout detection
- Enhanced error handling and reconnection support
- Connection metadata tracking (user agent, IP address)

**Usage:**
```javascript
const eventSource = new EventSource('/api/notifications/sse');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'connection':
      // Connection established
      console.log('Connected:', data.message, data.connectionId);
      break;
    case 'notification':
      // New notification received
      console.log('New notification:', data.data);
      break;
    case 'unread_count_update':
      // Unread count changed
      console.log('Unread count:', data.data.unreadCount);
      break;
    case 'notification_read':
      // Notification marked as read
      console.log('Notification read:', data.data.notificationId);
      break;
    case 'system_message':
      // System-wide broadcast message
      console.log('System message:', data.data.message, data.data.messageType);
      break;
    case 'connection_status':
      // Connection status update
      console.log('Connection status:', data.data.status);
      break;
    case 'heartbeat':
      // Connection keepalive
      break;
  }
};

eventSource.onerror = function(event) {
  console.error('SSE connection error:', event);
  // Connection will automatically attempt to reconnect
};
```

## Broadcasting System

### GET /api/notifications/stats
Get comprehensive SSE connection statistics (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "broadcasting": {
      "isHealthy": true,
      "timestamp": "2024-01-01T12:00:00Z"
    },
    "connections": {
      "total": 25,
      "uniqueUsers": 15,
      "connectionsPerUser": {
        "user1": 2,
        "user2": 1
      }
    },
    "performance": {
      "averageConnectionsPerUser": "1.67",
      "activeUsers": 15
    }
  }
}
```

### POST /api/notifications/stats/broadcast
Send test broadcast message to all connected users (admin only).

**Request Body:**
```json
{
  "message": "System maintenance in 5 minutes",
  "type": "warning"
}
```

### GET /api/notifications/connections
Get connection information for current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-id",
    "activeConnections": 2,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### DELETE /api/notifications/connections
Disconnect all SSE connections for current user.

### GET /api/notifications/connections/[userId]
Get connection information for specific user (admin only).

### DELETE /api/notifications/connections/[userId]
Disconnect all SSE connections for specific user (admin only).

### POST /api/notifications/connections/[userId]
Send test message to specific user (admin only).

**Request Body:**
```json
{
  "messageType": "test_message",
  "data": {
    "customField": "value"
  }
}
```

## Testing Endpoints

### GET /api/notifications/test-broadcast
Get available broadcasting test types.

### POST /api/notifications/test-broadcast
Test the notification broadcasting system.

**Available Test Types:**
- `health_check`: Test health check functionality
- `connection_stats`: Test connection statistics retrieval
- `user_connections`: Test user-specific connection count
- `send_test_notification`: Send test notification to current user
- `send_unread_count`: Send test unread count update
- `broadcast_system_message`: Test system-wide broadcast (admin only)

**Request Body:**
```json
{
  "testType": "send_test_notification"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden (admin required)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include a JSON object with an `error` field and optional `details` for validation errors.