#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function applyMigration() {
    try {
        console.log('🔄 Applying lead lifecycle migration...');

        // Add lifecycle tracking fields to leads table
        console.log('📝 Adding new columns to leads table...');
        await db.execute(sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "failed_at" timestamp`);
        await db.execute(sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "success_at" timestamp`);
        await db.execute(sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "archived_at" timestamp`);
        await db.execute(sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false`);

        // Create leads_archive table
        console.log('📝 Creating leads_archive table...');
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "leads_archive" (
        "id" text PRIMARY KEY NOT NULL,
        "original_lead_id" text NOT NULL,
        "customer_name" text NOT NULL,
        "customer_email" text NOT NULL,
        "customer_phone" text,
        "customer_id" text,
        "origin_country" text NOT NULL,
        "destination_country" text NOT NULL,
        "weight" text NOT NULL,
        "status" text NOT NULL,
        "notes" text,
        "failure_reason" text,
        "assigned_to" text,
        "created_at" timestamp NOT NULL,
        "updated_at" timestamp NOT NULL,
        "contacted_at" timestamp,
        "converted_at" timestamp,
        "failed_at" timestamp,
        "success_at" timestamp,
        "archived_at" timestamp NOT NULL,
        "shipment_id" text
      )
    `);

        // Create lead_cleanup_log table
        console.log('📝 Creating lead_cleanup_log table...');
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "lead_cleanup_log" (
        "id" text PRIMARY KEY NOT NULL,
        "lead_id" text NOT NULL,
        "action" text NOT NULL,
        "reason" text NOT NULL,
        "performed_at" timestamp NOT NULL,
        "lead_data" text
      )
    `);

        // Create indexes
        console.log('📝 Creating indexes...');
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_failed_at_idx" ON "leads" USING btree ("failed_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_success_at_idx" ON "leads" USING btree ("success_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_archived_at_idx" ON "leads" USING btree ("archived_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_is_archived_idx" ON "leads" USING btree ("is_archived")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_status_failed_at_idx" ON "leads" USING btree ("status","failed_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_status_success_at_idx" ON "leads" USING btree ("status","success_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_is_archived_status_idx" ON "leads" USING btree ("is_archived","status")`);

        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_archive_original_lead_id_idx" ON "leads_archive" USING btree ("original_lead_id")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_archive_archived_at_idx" ON "leads_archive" USING btree ("archived_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_archive_status_idx" ON "leads_archive" USING btree ("status")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "leads_archive_customer_email_idx" ON "leads_archive" USING btree ("customer_email")`);

        await db.execute(sql`CREATE INDEX IF NOT EXISTS "lead_cleanup_log_performed_at_idx" ON "lead_cleanup_log" USING btree ("performed_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "lead_cleanup_log_action_idx" ON "lead_cleanup_log" USING btree ("action")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "lead_cleanup_log_lead_id_idx" ON "lead_cleanup_log" USING btree ("lead_id")`);

        console.log('✅ Migration applied successfully!');

    } catch (error) {
        console.error('❌ Error applying migration:', error);
    }
}

applyMigration();