/** @format */

import { isAdmin, getSession } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { leads, users } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { count, desc, asc, or, ilike, eq, gte, lt, isNull, and } from 'drizzle-orm';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';
import z from 'zod';
import { nanoid } from 'nanoid';

const querySchema = z.object({
    page: z
        .preprocess((v) => Number(v), z.number().int().min(1).default(1))
        .optional(),
    perPage: z
        .preprocess((v) => Number(v), z.number().int().min(1).max(100).default(20))
        .optional(),
    q: z.string().optional(),
    sortBy: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc').optional(),
    status: z.string().optional(),
    originCountry: z.string().optional(),
    destinationCountry: z.string().optional(),
    assignedTo: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

const createLeadSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required'),
    customerEmail: z.string().email('Invalid email format'),
    customerPhone: z.string().optional(),
    customerId: z.string().optional(),
    originCountry: z.string().min(1, 'Origin country is required'),
    destinationCountry: z.string().min(1, 'Destination country is required'),
    weight: z.string().min(1, 'Weight is required'),
    notes: z.string().optional(),
    assignedTo: z.string().optional(),
});

// GET /api/lead - List leads with pagination, search, and filtering
export async function GET(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid query params', details: parsed.error.issues },
            { status: 400 }
        );
    }

    const {
        page = 1,
        perPage = 20,
        q,
        sortBy = 'createdAt',
        sortDir = 'desc',
        status,
        originCountry,
        destinationCountry,
        assignedTo,
        dateFrom,
        dateTo
    } = parsed.data;

    try {
        // Build where clause for search and filtering
        const whereConditions = [];

        // Search across customer name, email, and countries
        if (q) {
            whereConditions.push(
                or(
                    ilike(leads.customerName, `%${q}%`),
                    ilike(leads.customerEmail, `%${q}%`),
                    ilike(leads.originCountry, `%${q}%`),
                    ilike(leads.destinationCountry, `%${q}%`)
                )
            );
        }

        // Status filter - support multiple statuses
        if (status) {
            const statusList = status.split(',').map(s => s.trim());
            if (statusList.length === 1) {
                whereConditions.push(eq(leads.status, statusList[0]));
            } else {
                whereConditions.push(
                    or(...statusList.map(s => eq(leads.status, s)))
                );
            }
        }

        // Country filters
        if (originCountry) {
            whereConditions.push(eq(leads.originCountry, originCountry));
        }

        if (destinationCountry) {
            whereConditions.push(eq(leads.destinationCountry, destinationCountry));
        }

        // Assigned to filter
        if (assignedTo) {
            if (assignedTo === 'null') {
                // Filter for unassigned leads
                whereConditions.push(isNull(leads.assignedTo));
            } else {
                whereConditions.push(eq(leads.assignedTo, assignedTo));
            }
        }

        // Date range filters
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            whereConditions.push(gte(leads.createdAt, fromDate));
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            // Add one day to include the entire day
            toDate.setDate(toDate.getDate() + 1);
            whereConditions.push(lt(leads.createdAt, toDate));
        }

        const whereClause = whereConditions.length > 0
            ? (whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
            : undefined;

        // Build order clause
        const sortColumn = sortBy === 'customerName' ? leads.customerName :
            sortBy === 'customerEmail' ? leads.customerEmail :
                sortBy === 'status' ? leads.status :
                    sortBy === 'originCountry' ? leads.originCountry :
                        sortBy === 'destinationCountry' ? leads.destinationCountry :
                            sortBy === 'weight' ? leads.weight :
                                leads.createdAt;

        const orderClause = sortDir === 'desc' ? desc(sortColumn) : asc(sortColumn);

        // Get total count
        const [totalResult] = await db
            .select({ count: count() })
            .from(leads)
            .where(whereClause);

        const total = totalResult.count;

        // Get paginated leads with customer information
        const leadList = await db
            .select({
                id: leads.id,
                customerName: leads.customerName,
                customerEmail: leads.customerEmail,
                customerPhone: leads.customerPhone,
                customerId: leads.customerId,
                originCountry: leads.originCountry,
                destinationCountry: leads.destinationCountry,
                weight: leads.weight,
                status: leads.status,
                notes: leads.notes,
                failureReason: leads.failureReason,
                assignedTo: leads.assignedTo,
                createdAt: leads.createdAt,
                updatedAt: leads.updatedAt,
                contactedAt: leads.contactedAt,
                convertedAt: leads.convertedAt,
                shipmentId: leads.shipmentId,
                // Include linked customer information
                linkedCustomer: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    phone: users.phone,
                    role: users.role,
                }
            })
            .from(leads)
            .leftJoin(users, eq(leads.customerId, users.id))
            .where(whereClause)
            .orderBy(orderClause)
            .limit(perPage)
            .offset((page - 1) * perPage);

        const totalPages = Math.ceil(total / perPage);

        return NextResponse.json({
            leads: leadList,
            pagination: {
                page,
                perPage,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}

// POST /api/lead - Create new lead
export async function POST(req: NextRequest) {
    if (!(await isAdmin(req))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = createLeadSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const {
            customerName,
            customerEmail,
            customerPhone,
            customerId,
            originCountry,
            destinationCountry,
            weight,
            notes,
            assignedTo
        } = parsed.data;

        // Validate customerId exists if provided
        if (customerId) {
            const customer = await db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, customerId),
            });

            if (!customer) {
                return NextResponse.json(
                    { error: 'Customer not found' },
                    { status: 400 }
                );
            }
        }

        // Validate assignedTo exists if provided
        if (assignedTo) {
            const assignee = await db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, assignedTo),
            });

            if (!assignee) {
                return NextResponse.json(
                    { error: 'Assigned user not found' },
                    { status: 400 }
                );
            }
        }

        // Create new lead
        const leadId = nanoid();
        const now = new Date();

        await db
            .insert(leads)
            .values({
                id: leadId,
                customerName,
                customerEmail,
                customerPhone,
                customerId,
                originCountry,
                destinationCountry,
                weight,
                status: 'new',
                notes,
                assignedTo,
                createdAt: now,
                updatedAt: now,
            });

        // Track lead creation activity
        try {
            const { LeadActivityTracker } = await import('@/lib/leadActivityTracker');
            await LeadActivityTracker.trackCreated(leadId, {
                description: `Lead created for ${customerName} (${customerEmail})`,
                metadata: {
                    originCountry,
                    destinationCountry,
                    weight,
                    assignedTo,
                },
            });
        } catch (error) {
            console.error('Failed to track lead creation activity:', error);
            // Don't fail the request if activity tracking fails
        }

        // Get created lead with customer information
        const newLeadResult = await db
            .select({
                id: leads.id,
                customerName: leads.customerName,
                customerEmail: leads.customerEmail,
                customerPhone: leads.customerPhone,
                customerId: leads.customerId,
                originCountry: leads.originCountry,
                destinationCountry: leads.destinationCountry,
                weight: leads.weight,
                status: leads.status,
                notes: leads.notes,
                failureReason: leads.failureReason,
                assignedTo: leads.assignedTo,
                createdAt: leads.createdAt,
                updatedAt: leads.updatedAt,
                contactedAt: leads.contactedAt,
                convertedAt: leads.convertedAt,
                shipmentId: leads.shipmentId,
                // Include linked customer information
                linkedCustomer: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    phone: users.phone,
                    role: users.role,
                }
            })
            .from(leads)
            .leftJoin(users, eq(leads.customerId, users.id))
            .where(eq(leads.id, leadId))
            .limit(1);

        const newLead = newLeadResult[0];

        // Trigger notification for lead assignment if assigned
        if (assignedTo) {
            try {
                const session = await getSession(req);
                const assignedBy = session?.user?.id || 'system';

                await notificationEventHandlers.handleLeadAssignment({
                    id: leadId,
                    customerName,
                    customerEmail,
                    assignedTo,
                    assignedBy,
                });
            } catch (notificationError) {
                console.error('Failed to send lead assignment notification:', notificationError);
                // Don't fail lead creation if notifications fail
            }
        }

        return NextResponse.json({
            lead: newLead,
            message: 'Lead created successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating lead:', error);
        return NextResponse.json(
            { error: 'Failed to create lead' },
            { status: 500 }
        );
    }
}