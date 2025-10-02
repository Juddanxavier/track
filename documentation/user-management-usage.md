# User Management API Usage Examples

## API Endpoints

### 1. List Users (GET /api/user)
```typescript
// Get all users with pagination
const response = await userApi.getUsers({
  page: 1,
  perPage: 20,
  q: 'john@example.com', // Search by email or name
  sortBy: 'createdAt',
  sortDir: 'desc'
});

console.log(response.users);
console.log(response.pagination);
```

### 2. Get Single User (GET /api/user/[id])
```typescript
// Get user by ID
const response = await userApi.getUser('user-id-123');
console.log(response.user);
```

### 3. Create User (POST /api/user)
```typescript
// Create new user (admin only)
const newUser = await userApi.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  role: 'customer',
  banned: false
});
```

### 4. Update User (PUT /api/user/[id])
```typescript
// Update user profile
const updatedUser = await userApi.updateUser('user-id-123', {
  name: 'John Smith',
  email: 'johnsmith@example.com',
  role: 'admin' // Only admins can change roles
});
```

### 5. Delete User (DELETE /api/user/[id])
```typescript
// Delete user (admin only)
await userApi.deleteUser('user-id-123');
```

### 6. Ban User (POST /api/user/[id]/ban)
```typescript
// Ban user with reason and optional expiry
await userApi.banUser('user-id-123', {
  reason: 'Violation of terms of service',
  expiresAt: '2024-12-31T23:59:59Z' // Optional
});
```

### 7. Unban User (DELETE /api/user/[id]/ban)
```typescript
// Remove ban from user
await userApi.unbanUser('user-id-123');
```

### 8. Update User Role (PUT /api/user/[id]/role)
```typescript
// Change user role (super-admin only for admin roles)
await userApi.updateUserRole('user-id-123', {
  role: 'admin'
});
```

### 9. Bulk Operations (POST /api/user/bulk)
```typescript
// Ban multiple users
await userApi.bulkAction({
  userIds: ['user-1', 'user-2', 'user-3'],
  action: 'ban',
  data: {
    reason: 'Spam accounts'
  }
});

// Update multiple user roles
await userApi.bulkAction({
  userIds: ['user-1', 'user-2'],
  action: 'updateRole',
  data: {
    role: 'customer'
  }
});

// Delete multiple users
await userApi.bulkAction({
  userIds: ['user-1', 'user-2'],
  action: 'delete'
});
```

### 10. Get User Statistics (GET /api/user/stats)
```typescript
// Get dashboard statistics (admin only)
const stats = await userApi.getStats();
console.log({
  totalUsers: stats.totalUsers,
  activeUsers: stats.activeUsers,
  bannedUsers: stats.bannedUsers,
  verificationRate: stats.verificationRate,
  newUsers: stats.newUsers,
  usersByRole: stats.usersByRole,
  dailyRegistrations: stats.dailyRegistrations
});
```

## Direct API Calls

If you prefer to use fetch directly:

```typescript
// List users
const response = await fetch('/api/user?page=1&perPage=20&q=john');
const data = await response.json();

// Create user
const response = await fetch('/api/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    role: 'customer'
  })
});

// Update user
const response = await fetch('/api/user/user-id-123', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Updated Name'
  })
});

// Ban user
const response = await fetch('/api/user/user-id-123/ban', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reason: 'Terms violation'
  })
});
```

## Error Handling

All API endpoints return consistent error responses:

```typescript
try {
  const user = await userApi.getUser('invalid-id');
} catch (error) {
  console.error(error.message); // "User not found"
}

// Response format for errors:
{
  "error": "Error message",
  "details": [...] // Validation errors if applicable
}
```

## Authentication & Authorization

- **Public**: No endpoints are public
- **User**: Users can view/update their own profile
- **Admin**: Can perform all user management operations
- **Super Admin**: Can assign admin roles and perform all operations

The API automatically checks permissions based on the authenticated user's role.