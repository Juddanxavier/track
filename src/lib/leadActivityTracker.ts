/** @format */

import { db } from '@/database/db';
import { leadActivities, users } from '@/database/schema';
import { Lead, LeadActivity } from '@/types/lead';
import { nanoid } from 'nanoid';
import { eq, desc, count } from 'drizzle-orm';

export interface ActivityTrackingOptions {
    userId?: string;
    description?: string;
    metadata?: Record<string, any>;
}

export class LeadActivityTracker {
    /**
     * Track a lead creation activity
     */
    static async trackCreated(leadId: string, options: ActivityTrackingOptions = {}) {
        return this.createActivity({
            leadId,
            action: 'created',
            description: options.description || 'Lead was created',
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Track a field update activity
     */
    static async trackFieldUpdate(
        leadId: string,
        field: string,
        oldValue: any,
        newValue: any,
        options: ActivityTrackingOptions = {}
    ) {
        const description = options.description || this.generateFieldUpdateDescription(field, oldValue, newValue);

        return this.createActivity({
            leadId,
            action: 'updated',
            field,
            oldValue: oldValue?.toString() || null,
            newValue: newValue?.toString() || null,
            description,
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Track a status change activity
     */
    static async trackStatusChange(
        leadId: string,
        oldStatus: string,
        newStatus: string,
        options: ActivityTrackingOptions = {}
    ) {
        const description = options.description || `Status changed from ${this.formatStatus(oldStatus)} to ${this.formatStatus(newStatus)}`;

        return this.createActivity({
            leadId,
            action: 'status_changed',
            field: 'status',
            oldValue: oldStatus,
            newValue: newStatus,
            description,
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Track an assignment change activity
     */
    static async trackAssignment(
        leadId: string,
        oldAssignee: string | null,
        newAssignee: string | null,
        options: ActivityTrackingOptions = {}
    ) {
        const description = options.description || this.generateAssignmentDescription(oldAssignee, newAssignee);

        return this.createActivity({
            leadId,
            action: 'assigned',
            field: 'assignedTo',
            oldValue: oldAssignee,
            newValue: newAssignee,
            description,
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Track a lead conversion activity
     */
    static async trackConversion(leadId: string, options: ActivityTrackingOptions = {}) {
        return this.createActivity({
            leadId,
            action: 'converted',
            description: options.description || 'Lead was converted to shipment',
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Track a lead deletion activity
     */
    static async trackDeletion(leadId: string, options: ActivityTrackingOptions = {}) {
        return this.createActivity({
            leadId,
            action: 'deleted',
            description: options.description || 'Lead was deleted',
            userId: options.userId,
            metadata: options.metadata,
        });
    }

    /**
     * Get activities for a specific lead
     */
    static async getLeadActivities(
        leadId: string,
        options: { page?: number; perPage?: number } = {}
    ): Promise<{ activities: LeadActivity[]; pagination: any }> {
        const { page = 1, perPage = 20 } = options;

        try {
            // Get total count
            const [totalResult] = await db
                .select({ count: count() })
                .from(leadActivities)
                .where(eq(leadActivities.leadId, leadId));

            const total = totalResult.count;

            // Get paginated activities with user information
            const activities = await db
                .select({
                    id: leadActivities.id,
                    leadId: leadActivities.leadId,
                    userId: leadActivities.userId,
                    action: leadActivities.action,
                    field: leadActivities.field,
                    oldValue: leadActivities.oldValue,
                    newValue: leadActivities.newValue,
                    description: leadActivities.description,
                    metadata: leadActivities.metadata,
                    createdAt: leadActivities.createdAt,
                    user: {
                        id: users.id,
                        name: users.name,
                        email: users.email,
                    }
                })
                .from(leadActivities)
                .leftJoin(users, eq(leadActivities.userId, users.id))
                .where(eq(leadActivities.leadId, leadId))
                .orderBy(desc(leadActivities.createdAt))
                .limit(perPage)
                .offset((page - 1) * perPage);

            const totalPages = Math.ceil(total / perPage);

            return {
                activities: activities as LeadActivity[],
                pagination: {
                    page,
                    perPage,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                },
            };
        } catch (error) {
            console.error('Error fetching lead activities:', error);
            return {
                activities: [],
                pagination: {
                    page: 1,
                    perPage: 20,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            };
        }
    }

    /**
     * Track multiple field changes in a single update
     */
    static async trackMultipleUpdates(
        leadId: string,
        changes: Array<{ field: string; oldValue: any; newValue: any }>,
        options: ActivityTrackingOptions = {}
    ) {
        const activities = [];

        for (const change of changes) {
            if (change.oldValue !== change.newValue) {
                if (change.field === 'status') {
                    activities.push(
                        this.trackStatusChange(leadId, change.oldValue, change.newValue, options)
                    );
                } else if (change.field === 'assignedTo') {
                    activities.push(
                        this.trackAssignment(leadId, change.oldValue, change.newValue, options)
                    );
                } else {
                    activities.push(
                        this.trackFieldUpdate(leadId, change.field, change.oldValue, change.newValue, options)
                    );
                }
            }
        }

        return Promise.all(activities);
    }

    /**
     * Create a new activity record
     */
    private static async createActivity(activity: {
        leadId: string;
        action: 'created' | 'updated' | 'status_changed' | 'assigned' | 'converted' | 'deleted';
        field?: string;
        oldValue?: string | null;
        newValue?: string | null;
        description: string;
        userId?: string;
        metadata?: Record<string, any>;
    }) {
        try {
            const activityId = nanoid();
            const now = new Date();

            await db.insert(leadActivities).values({
                id: activityId,
                leadId: activity.leadId,
                userId: activity.userId || null,
                action: activity.action,
                field: activity.field || null,
                oldValue: activity.oldValue,
                newValue: activity.newValue,
                description: activity.description,
                metadata: activity.metadata ? JSON.stringify(activity.metadata) : null,
                createdAt: now,
            });

            return activityId;
        } catch (error) {
            console.error('Error creating lead activity:', error);
            throw error;
        }
    }

    /**
     * Generate a human-readable description for field updates
     */
    private static generateFieldUpdateDescription(field: string, oldValue: any, newValue: any): string {
        const fieldNames: Record<string, string> = {
            customerName: 'Customer Name',
            customerEmail: 'Customer Email',
            customerPhone: 'Customer Phone',
            originCountry: 'Origin Country',
            destinationCountry: 'Destination Country',
            weight: 'Weight',
            notes: 'Notes',
            failureReason: 'Failure Reason',
        };

        const fieldName = fieldNames[field] || field;

        if (!oldValue && newValue) {
            return `${fieldName} was set to "${newValue}"`;
        } else if (oldValue && !newValue) {
            return `${fieldName} was cleared (was "${oldValue}")`;
        } else {
            return `${fieldName} changed from "${oldValue}" to "${newValue}"`;
        }
    }

    /**
     * Generate a human-readable description for assignment changes
     */
    private static generateAssignmentDescription(oldAssignee: string | null, newAssignee: string | null): string {
        if (!oldAssignee && newAssignee) {
            return `Lead was assigned to user ${newAssignee}`;
        } else if (oldAssignee && !newAssignee) {
            return `Lead was unassigned (was assigned to ${oldAssignee})`;
        } else if (oldAssignee && newAssignee) {
            return `Lead was reassigned from ${oldAssignee} to ${newAssignee}`;
        } else {
            return 'Assignment was updated';
        }
    }

    /**
     * Format status for display
     */
    private static formatStatus(status: string): string {
        const statusMap: Record<string, string> = {
            new: 'New',
            contacted: 'Contacted',
            failed: 'Failed',
            success: 'Success',
            converted: 'Converted',
        };

        return statusMap[status] || status;
    }
}