/** @format */

import { db } from '@/database/db';
import { leads, leadsArchive, leadCleanupLog } from '@/database/schema';
import { and, eq, lt, isNull, not } from 'drizzle-orm';
import { Lead, ArchivedLead, CleanupLogEntry, CleanupSummary, CleanupConfig } from '@/types/lead';
import { nanoid } from 'nanoid';

export class LeadCleanupService {
    private readonly FAILED_LEAD_RETENTION_DAYS = 45;
    private readonly DEFAULT_SUCCESS_LEAD_ARCHIVE_DAYS = 90;

    /**
     * Get cleanup configuration
     */
    async getCleanupConfig(): Promise<CleanupConfig> {
        // For now, return default config. In the future, this could be stored in database
        const lastRunEntry = await db
            .select()
            .from(leadCleanupLog)
            .orderBy(leadCleanupLog.performedAt)
            .limit(1);

        return {
            failedLeadRetentionDays: this.FAILED_LEAD_RETENTION_DAYS,
            successLeadArchiveDays: this.DEFAULT_SUCCESS_LEAD_ARCHIVE_DAYS,
            lastRunAt: lastRunEntry[0]?.performedAt || null,
            isEnabled: true,
        };
    }

    /**
     * Update cleanup configuration
     */
    async updateCleanupConfig(config: Partial<CleanupConfig>): Promise<CleanupConfig> {
        // For now, just return the current config since we don't store it in database yet
        // In the future, this would update a configuration table
        return this.getCleanupConfig();
    }

    /**
     * Identify leads that should be deleted (failed leads older than retention period)
     */
    async identifyLeadsForDeletion(): Promise<Lead[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.FAILED_LEAD_RETENTION_DAYS);

        const expiredLeads = await db
            .select()
            .from(leads)
            .where(
                and(
                    eq(leads.status, 'failed'),
                    not(isNull(leads.failedAt)),
                    lt(leads.failedAt, cutoffDate),
                    eq(leads.isArchived, false)
                )
            );

