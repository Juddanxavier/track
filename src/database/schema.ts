/** @format */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  avatar: text('avatar'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  zipCode: text('zip_code'),
  role: text('role').default('customer'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires').$defaultFn(() => new Date()),
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  stripeCustomerId: text('stripe_customer_id'),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp('updated_at').$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('incomplete'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end'),
  seats: integer('seats'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
});

export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  customerId: text('customer_id').references(() => users.id, { onDelete: 'set null' }),
  originCountry: text('origin_country').notNull(),
  destinationCountry: text('destination_country').notNull(),
  weight: text('weight').notNull(),
  status: text('status').notNull().default('new'),
  notes: text('notes'),
  failureReason: text('failure_reason'),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  contactedAt: timestamp('contacted_at'),
  convertedAt: timestamp('converted_at'),
  failedAt: timestamp('failed_at'),
  successAt: timestamp('success_at'),
  archivedAt: timestamp('archived_at'),
  isArchived: boolean('is_archived').default(false),
  shipmentId: text('shipment_id'),
}, (table) => ({
  // Indexes for better query performance
  statusIdx: index('leads_status_idx').on(table.status),
  createdAtIdx: index('leads_created_at_idx').on(table.createdAt),
  customerEmailIdx: index('leads_customer_email_idx').on(table.customerEmail),
  customerNameIdx: index('leads_customer_name_idx').on(table.customerName),
  originCountryIdx: index('leads_origin_country_idx').on(table.originCountry),
  destinationCountryIdx: index('leads_destination_country_idx').on(table.destinationCountry),
  assignedToIdx: index('leads_assigned_to_idx').on(table.assignedTo),
  customerIdIdx: index('leads_customer_id_idx').on(table.customerId),
  // Indexes for lifecycle tracking
  failedAtIdx: index('leads_failed_at_idx').on(table.failedAt),
  successAtIdx: index('leads_success_at_idx').on(table.successAt),
  archivedAtIdx: index('leads_archived_at_idx').on(table.archivedAt),
  isArchivedIdx: index('leads_is_archived_idx').on(table.isArchived),
  // Composite indexes for common query patterns
  statusCreatedAtIdx: index('leads_status_created_at_idx').on(table.status, table.createdAt),
  assignedToStatusIdx: index('leads_assigned_to_status_idx').on(table.assignedTo, table.status),
  // Composite indexes for cleanup queries
  statusFailedAtIdx: index('leads_status_failed_at_idx').on(table.status, table.failedAt),
  statusSuccessAtIdx: index('leads_status_success_at_idx').on(table.status, table.successAt),
  isArchivedStatusIdx: index('leads_is_archived_status_idx').on(table.isArchived, table.status),
  // Shipment relationship index
  shipmentIdIdx: index('leads_shipment_id_idx').on(table.shipmentId),
}));

export const leadActivities = pgTable('lead_activities', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'created', 'updated', 'status_changed', 'assigned', 'converted', 'deleted'
  field: text('field'), // Field that was changed (e.g., 'status', 'assignedTo', 'customerName')
  oldValue: text('old_value'), // Previous value
  newValue: text('new_value'), // New value
  description: text('description'), // Human-readable description of the change
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Archive table for long-term storage of successful leads
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
}, (table) => ({
  // Indexes for archived leads queries
  originalLeadIdIdx: index('leads_archive_original_lead_id_idx').on(table.originalLeadId),
  archivedAtIdx: index('leads_archive_archived_at_idx').on(table.archivedAt),
  statusIdx: index('leads_archive_status_idx').on(table.status),
  customerEmailIdx: index('leads_archive_customer_email_idx').on(table.customerEmail),
}));

// Audit log for cleanup actions
export const leadCleanupLog = pgTable('lead_cleanup_log', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull(),
  action: text('action').notNull(), // 'deleted' or 'archived'
  reason: text('reason').notNull(),
  performedAt: timestamp('performed_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  leadData: text('lead_data'), // JSON snapshot of lead before action
}, (table) => ({
  // Indexes for cleanup log queries
  performedAtIdx: index('lead_cleanup_log_performed_at_idx').on(table.performedAt),
  actionIdx: index('lead_cleanup_log_action_idx').on(table.action),
  leadIdIdx: index('lead_cleanup_log_lead_id_idx').on(table.leadId),
}));

// Notification system tables
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'user_registered', 'lead_converted', 'system_alert', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data'), // JSON payload for additional context
  read: boolean('read').default(false),
  readAt: timestamp('read_at'),
  actionUrl: text('action_url'), // Optional URL to navigate when clicked
  priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'
  expiresAt: timestamp('expires_at'), // Optional expiration for temporary notifications
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  readIdx: index('notifications_read_idx').on(table.read),
  typeIdx: index('notifications_type_idx').on(table.type),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  priorityIdx: index('notifications_priority_idx').on(table.priority),
  // Composite indexes for common query patterns
  userIdReadIdx: index('notifications_user_id_read_idx').on(table.userId, table.read),
  userIdCreatedAtIdx: index('notifications_user_id_created_at_idx').on(table.userId, table.createdAt),
}));

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // notification type
  enabled: boolean('enabled').default(true),
  emailEnabled: boolean('email_enabled').default(false),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  userIdTypeIdx: index('notification_preferences_user_id_type_idx').on(table.userId, table.type),
  userIdIdx: index('notification_preferences_user_id_idx').on(table.userId),
}));

