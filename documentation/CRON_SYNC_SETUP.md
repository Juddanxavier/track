# Periodic Sync Cron Job Setup

This document explains how to set up and use the periodic sync cron job for automatic shipment tracking updates.

## Overview

The `/api/cron/sync-tracking` endpoint provides automated background syncing of shipment tracking data from carrier APIs. It implements intelligent retry logic with exponential backoff and respects carrier API rate limits.

## Features

- **Automatic Sync**: Periodically syncs all active shipments (not delivered/cancelled)
- **Exponential Backoff**: Failed syncs are retried with increasing delays (5min → 15min → 45min → 2hr → 6hr)
- **Rate Limiting**: Respects carrier API quotas with appropriate delays between calls
- **Smart Filtering**: Only syncs shipments that haven't been updated recently or need retry
- **Comprehensive Logging**: Detailed sync results and error tracking

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Optional: Secret token for cron job authentication
CRON_SECRET=your-secure-random-token-here

# Required: Carrier API credentials (if not already set)
UPS_API_KEY=your-ups-api-key
FEDEX_API_KEY=your-fedex-api-key
DHL_API_KEY=your-dhl-api-key
USPS_API_KEY=your-usps-api-key
```

### 2. Cron Job Configuration

#### Option A: Using cron (Linux/macOS)

Add to your crontab (`crontab -e`):

```bash
# Sync every 30 minutes
*/30 * * * * curl -X POST -H "Authorization: Bearer your-cron-secret" https://your-domain.com/api/cron/sync-tracking

# Sync every hour
0 * * * * curl -X POST -H "Authorization: Bearer your-cron-secret" https://your-domain.com/api/cron/sync-tracking
```

#### Option B: Using Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-tracking",
      "schedule": "0 */1 * * *"
    }
  ]
}
```

#### Option C: Using GitHub Actions

Create `.github/workflows/sync-tracking.yml`:

```yaml
name: Sync Tracking Data
on:
  schedule:
    - cron: '0 */1 * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/sync-tracking
```

#### Option D: Using External Services

- **Uptime Robot**: Set up HTTP monitor with POST request
- **Cronitor**: Create HTTP cron job
- **EasyCron**: Schedule HTTP POST request

## Usage

### Manual Testing

Test the endpoint manually:

```bash
# Without authentication
curl -X POST http://localhost:3000/api/cron/sync-tracking

# With authentication
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/sync-tracking
```

### Using the Test Script

Run the included test script:

```bash
npx tsx scripts/test-cron-sync.ts
```

## Sync Logic

### Shipment Selection

The cron job syncs shipments that meet ALL of these criteria:

1. **Active Status**: `pending`, `in-transit`, `out-for-delivery`, or `exception`
2. **Has Tracking Data**: Both `carrierTrackingNumber` and `carrier` are present
3. **Needs Update**: One of the following:
   - Never been synced before
   - Last successful sync was more than 1 hour ago
   - Failed sync with expired backoff period

### Exponential Backoff

Failed syncs are retried with increasing delays:

| Attempt | Delay | Description |
|---------|-------|-------------|
| 1st | 5 minutes | Quick retry for temporary issues |
| 2nd | 15 minutes | Short delay for minor problems |
| 3rd | 45 minutes | Medium delay for API issues |
| 4th | 2 hours | Longer delay for persistent problems |
| 5th+ | 6 hours | Maximum delay for chronic failures |

### Rate Limiting

API calls are spaced out to respect carrier limits:

| Carrier | Delay Between Calls |
|---------|-------------------|
| UPS | 2 seconds |
| FedEx | 3 seconds |
| DHL | 4 seconds |
| USPS | 1 second |

## Response Format

### Success Response

```json
{
  "message": "Periodic sync completed. 5 successful, 1 failed, 2 skipped.",
  "result": {
    "totalShipments": 8,
    "successful": 5,
    "failed": 1,
    "skipped": 2,
    "results": [
      {
        "shipmentId": "ship_123",
        "success": true,
        "eventsAdded": 3,
        "statusUpdated": true,
        "carrier": "ups",
        "trackingNumber": "1Z999AA1234567890",
        "lastSync": "2024-01-15T10:30:00.000Z"
      }
    ],
    "startedAt": "2024-01-15T10:30:00.000Z",
    "completedAt": "2024-01-15T10:32:15.000Z",
    "duration": 135000
  }
}
```

### Error Response

```json
{
  "error": "Failed to perform periodic sync",
  "details": "Database connection failed"
}
```

## Monitoring

### Logs

The cron job produces detailed console logs:

```
Starting periodic sync job for active shipments
Found 8 shipments that need syncing
Syncing shipment 1/8: ship_123
Rate limiting: waiting 2000ms before next API call
Periodic sync completed for shipment ship_123: 3 new events added, status updated
Periodic sync job completed: 5 successful, 1 failed, 2 skipped out of 8 total
```

### Database Events

Each sync operation creates tracking events in the database:

- **Success**: "Periodic sync completed successfully. X new events added."
- **Failure**: "Periodic sync failed: [error message]"

### Monitoring Queries

Check sync health with these database queries:

```sql
-- Recent sync activity
SELECT 
  COUNT(*) as total_syncs,
  SUM(CASE WHEN api_sync_status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN api_sync_status = 'failed' THEN 1 ELSE 0 END) as failed
FROM shipments 
WHERE last_api_sync > NOW() - INTERVAL '24 hours';

-- Shipments needing attention
SELECT id, carrier, carrier_tracking_number, api_error, last_api_sync
FROM shipments 
WHERE needs_review = true 
ORDER BY last_api_sync DESC;

-- Sync frequency by carrier
SELECT 
  carrier,
  COUNT(*) as shipments,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_api_sync))/3600) as avg_hours_since_sync
FROM shipments 
WHERE status IN ('pending', 'in-transit', 'out-for-delivery', 'exception')
GROUP BY carrier;
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check `CRON_SECRET` environment variable
   - Verify Authorization header format

2. **No Shipments Synced**
   - Check if shipments have required tracking data
   - Verify shipment statuses are active
   - Check last sync timestamps

3. **API Rate Limiting**
   - Increase delays in `getCarrierDelay()` function
   - Check carrier API quotas and limits

4. **High Failure Rate**
   - Check carrier API credentials
   - Verify network connectivity
   - Review API error messages in logs

### Performance Optimization

- **Batch Size**: The cron job processes all eligible shipments. For large volumes, consider implementing batching.
- **Parallel Processing**: Currently sequential to respect rate limits. Consider parallel processing with proper rate limiting.
- **Database Indexing**: Ensure indexes on `status`, `last_api_sync`, and `api_sync_status` columns.

## Security Considerations

1. **Authentication**: Use `CRON_SECRET` to prevent unauthorized access
2. **Rate Limiting**: Built-in delays prevent API abuse
3. **Error Handling**: Sensitive API details are not exposed in responses
4. **Logging**: Avoid logging sensitive data like API keys

## Best Practices

1. **Frequency**: Run every 30-60 minutes for most use cases
2. **Monitoring**: Set up alerts for high failure rates
3. **Maintenance**: Regularly review and clean up old tracking events
4. **Testing**: Use the test script before deploying changes
5. **Backup**: Ensure database backups before major updates