# Cron Job Examples for Shipment Tracking Sync

This document provides examples of how to set up cron jobs for automatic shipment tracking synchronization.

## Basic Cron Job Setup

### 1. Edit your crontab
```bash
crontab -e
```

### 2. Add one of the following entries

#### Sync every 30 minutes (recommended)
```bash
*/30 * * * * cd /path/to/your/app && npm run sync-tracking >> /var/log/shipment-sync.log 2>&1
```

#### Sync every hour
```bash
0 * * * * cd /path/to/your/app && npm run sync-tracking >> /var/log/shipment-sync.log 2>&1
```

#### Sync every 15 minutes during business hours (9 AM - 6 PM, Mon-Fri)
```bash
*/15 9-18 * * 1-5 cd /path/to/your/app && npm run sync-tracking >> /var/log/shipment-sync.log 2>&1
```

#### Force sync once daily at 2 AM
```bash
0 2 * * * cd /path/to/your/app && npm run sync-tracking:force >> /var/log/shipment-sync-daily.log 2>&1
```

## Advanced Examples

### With error handling and notifications
```bash
*/30 * * * * cd /path/to/your/app && (npm run sync-tracking || echo "Shipment sync failed at $(date)" | mail -s "Sync Error" admin@yourcompany.com) >> /var/log/shipment-sync.log 2>&1
```

### With environment-specific configuration
```bash
*/30 * * * * cd /path/to/your/app && NODE_ENV=production npm run sync-tracking >> /var/log/shipment-sync.log 2>&1
```

### Multiple sync schedules
```bash
# Regular sync every 30 minutes
*/30 * * * * cd /path/to/your/app && npm run sync-tracking >> /var/log/shipment-sync.log 2>&1

# Force sync daily at 2 AM
0 2 * * * cd /path/to/your/app && npm run sync-tracking:force >> /var/log/shipment-sync-daily.log 2>&1

# Stats report daily at 8 AM
0 8 * * * cd /path/to/your/app && npm run sync-tracking:stats >> /var/log/shipment-stats.log 2>&1

# Health check every 15 minutes
*/15 * * * * cd /path/to/your/app && npm run sync-health >> /var/log/sync-health.log 2>&1

# Automated recovery check every hour
0 * * * * cd /path/to/your/app && /usr/local/bin/sync-recovery.sh
```

## Docker/Container Examples

### Docker Compose with cron service
```yaml
version: '3.8'
services:
  app:
    # ... your app configuration
    
  sync-cron:
    image: your-app-image
    command: >
      sh -c "
        echo '*/30 * * * * cd /app && npm run sync-tracking >> /var/log/cron.log 2>&1' | crontab - &&
        crond -f
      "
    volumes:
      - ./logs:/var/log
    environment:
      - NODE_ENV=production
      - TRACKING_API_PROVIDER=shipengine
      - SHIPENGINE_API_KEY=${SHIPENGINE_API_KEY}
```

### Kubernetes CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shipment-sync
spec:
  schedule: "*/30 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: your-app-image
            command: ["npm", "run", "sync-tracking"]
            env:
            - name: NODE_ENV
              value: "production"
            - name: TRACKING_API_PROVIDER
              value: "shipengine"
            - name: SHIPENGINE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: tracking-secrets
                  key: api-key
          restartPolicy: OnFailure
```

## Systemd Timer (Alternative to Cron)

### Create service file: `/etc/systemd/system/shipment-sync.service`
```ini
[Unit]
Description=Shipment Tracking Sync
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/path/to/your/app
ExecStart=/usr/bin/npm run sync-tracking
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
```

### Create timer file: `/etc/systemd/system/shipment-sync.timer`
```ini
[Unit]
Description=Run shipment sync every 30 minutes
Requires=shipment-sync.service

[Timer]
OnCalendar=*:0/30
Persistent=true

