# Background Job Implementation for Shipment Tracking Sync

## Overview

This document summarizes the implementation of task 6.4: "Add background job for periodic API synchronization" from the shipment management specification.

## Implementation Summary

### ✅ Core Components Implemented

1. **Sync Script for Regular Tracking Updates**
   - `scripts/sync-shipment-tracking.ts` - Comprehensive background sync script
   - Supports batch processing with configurable concurrency
   - Handles rate limiting and retry logic with exponential backoff
   - Provides multiple execution modes (dry-run, force, specific shipments)

2. **Error Handling for API Failures**
   - Robust error handling throughout the sync process
   - Automatic retry logic with exponential backoff (up to 3 retries)
   - Graceful degradation when API is unavailable
   - Error logging and event recording for audit trails

3. **Logging for Sync Operations and Failures**
   - `src/lib/syncLogger.ts` - Structured logging utility
   - Comprehensive logging throughout sync operations
   - Support for different log levels (info, warn, error, debug)
   - Metadata tracking for debugging and monitoring

### 🔧 Additional Enhancements

4. **Health Monitoring System**
   - `scripts/monitor-sync-health.ts` - Comprehensive health check system
   - Monitors API connectivity, sync activity, stale shipments, and error rates
   - JSON output for integration with monitoring systems
   - Exit codes for automated alerting (0=healthy, 1=warning, 2=critical)

5. **Alerting System**
   - `scripts/sync-alerting.ts` - Multi-channel alerting utility
   - Support for email, Slack, webhook, and console alerts
   - Configurable via environment variables
   - Integration with health monitoring for automated alerts

6. **Enhanced Cron Documentation**
   - Updated `scripts/cron-examples.md` with comprehensive setup examples
   - Includes monitoring, recovery, and alerting configurations
   - Docker and Kubernetes deployment examples
   - Systemd timer alternatives to cron

## NPM Scripts Added

```json
{
  "sync-tracking": "npx tsx scripts/sync-shipment-tracking.ts",
  "sync-tracking:stats": "npx tsx scripts/sync-shipment-tracking.ts --stats",
  "sync-tracking:force": "npx tsx scripts/sync-shipment-tracking.ts --force",
  "sync-health": "npx tsx scripts/monitor-sync-health.ts",
  "sync-health:json": "npx tsx scripts/monitor-sync-health.ts --json",
  "sync-health:stale": "npx tsx scripts/monitor-sync-health.ts --check-stale",
  "sync-alert": "npx tsx scripts/sync-alerting.ts --check-and-alert",
  "sync-alert:test": "npx tsx scripts/sync-alerting.ts --test-alert"
}
```

## Usage Examples

### Basic Sync Operations
```bash
# Regular sync (respects last sync time)
npm run sync-tracking

# Force sync all active shipments
npm run sync-tracking:force

# Sync specific shipments
npx tsx scripts/sync-shipment-tracking.ts --shipments=ship_123,ship_456

# Dry run to see what would be synced
npx tsx scripts/sync-shipment-tracking.ts --dry-run --verbose

# Get sync statistics
npm run sync-tracking:stats
```

### Health Monitoring
```bash
# Basic health check
npm run sync-health

# JSON output for monitoring systems
npm run sync-health:json

# Check for stale shipments
npm run sync-health:stale

# Custom alert threshold
npx tsx scripts/monitor-sync-health.ts --alert-threshold=4
```

### Alerting
```bash
# Check health and send alerts if needed
npm run sync-alert

# Send test alert
npm run sync-alert:test
```

## Cron Job Setup

### Recommended Cron Configuration
```bash
# Sync every 30 minutes
*/30 * * * * cd /path/to/app && npm run sync-tracking >> /var/log/shipment-sync.log 2>&1

# Health check every 15 minutes
*/15 * * * * cd /path/to/app && npm run sync-health >> /var/log/sync-health.log 2>&1

# Daily force sync at 2 AM
0 2 * * * cd /path/to/app && npm run sync-tracking:force >> /var/log/shipment-sync-daily.log 2>&1

# Automated alerting every hour
0 * * * * cd /path/to/app && npm run sync-alert >> /var/log/sync-alerts.log 2>&1
```

## Environment Configuration

### Tracking API Configuration
```bash
TRACKING_API_PROVIDER=shipengine
SHIPENGINE_API_KEY=your_api_key_here
SHIPENGINE_BASE_URL=https://api.shipengine.com
SHIPENGINE_WEBHOOK_SECRET=your_webhook_secret_here
```

### Alerting Configuration
```bash
# Email alerts
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@company.com,ops@company.com
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=your-email@gmail.com
ALERT_SMTP_PASS=your-app-password

# Slack alerts
ALERT_SLACK_ENABLED=true
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_SLACK_CHANNEL=#alerts

# Webhook alerts
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URL=https://your-monitoring-system.com/webhooks/alerts
```

## Key Features

### Sync Script Features
- ✅ Batch processing with configurable concurrency
- ✅ Rate limiting and API throttling
- ✅ Exponential backoff retry logic
- ✅ Dry-run mode for testing
- ✅ Force sync option
- ✅ Specific shipment targeting
- ✅ Comprehensive error handling
- ✅ Detailed logging and statistics
- ✅ Graceful shutdown handling

### Health Monitoring Features
- ✅ API connectivity checks
- ✅ Recent sync activity monitoring
- ✅ Stale shipment detection
- ✅ Error rate analysis
- ✅ JSON output for automation
- ✅ Configurable alert thresholds
- ✅ Exit codes for monitoring systems

### Alerting Features
- ✅ Multi-channel alert support (email, Slack, webhook)
- ✅ Configurable via environment variables
- ✅ Test alert functionality
- ✅ Integration with health monitoring
- ✅ Structured alert messages

## Error Handling Strategy

1. **API Connection Failures**
   - Automatic retry with exponential backoff
   - Graceful degradation to manual mode
   - Comprehensive error logging

2. **Rate Limiting**
   - Built-in rate limit detection and handling
   - Automatic request queuing
   - Configurable rate limit parameters

3. **Database Errors**
   - Transaction rollback on failures
   - Error event logging for audit trails
   - Continuation of sync for other shipments

4. **Network Issues**
   - Timeout handling
   - Connection retry logic
   - Fallback to cached data when available

## Monitoring Integration

The system provides multiple integration points for monitoring:

1. **Exit Codes**: Scripts return appropriate exit codes for monitoring systems
2. **JSON Output**: Health checks provide structured JSON for parsing
3. **Log Files**: Structured logging for log aggregation systems
4. **Webhooks**: Custom webhook integration for monitoring platforms
5. **Metrics**: Detailed statistics for performance monitoring

## Requirements Satisfied

✅ **4.1**: API integration with automatic status updates and error handling  
✅ **4.2**: Comprehensive error handling for API failures with retry logic  
✅ **4.5**: Rate limiting implementation with exponential backoff  

All sub-tasks for task 6.4 have been successfully implemented:
- ✅ Create sync script for regular tracking updates
- ✅ Implement error handling for API failures  
- ✅ Add logging for sync operations and failures

## Next Steps

1. **Deploy to Production**: Set up cron jobs using the provided examples
2. **Configure Monitoring**: Set up health checks and alerting
3. **Test Integration**: Verify API connectivity and sync operations
4. **Monitor Performance**: Use the health monitoring tools to track system performance