        return expiredLeads.map(lead => ({
            ...lead,
            status: lead.status as 'new' | 'contacted' | 'failed' | 'success' | 'converted',
            createdAt: new Date(lead.createdAt),
            updatedAt: new Date(lead.updatedAt),
            contactedAt: lead.contactedAt ? new Date(lead.contactedAt) : null,
            convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
            failedAt: lead.failedAt ? new Date(lead.failedAt) : null,
            successAt: lead.successAt ? new Date(lead.successAt) : null,
            archivedAt: lead.archivedAt ? new Date(lead.archivedAt) : null,
            isArchived: lead.isArchived || false,
        }));
    }

    /**
     * Identify leads that should be archived (successful leads older than archive period)
     */
    async identifyLeadsForArchival(archiveDays: number = this.DEFAULT_SUCCESS_LEAD_ARCHIVE_DAYS): Promise<Lead[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - archiveDays);

        const successfulLeads = await db
            .select()
            .from(leads)
            .where(
                and(
                    eq(leads.status, 'success'),
                    not(isNull(leads.successAt)),
                    lt(leads.successAt, cutoffDate),
                    eq(leads.isArchived, false)
                )
            );

        return successfulLeads.map(lead => ({
            ...lead,
            status: lead.status as 'new' | 'contacted' | 'failed' | 'success' | 'converted',
            createdAt: new Date(lead.createdAt),
            updatedAt: new Date(lead.updatedAt),
            contactedAt: lead.contactedAt ? new Date(lead.contactedAt) : null,
            convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
            failedAt: lead.failedAt ? new Date(lead.failedAt) : null,
            successAt: lead.successAt ? new Date(lead.successAt) : null,
            archivedAt: lead.archivedAt ? new Date(lead.archivedAt) : null,
            isArchived: lead.isArchived || false,
        }));
    }

    /**
     * Delete expired failed leads
     */
    async deleteExpiredFailedLeads(): Promise<{ count: number; errors: string[] }> {
        const errors: string[] = [];
        let deletedCount = 0;

        try {
            const leadsToDelete = await this.identifyLeadsForDeletion();

            for (const lead of leadsToDelete) {
                try {
                    // Log the deletion action before deleting
                    await this.logCleanupAction(
                        lead.id,
                        'deleted',
                        `Failed lead older than ${this.FAILED_LEAD_RETENTION_DAYS} days`,
                        lead
                    );

                    // Delete the lead
                    await db.delete(leads).where(eq(leads.id, lead.id));
                    deletedCount++;

                    console.log(`Deleted failed lead ${lead.id} (failed on ${lead.failedAt})`);
                } catch (error) {
                    const errorMsg = `Failed to delete lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = `Failed to identify leads for deletion: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg);
        }

        return { count: deletedCount, errors };
    }

    /**
     * Archive successful leads
     */
    async archiveSuccessfulLeads(archiveDays: number = this.DEFAULT_SUCCESS_LEAD_ARCHIVE_DAYS): Promise<{ count: number; errors: string[] }> {
        const errors: string[] = [];
        let archivedCount = 0;

        try {
            const leadsToArchive = await this.identifyLeadsForArchival(archiveDays);

            for (const lead of leadsToArchive) {
                try {
                    // Create archived lead record
                    const archivedLead: Omit<ArchivedLead, 'id'> = {
                        originalLeadId: lead.id,
                        customerName: lead.customerName,
                        customerEmail: lead.customerEmail,
                        customerPhone: lead.customerPhone,
                        customerId: lead.customerId,
                        originCountry: lead.originCountry,
                        destinationCountry: lead.destinationCountry,
                        weight: lead.weight,
                        status: lead.status as 'success' | 'converted',
                        notes: lead.notes,
                        assignedTo: lead.assignedTo,
                        createdAt: lead.createdAt,
                        updatedAt: lead.updatedAt,
                        contactedAt: lead.contactedAt,
                        convertedAt: lead.convertedAt,
                        successAt: lead.successAt,
                        archivedAt: new Date(),
                        shipmentId: lead.shipmentId,
                    };

                    // Insert into archive table
                    await db.insert(leadsArchive).values({
                        id: nanoid(),
                        ...archivedLead,
                    });

                    // Log the archival action
                    await this.logCleanupAction(
                        lead.id,
                        'archived',
                        `Successful lead older than ${archiveDays} days`,
                        lead
                    );

                    // Update the original lead to mark as archived
                    await db
                        .update(leads)
                        .set({
                            isArchived: true,
                            archivedAt: new Date(),
                            updatedAt: new Date(),
                        })
                        .where(eq(leads.id, lead.id));

                    archivedCount++;

                    console.log(`Archived successful lead ${lead.id} (succeeded on ${lead.successAt})`);
                } catch (error) {
                    const errorMsg = `Failed to archive lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = `Failed to identify leads for archival: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg);
        }

        return { count: archivedCount, errors };
    }

    /**
     * Log cleanup action for audit trail
     */
    async logCleanupAction(
        leadId: string,
        action: 'deleted' | 'archived',
        reason: string,
        leadData: Lead
    ): Promise<void> {
        try {
            await db.insert(leadCleanupLog).values({
                id: nanoid(),
                leadId,
                action,
                reason,
                performedAt: new Date(),
                leadData: JSON.stringify(leadData),
            });
        } catch (error) {
            console.error(`Failed to log cleanup action for lead ${leadId}:`, error);
            // Don't throw here to avoid breaking the cleanup process
        }
    }

    /**
     * Run the complete scheduled cleanup process
     */
    async runScheduledCleanup(archiveDays?: number): Promise<CleanupSummary> {
        console.log('Starting scheduled lead cleanup...');

        const startTime = new Date();
        const deletionResults = await this.deleteExpiredFailedLeads();
        const archivalResults = await this.archiveSuccessfulLeads(archiveDays);

        const summary: CleanupSummary = {
            deletedCount: deletionResults.count,
            archivedCount: archivalResults.count,
            errors: [...deletionResults.errors, ...archivalResults.errors],
            runAt: startTime,
        };

        console.log('Cleanup completed:', summary);

        // Send notification (placeholder for future implementation)
        await this.sendCleanupNotification(summary);

        return summary;
    }

    /**
     * Send cleanup notification (placeholder for future implementation)
     */
    async sendCleanupNotification(summary: CleanupSummary): Promise<void> {
        // Placeholder for email/notification system
        console.log('Cleanup notification:', {
            message: `Lead cleanup completed: ${summary.deletedCount} deleted, ${summary.archivedCount} archived`,
            errors: summary.errors.length > 0 ? summary.errors : undefined,
            timestamp: summary.runAt,
        });
    }

    /**
     * Get cleanup log entries with pagination
     */
    async getCleanupLog(page: number = 1, perPage: number = 50): Promise<{
        entries: CleanupLogEntry[];
        pagination: {
            page: number;
            perPage: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }> {
        const offset = (page - 1) * perPage;

        // Get total count
        const totalResult = await db
            .select({ count: leadCleanupLog.id })
            .from(leadCleanupLog);
        const total = totalResult.length;

        // Get paginated entries
        const entries = await db
            .select()
            .from(leadCleanupLog)
            .orderBy(leadCleanupLog.performedAt)
            .limit(perPage)
            .offset(offset);

        const totalPages = Math.ceil(total / perPage);

        return {
            entries: entries.map(entry => ({
                ...entry,
                action: entry.action as 'deleted' | 'archived',
                performedAt: new Date(entry.performedAt),
            })),
            pagination: {
                page,
                perPage,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
}

// Export a singleton instance
export const leadCleanupService = new LeadCleanupService();