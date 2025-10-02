#!/usr/bin/env tsx
/** @format */

/**
 * Lead Cleanup Setup Script
 * 
 * This script helps set up the lead cleanup system for different deployment environments.
 * It provides guidance and generates configuration files for various scheduling options.
 * 
 * Usage:
 *   npx tsx scripts/setup-cleanup.ts
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { leadCleanupService } from '../src/lib/leadCleanupService';

interface SetupOptions {
    environment: 'server' | 'vercel' | 'github-actions' | 'external';
    cronSecret?: string;
    schedule?: string;
}

function generateCronSecret(): string {
    return Array.from({ length: 32 }, () =>
        Math.random().toString(36).charAt(2)
    ).join('');
}

function generateServerCrontab(schedule: string = '0 2 * * *'): string {
    const projectPath = process.cwd();
    return `
# Lead Cleanup Cron Job
# Runs daily at 2 AM
${schedule} cd ${projectPath} && npx tsx scripts/cleanup-cron.ts >> /var/log/lead-cleanup.log 2>&1
`;
}

function generateVercelCronConfig(schedule: string = '0 2 * * *'): string {
    return JSON.stringify({
        crons: [
            {
                path: '/api/lead/cleanup/cron',
                schedule: schedule
            }
        ]
    }, null, 2);
}

function generateGitHubAction(cronSecret: string, schedule: string = '0 2 * * *'): string {
    return `name: Lead Cleanup

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '${schedule}'
  workflow_dispatch: # Allow manual triggering

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Lead Cleanup
        run: |
          curl -X POST \\
            -H "Authorization: Bearer \${{ secrets.CRON_SECRET }}" \\
            -H "Content-Type: application/json" \\
            -d '{"force": false}' \\
            "\${{ secrets.APP_URL }}/api/lead/cleanup/cron"
        env:
          CRON_SECRET: \${{ secrets.CRON_SECRET }}
          APP_URL: \${{ secrets.APP_URL }}
`;
}

function generateDockerCompose(schedule: string = '0 2 * * *'): string {
    return `version: '3.8'

services:
  lead-cleanup:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - CRON_SECRET=\${CRON_SECRET}
    command: sh -c "npm install && npx tsx scripts/cleanup-cron.ts"
    restart: "no"
    profiles:
      - cron

# To run the cleanup:
# docker-compose --profile cron run --rm lead-cleanup

# To set up a cron job on the host:
# ${schedule} docker-compose --profile cron run --rm lead-cleanup
`;
}

async function testCleanupSystem(): Promise<boolean> {
    try {
        console.log('🧪 Testing cleanup system...');

        // Test configuration
        const config = await leadCleanupService.getCleanupConfig();
        console.log('✅ Configuration loaded:', {
            isEnabled: config.isEnabled,
            failedLeadRetentionDays: config.failedLeadRetentionDays,
            successLeadArchiveDays: config.successLeadArchiveDays,
        });

        // Test dry run
        const leadsToDelete = await leadCleanupService.identifyLeadsForDeletion();
        const leadsToArchive = await leadCleanupService.identifyLeadsForArchival();

        console.log('✅ Dry run completed:', {
            leadsToDelete: leadsToDelete.length,
            leadsToArchive: leadsToArchive.length,
        });

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

async function main() {
    console.log('🚀 Lead Cleanup Setup');
    console.log('====================\n');

    // Test the cleanup system first
    const testPassed = await testCleanupSystem();
    if (!testPassed) {
        console.log('\n❌ Setup aborted due to test failures.');
        process.exit(1);
    }

    console.log('\n📋 Setup Options:');
    console.log('1. Server with traditional cron');
    console.log('2. Vercel with Vercel Cron');
    console.log('3. GitHub Actions');
    console.log('4. External scheduler (API endpoint)');
    console.log('5. Docker Compose');

    // For this script, we'll generate all configurations
    const cronSecret = process.env.CRON_SECRET || generateCronSecret();

    console.log('\n🔐 Cron Secret:');
    if (!process.env.CRON_SECRET) {
        console.log(`Generated new secret: ${cronSecret}`);
        console.log('⚠️  Add this to your .env file: CRON_SECRET=' + cronSecret);
    } else {
        console.log('✅ Using existing CRON_SECRET from environment');
    }

    // Generate configuration files
    const configs = {
        'crontab-example.txt': generateServerCrontab(),
        'vercel.json': generateVercelCronConfig(),
        '.github/workflows/lead-cleanup.yml': generateGitHubAction(cronSecret),
        'docker-compose.cleanup.yml': generateDockerCompose(),
    };

    console.log('\n📁 Generated configuration files:');
    Object.entries(configs).forEach(([filename, content]) => {
        const filepath = join(process.cwd(), filename);
        writeFileSync(filepath, content);
        console.log(`✅ ${filename}`);
    });

    // Generate environment file template
    const envTemplate = `
# Lead Cleanup Configuration
CRON_SECRET=${cronSecret}

# Database (required)
DATABASE_URL=your_database_url_here

# Optional: Email notifications (future feature)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_email@example.com
# SMTP_PASS=your_password
# NOTIFICATION_EMAIL=admin@example.com
`;

    if (!existsSync('.env.cleanup.example')) {
        writeFileSync('.env.cleanup.example', envTemplate);
        console.log('✅ .env.cleanup.example');
    }

    console.log('\n📖 Setup Instructions:');
    console.log('');
    console.log('1. Server Cron:');
    console.log('   - Add the content of crontab-example.txt to your crontab');
    console.log('   - Run: crontab -e');
    console.log('');
    console.log('2. Vercel:');
    console.log('   - Use the generated vercel.json configuration');
    console.log('   - Add CRON_SECRET to your Vercel environment variables');
    console.log('');
    console.log('3. GitHub Actions:');
    console.log('   - The workflow file is ready in .github/workflows/');
    console.log('   - Add CRON_SECRET and APP_URL to your repository secrets');
    console.log('');
    console.log('4. External Scheduler:');
    console.log('   - Use any HTTP-based scheduler to POST to /api/lead/cleanup/cron');
    console.log('   - Include Authorization: Bearer ' + cronSecret);
    console.log('');
    console.log('5. Docker:');
    console.log('   - Use docker-compose.cleanup.yml for containerized execution');
    console.log('');
    console.log('🔍 Testing:');
    console.log('   - Manual test: npx tsx scripts/cleanup-cron.ts');
    console.log('   - API test: curl -X POST -H "Authorization: Bearer ' + cronSecret + '" http://localhost:3000/api/lead/cleanup/cron');
    console.log('');
    console.log('📊 Monitoring:');
    console.log('   - Health check: GET /api/lead/cleanup/cron');
    console.log('   - View logs in the admin interface');
    console.log('');
    console.log('✅ Setup complete! Choose the method that fits your deployment environment.');
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});

main().catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
});