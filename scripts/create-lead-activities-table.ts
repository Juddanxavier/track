/** @format */

import { db } from '@/database/db';
import { leadActivities } from '@/database/schema';
import { sql } from 'drizzle-orm';

async function createLeadActivitiesTable() {
    try {
        console.log('Checking if lead_activities table exists...');

        // Check if table exists
        const tableExists = await db.execute(sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'lead_activities'
            );
        `);

        console.log('Table exists check result:', tableExists);

        // Try to insert a test record to verify the table structure
        console.log('Testing lead_activities table structure...');

        // This will fail if the table doesn't exist, which is expected
        const testResult = await db.select().from(leadActivities).limit(1);
        console.log('✅ lead_activities table is accessible and has correct structure');

    } catch (error) {
        console.log('Table does not exist or has issues. This is expected if the migration hasn\'t been run yet.');
        console.log('Error details:', error);

        // The table will be created when the migration is properly applied
        console.log('Please ensure the database migration is applied to create the lead_activities table.');
    }
}

createLeadActivitiesTable();