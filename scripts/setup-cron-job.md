# Setting Up the Periodic Sync Cron Job

## Quick Setup Guide

### 1. Environment Setup

Add to your `.env` file:
```bash
# Optional: Secure your cron endpoint
CRON_SECRET=your-secure-random-token-here
```

### 2. Test the Endpoint

First, make sure your development server is running:
```bash
npm run dev
```

Then test the cron endpoint:
```bash
# Test without authentication
curl -X POST http://localhost:3000/api/cron/sync-tracking

# Test with authentication (if CRON_SECRET is set)
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/sync-tracking
```

### 3. Production Deployment

#### Option A: Vercel Cron (Recommended)

Create or update `vercel.json`:
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

#### Option B: External Cron Service

Set up a cron job to call your endpoint every hour:
```bash
0 * * * * curl -X POST -H "Authorization: Bearer your-cron-secret" https://your-domain.com/api/cron/sync-tracking
```

### 4. Monitoring

Check the admin dashboard for:
- Shipments with "Needs Review" status
- Recent sync activity in shipment events
- API sync status indicators

### 5. Troubleshooting

If syncs are failing:
1. Check carrier API credentials in environment variables
2. Review error messages in shipment events
3. Verify network connectivity to carrier APIs
4. Check rate limiting and API quotas

## Features Implemented

✅ **Periodic sync job for active shipments**
- Automatically syncs shipments that haven't been updated recently
- Skips delivered and cancelled shipments
- Only processes shipments with valid tracking data

✅ **Exponential backoff for failed syncs**
- 1st retry: 5 minutes
- 2nd retry: 15 minutes  
- 3rd retry: 45 minutes
- 4th retry: 2 hours
- 5th+ retry: 6 hours

✅ **Rate limiting for carrier APIs**
- UPS: 2 second delays
- FedEx: 3 second delays
- DHL: 4 second delays
- USPS: 1 second delays

✅ **Comprehensive logging and error tracking**
- Detailed console logs for monitoring
- Database events for each sync operation
- Error messages stored for failed syncs
- Progress tracking and statistics

✅ **Security and authentication**
- Optional CRON_SECRET for endpoint protection
- Proper error handling without exposing sensitive data
- Input validation and sanitization