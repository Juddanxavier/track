#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function applyNotificationMigration() {
    try {
        console.log('🔄 Applying notification system migration...');

        // Create notifications table
        console.log('📝 Creating notifications table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "notifications" (
                "id" text PRIMARY KEY NOT NULL,
                "user_id" text NOT NULL,
                "type" text NOT NULL,
                "title" text NOT NULL,
                "message" text NOT NULL,
                "data" text,
                "read" boolean DEFAULT false,
                "read_at" timestamp,
                "action_url" text,
                "priority" text DEFAULT 'normal',
                "expires_at" timestamp,
                "created_at" timestamp DEFAULT now() NOT NULL
            )
        `);

        // Create notification_preferences table
        console.log('📝 Creating notification_preferences table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "notification_preferences" (
                "id" text PRIMARY KEY NOT NULL,
                "user_id" text NOT NULL,
                "type" text NOT NULL,
                "enabled" boolean DEFAULT true,
                "email_enabled" boolean DEFAULT false,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            )
        `);

        // Create notification_templates table
        console.log('📝 Creating notification_templates table...');
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "notification_templates" (
                "id" text PRIMARY KEY NOT NULL,
                "type" text NOT NULL,
                "title" text NOT NULL,
                "message" text NOT NULL,
                "default_priority" text DEFAULT 'normal',
                "roles" text,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "notification_templates_type_unique" UNIQUE("type")
            )
        `);

        // Add foreign key constraints
        console.log('📝 Adding foreign key constraints...');
        await db.execute(sql`
            DO $$ BEGIN
                ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" 
                FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await db.execute(sql`
            DO $$ BEGIN
                ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" 
                FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create indexes for notifications table
        console.log('📝 Creating indexes for notifications table...');
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("read")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_priority_idx" ON "notifications" USING btree ("priority")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id","read")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at")`);

        // Create indexes for notification_preferences table
        console.log('📝 Creating indexes for notification_preferences table...');
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_type_idx" ON "notification_preferences" USING btree ("user_id","type")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_idx" ON "notification_preferences" USING btree ("user_id")`);

        // Create indexes for notification_templates table
        console.log('📝 Creating indexes for notification_templates table...');
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "notification_templates_type_idx" ON "notification_templates" USING btree ("type")`);

        console.log('✅ Notification system migration applied successfully!');

    } catch (error) {
        console.error('❌ Error applying notification migration:', error);
        throw error;
    }
}

if (require.main === module) {
    applyNotificationMigration();
}

export { applyNotificationMigration };