[Install]
WantedBy=timers.target
```

### Enable and start the timer
```bash
sudo systemctl enable shipment-sync.timer
sudo systemctl start shipment-sync.timer
sudo systemctl status shipment-sync.timer
```

## Monitoring and Logging

### Log rotation configuration (`/etc/logrotate.d/shipment-sync`)
```
/var/log/shipment-sync*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
}
```

### Enhanced Health Monitoring

#### Built-in health check script
```bash
# Basic health check
npm run sync-health

# JSON output for monitoring systems
npm run sync-health:json

# Check for stale shipments
npm run sync-health:stale

# Custom threshold (4 hours)
npx tsx scripts/monitor-sync-health.ts --alert-threshold=4
```

#### Integration with monitoring systems
```bash
#!/bin/bash
# /usr/local/bin/check-shipment-sync-enhanced.sh

cd /path/to/your/app

# Run health check and capture JSON output
HEALTH_OUTPUT=$(npm run sync-health:json 2>/dev/null)
HEALTH_STATUS=$(echo "$HEALTH_OUTPUT" | jq -r '.status')
ALERT_COUNT=$(echo "$HEALTH_OUTPUT" | jq -r '.alerts | length')

case "$HEALTH_STATUS" in
    "healthy")
        echo "OK: Shipment sync system is healthy"
        exit 0
        ;;
    "warning")
        echo "WARNING: Shipment sync has $ALERT_COUNT alerts"
        echo "$HEALTH_OUTPUT" | jq -r '.alerts[]' | sed 's/^/  - /'
        exit 1
        ;;
    "critical")
        echo "CRITICAL: Shipment sync system is in critical state"
        echo "$HEALTH_OUTPUT" | jq -r '.alerts[]' | sed 's/^/  - /'
        exit 2
        ;;
    *)
        echo "UNKNOWN: Unable to determine sync health status"
        exit 3
        ;;
esac
```

#### Automated recovery script
```bash
#!/bin/bash
# /usr/local/bin/sync-recovery.sh

cd /path/to/your/app

# Check health
HEALTH_STATUS=$(npm run sync-health:json 2>/dev/null | jq -r '.status')

if [ "$HEALTH_STATUS" = "critical" ] || [ "$HEALTH_STATUS" = "warning" ]; then
    echo "$(date): Detected sync issues, attempting recovery..."
    
    # Try force sync
    if npm run sync-tracking:force >> /var/log/sync-recovery.log 2>&1; then
        echo "$(date): Force sync completed successfully"
        
        # Verify recovery
        sleep 30
        NEW_STATUS=$(npm run sync-health:json 2>/dev/null | jq -r '.status')
        
        if [ "$NEW_STATUS" = "healthy" ]; then
            echo "$(date): System recovered successfully"
        else
            echo "$(date): Recovery failed, manual intervention required"
            # Send alert to administrators
            echo "Shipment sync recovery failed on $(hostname)" | mail -s "Sync Recovery Failed" admin@yourcompany.com
        fi
    else
        echo "$(date): Force sync failed, manual intervention required"
    fi
fi
```

## Environment Variables

Make sure these environment variables are set in your cron environment:

```bash
# Add to your crontab with 'crontab -e'
TRACKING_API_PROVIDER=shipengine
SHIPENGINE_API_KEY=your_api_key_here
SHIPENGINE_BASE_URL=https://api.shipengine.com
SHIPENGINE_WEBHOOK_SECRET=your_webhook_secret_here
NODE_ENV=production
PATH=/usr/local/bin:/usr/bin:/bin
```

## Troubleshooting

### Common issues and solutions:

1. **Permission denied**: Make sure the cron user has access to your app directory
2. **Command not found**: Use full paths to node/npm or set PATH in crontab
3. **Environment variables not loaded**: Set them in crontab or use a wrapper script
4. **Database connection issues**: Ensure your app can connect to the database from cron context

### Debug cron job:
```bash
# Test the command manually
cd /path/to/your/app && npm run sync-tracking

# Check cron logs
tail -f /var/log/cron.log
tail -f /var/log/shipment-sync.log

# Verify cron is running
sudo systemctl status cron
```