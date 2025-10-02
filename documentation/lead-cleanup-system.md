# Lead Lifecycle Management & Cleanup System

This document describes the automated lead cleanup system that manages the lifecycle of leads in the application, including automatic deletion of failed leads and archival of successful leads.

## Overview

The lead cleanup system provides:

- **Automatic Deletion**: Failed leads are automatically deleted after 45 days
- **Automatic Archival**: Successful leads are moved to an archive after a configurable period (default: 90 days)
- **Audit Logging**: All cleanup actions are logged for compliance and monitoring
- **Manual Management**: Admin interface for manual cleanup operations
- **Flexible Scheduling**: Multiple deployment options for automated execution

## Components

### 1. Database Schema

The system extends the existing leads table and adds new tables:

#### Extended Leads Table
- `failed_at`: Timestamp when lead was marked as failed
- `success_at`: Timestamp when lead was marked as successful  
- `archived_at`: Timestamp when lead was archived
- `is_archived`: Boolean flag for archived status

#### New Tables
- `leads_archive`: Stores archived successful leads
- `lead_cleanup_log`: Audit trail of all cleanup actions

### 2. Cleanup Service (`src/lib/leadCleanupService.ts`)

Core service that handles:
- Identifying leads for deletion/archival
- Executing cleanup operations
- Logging all actions
- Configuration management

### 3. API Endpoints

#### Admin Endpoints
- `GET /api/lead/cleanup/status` - Get cleanup configuration
- `PUT /api/lead/cleanup/config` - Update cleanup configuration
- `POST /api/lead/cleanup/run` - Manual cleanup execution (with dry-run option)
- `GET /api/lead/cleanup/log` - View cleanup audit log
- `GET /api/lead/archive` - Browse archived leads

#### Cron Endpoint
- `POST /api/lead/cleanup/cron` - Secure endpoint for external schedulers
- `GET /api/lead/cleanup/cron` - Health check endpoint

### 4. UI Components

#### Admin Interface Components
- **CleanupConfigDialog**: Configure retention periods and enable/disable cleanup
- **ArchivedLeadsView**: Browse and search archived leads
- **CleanupLogView**: View audit trail of cleanup actions
- **ManualCleanupDialog**: Trigger manual cleanup with dry-run option

### 5. Scripts

#### Execution Scripts
- `scripts/cleanup-cron.ts` - Main cleanup execution script
- `scripts/setup-cleanup.ts` - Setup and configuration helper
- `scripts/monitor-cleanup.ts` - Health monitoring and alerting

#### NPM Scripts
```bash
npm run cleanup:run      # Execute cleanup manually
npm run cleanup:setup    # Setup cleanup system
npm run cleanup:monitor  # Check system health
npm run cleanup:health   # Quick health check
```

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL=your_database_url

# Required for external scheduling
CRON_SECRET=your_secure_random_string

# Optional: Future email notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
NOTIFICATION_EMAIL=admin@example.com
```

### Cleanup Configuration

Default settings (configurable via admin interface):
- **Failed Lead Retention**: 45 days
- **Success Lead Archive**: 90 days
- **Cleanup Enabled**: true

## Deployment Options

### 1. Server with Traditional Cron

Best for: Dedicated servers, VPS

```bash
# Setup
npm run cleanup:setup

# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/project && npm run cleanup:run >> /var/log/lead-cleanup.log 2>&1
```

### 2. Vercel with Vercel Cron

Best for: Vercel deployments

1. Add `vercel.json` configuration:
```json
{
  "crons": [
    {
      "path": "/api/lead/cleanup/cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

2. Set environment variable in Vercel dashboard:
   - `CRON_SECRET`: Your secure random string

### 3. GitHub Actions

Best for: Any deployment with GitHub repository

1. The setup script generates `.github/workflows/lead-cleanup.yml`
2. Add repository secrets:
   - `CRON_SECRET`: Your secure random string
   - `APP_URL`: Your application URL

### 4. External Scheduler

Best for: Cloud functions, external cron services

Use any HTTP-based scheduler to POST to `/api/lead/cleanup/cron`:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": false}' \
  "https://your-app.com/api/lead/cleanup/cron"
```

### 5. Docker Compose

Best for: Containerized deployments

```bash
# Run cleanup
docker-compose --profile cron run --rm lead-cleanup

# Setup host cron job
0 2 * * * docker-compose --profile cron run --rm lead-cleanup
```

## Security

### Authentication
- Admin endpoints require admin authentication
- Cron endpoint requires `CRON_SECRET` bearer token
- All operations are logged for audit

### Data Protection
- Archived leads retain all original data
- Deleted leads are permanently removed
- Full audit trail maintained
- Lead data snapshots stored in cleanup log

## Monitoring

### Health Checks

```bash
# Manual health check
npm run cleanup:health

# Detailed monitoring
npm run cleanup:monitor

# Check with custom alert threshold
npx tsx scripts/monitor-cleanup.ts --alert-threshold=48
```

### Health Check Endpoint

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://your-app.com/api/lead/cleanup/cron"
```

Returns system status, configuration, and recent activity.

### Monitoring Integration

The monitoring script can be extended to integrate with:
- Slack/Discord webhooks
- Email notifications
- PagerDuty, Datadog, or other monitoring services
- SMS alerts

## Troubleshooting

### Common Issues

1. **Cleanup not running**
   - Check if cleanup is enabled in configuration
   - Verify cron job is properly scheduled
   - Check authentication (CRON_SECRET)
   - Review cleanup logs for errors

2. **Database connection issues**
   - Verify DATABASE_URL is correct
   - Check database connectivity
   - Ensure database migrations are applied

3. **Permission errors**
   - Verify admin authentication is working
   - Check API endpoint permissions
   - Review server logs for authentication errors

### Debugging

```bash
# Test cleanup system
npm run cleanup:run

# Check system health
npm run cleanup:health

# View detailed monitoring
npm run cleanup:monitor --verbose

# Test API endpoint
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://your-app.com/api/lead/cleanup/cron"
```

### Logs

- **Application logs**: Check Next.js server logs
- **Cleanup logs**: Available in admin interface
- **Cron logs**: Check system cron logs (`/var/log/cron.log`)
- **Custom logs**: Redirect script output to log files

## Best Practices

### Configuration
- Set appropriate retention periods based on business needs
- Enable cleanup in production environments
- Use secure, random CRON_SECRET
- Monitor cleanup activity regularly

### Scheduling
- Run cleanup during low-traffic hours
- Use appropriate scheduling frequency (daily recommended)
- Set up monitoring and alerting
- Test in staging environment first

### Security
- Rotate CRON_SECRET periodically
- Limit access to admin interfaces
- Monitor cleanup logs for suspicious activity
- Use HTTPS for all API endpoints

### Backup
- Backup database before major cleanup operations
- Consider archival strategy for long-term storage
- Test restore procedures
- Document retention policies

## Migration Guide

### From Manual to Automated

1. **Setup**: Run `npm run cleanup:setup`
2. **Test**: Execute manual cleanup with dry-run
3. **Configure**: Set retention periods via admin interface
4. **Deploy**: Choose and implement scheduling method
5. **Monitor**: Set up health checks and alerting

### Upgrading

When upgrading the cleanup system:

1. **Backup**: Create database backup
2. **Migrate**: Run database migrations
3. **Test**: Verify cleanup functionality
4. **Deploy**: Update scheduling configuration if needed
5. **Monitor**: Check system health after deployment

## API Reference

### Cleanup Configuration

```typescript
interface CleanupConfig {
  failedLeadRetentionDays: number;
  successLeadArchiveDays: number;
  isEnabled: boolean;
  lastRunAt?: Date | null;
}
```

### Cleanup Summary

```typescript
interface CleanupSummary {
  deletedCount: number;
  archivedCount: number;
  errors: string[];
  runAt: Date;
}
```

### Archived Lead

```typescript
interface ArchivedLead {
  id: string;
  originalLeadId: string;
  // ... all original lead fields
  archivedAt: Date;
}
```

### Cleanup Log Entry

```typescript
interface CleanupLogEntry {
  id: string;
  leadId: string;
  action: 'deleted' | 'archived';
  reason: string;
  performedAt: Date;
  leadData?: string; // JSON snapshot
}
```

## Support

For issues or questions:

1. Check this documentation
2. Review application logs
3. Use monitoring tools
4. Test with dry-run operations
5. Contact system administrator

---

*This documentation covers the complete lead lifecycle management and cleanup system. Keep it updated as the system evolves.*