export const notificationTemplates = pgTable('notification_templates', {
  id: text('id').primaryKey(),
  type: text('type').notNull().unique(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  defaultPriority: text('default_priority').default('normal'),
  roles: text('roles'), // JSON array of roles that should receive this notification
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  typeIdx: index('notification_templates_type_idx').on(table.type),
}));

// Shipment management tables
export const shipments = pgTable('shipments', {
  id: text('id').primaryKey(),
  internalTrackingCode: text('internal_tracking_code').notNull().unique(), // Internal code (SC123456789)
  leadId: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),

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
  status: text('status').notNull().default('pending'), // pending, in-transit, delivered, exception, cancelled
  estimatedDelivery: timestamp('estimated_delivery'),
  actualDelivery: timestamp('actual_delivery'),

  // API Integration
  lastApiSync: timestamp('last_api_sync'),
  apiSyncStatus: text('api_sync_status').default('pending'), // pending, success, failed
  apiError: text('api_error'), // Last API error message

  // Metadata
  notes: text('notes'),
  needsReview: boolean('needs_review').default(false), // Flag for API failures
  createdBy: text('created_by').notNull().references(() => users.id), // Admin user who created
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  // Primary indexes for performance
  internalTrackingCodeIdx: index('shipments_internal_tracking_code_idx').on(table.internalTrackingCode),
  statusIdx: index('shipments_status_idx').on(table.status),
  carrierIdx: index('shipments_carrier_idx').on(table.carrier),
  createdAtIdx: index('shipments_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('shipments_updated_at_idx').on(table.updatedAt),

  // Foreign key indexes
  leadIdIdx: index('shipments_lead_id_idx').on(table.leadId),
  createdByIdx: index('shipments_created_by_idx').on(table.createdBy),

  // Customer search indexes
  customerNameIdx: index('shipments_customer_name_idx').on(table.customerName),
  customerEmailIdx: index('shipments_customer_email_idx').on(table.customerEmail),

  // API integration indexes
  apiSyncStatusIdx: index('shipments_api_sync_status_idx').on(table.apiSyncStatus),
  carrierTrackingNumberIdx: index('shipments_carrier_tracking_number_idx').on(table.carrierTrackingNumber),
  needsReviewIdx: index('shipments_needs_review_idx').on(table.needsReview),

  // Composite indexes for common query patterns
  statusCreatedAtIdx: index('shipments_status_created_at_idx').on(table.status, table.createdAt),
  carrierStatusIdx: index('shipments_carrier_status_idx').on(table.carrier, table.status),
  createdByStatusIdx: index('shipments_created_by_status_idx').on(table.createdBy, table.status),
  apiSyncStatusCreatedAtIdx: index('shipments_api_sync_status_created_at_idx').on(table.apiSyncStatus, table.createdAt),
  needsReviewStatusIdx: index('shipments_needs_review_status_idx').on(table.needsReview, table.status),
}));

export const shipmentEvents = pgTable('shipment_events', {
  id: text('id').primaryKey(),
  shipmentId: text('shipment_id').notNull().references(() => shipments.id, { onDelete: 'cascade' }),

  // Event Details
  eventType: text('event_type').notNull(), // status_change, location_update, delivery_attempt, etc.
  status: text('status'), // New status if this is a status change
  description: text('description').notNull(),
  location: text('location'),

  // Source Information
  source: text('source').notNull(), // 'api', 'manual', 'webhook'
  sourceId: text('source_id'), // API event ID or user ID for manual updates

  // Timestamps
  eventTime: timestamp('event_time').notNull(), // When the event actually occurred
  recordedAt: timestamp('recorded_at').$defaultFn(() => new Date()).notNull(), // When we recorded it

  // Additional Data
  metadata: text('metadata'), // JSON for additional event data
}, (table) => ({
  // Primary indexes for performance
  shipmentIdIdx: index('shipment_events_shipment_id_idx').on(table.shipmentId),
  eventTypeIdx: index('shipment_events_event_type_idx').on(table.eventType),
  sourceIdx: index('shipment_events_source_idx').on(table.source),
  eventTimeIdx: index('shipment_events_event_time_idx').on(table.eventTime),
  recordedAtIdx: index('shipment_events_recorded_at_idx').on(table.recordedAt),

  // Composite indexes for common query patterns
  shipmentIdEventTimeIdx: index('shipment_events_shipment_id_event_time_idx').on(table.shipmentId, table.eventTime),
  shipmentIdRecordedAtIdx: index('shipment_events_shipment_id_recorded_at_idx').on(table.shipmentId, table.recordedAt),
  eventTypeEventTimeIdx: index('shipment_events_event_type_event_time_idx').on(table.eventType, table.eventTime),
  sourceEventTimeIdx: index('shipment_events_source_event_time_idx').on(table.source, table.eventTime),
}));
