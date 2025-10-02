/** @format */

import { db } from '@/database/db';
import { sql } from 'drizzle-orm';

async function createLeadIndexes() {
    console.log('Creating indexes for leads table...');

    try {
        // Create indexes for better query performance
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_customer_email_idx ON leads (customer_email)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_customer_name_idx ON leads (customer_name)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_origin_country_idx ON leads (origin_country)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_destination_country_idx ON leads (destination_country)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads (assigned_to)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_customer_id_idx ON leads (customer_id)`);

        // Composite indexes for common query patterns
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at)`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_assigned_to_status_idx ON leads (assigned_to, status)`);

        console.log('✅ Lead indexes created successfully');
    } catch (error) {
        console.error('❌ Error creating lead indexes:', error);
        throw error;
    }
}

// Run the script
createLeadIndexes()
    .then(() => {
        console.log('Lead indexes setup completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to create lead indexes:', error);
        process.exit(1);
    });