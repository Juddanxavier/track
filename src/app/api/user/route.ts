/** @format */

import { isAdmin } from '@/helpers/authHelpers';
import { db } from '@/database/db';
import { users, accounts } from '@/database/schema';
import { NextRequest, NextResponse } from 'next/server';
import { count, desc, asc, or, ilike, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { notificationEventHandlers } from '@/lib/notificationEventHandlers';
import z from 'zod';

// Generate a secure temporary password
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const querySchema = z.object({
  page: z
    .preprocess((v) => Number(v), z.number().int().min(1).default(1))
    .optional(),
  perPage: z
    .preprocess((v) => Number(v), z.number().int().min(1).max(100).default(20))
    .optional(),
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc').optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  role: z.string().default('customer'),
  banned: z.boolean().default(false),
  banReason: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  sendWelcomeEmail: z.boolean().default(true),
});

// GET /api/user - List users with pagination and search
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

  const { page = 1, perPage = 20, q, sortBy = 'createdAt', sortDir = 'desc' } = parsed.data;

  try {
    // Build where clause for search
    const whereClause = q
      ? or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`)
      )
      : undefined;

    // Build order clause
    const sortColumn = sortBy === 'name' ? users.name :
      sortBy === 'email' ? users.email :
        sortBy === 'role' ? users.role :
          sortBy === 'banned' ? users.banned :
            users.createdAt;

    const orderClause = sortDir === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const total = totalResult.count;

    // Get paginated users
    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        avatar: users.avatar,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
        address: users.address,
        city: users.city,
        state: users.state,
        country: users.country,
        zipCode: users.zipCode,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const totalPages = Math.ceil(total / perPage);

    return NextResponse.json({
      users: userList,
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
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/user - Create new user
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, phone, address, city, state, country, zipCode, role, banned, banReason, password, sendWelcomeEmail } = parsed.data;

    // Generate a temporary password if none provided
    const userPassword = password || generateTemporaryPassword();

    try {
      // Use Better Auth admin plugin to create user
      const createUserResult = await auth.api.createUser({
        body: {
          name,
          email,
          password: userPassword,
          role: role as 'admin' | 'user',
          data: {
            phone,
            address,
            city,
            state,
            country,
            zipCode,
            banned,
            banReason: banned ? banReason : null,
          }
        },
        headers: req.headers,
      });

      if (!createUserResult.user) {
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      // Update the user with additional fields that might not be handled by the admin plugin
      const [updatedUser] = await db
        .update(users)
        .set({
          phone,
          address,
          city,
          state,
          country,
          zipCode,
          role,
          banned,
          banReason: banned ? banReason : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, createUserResult.user.id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          avatar: users.avatar,
          avatarUrl: users.avatarUrl,
          phone: users.phone,
          address: users.address,
          city: users.city,
          state: users.state,
          country: users.country,
          zipCode: users.zipCode,
          role: users.role,
          banned: users.banned,
          banReason: users.banReason,
          banExpires: users.banExpires,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          stripeCustomerId: users.stripeCustomerId,
        });

      // Send welcome email with password reset if requested and no custom password was provided
      if (sendWelcomeEmail && !password) {
        try {
          await auth.api.forgetPassword({
            body: { email },
            headers: req.headers,
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail user creation if email fails
        }
      }

      // Trigger notification events for user registration
      try {
        // Send admin notification about new user registration
        await notificationEventHandlers.handleUserRegistration({
          id: updatedUser.id,
          name: updatedUser.name || '',
          email: updatedUser.email,
          role: updatedUser.role || 'customer',
        });

        // Send welcome notification to the new user
        await notificationEventHandlers.handleWelcomeMessage({
          id: updatedUser.id,
          name: updatedUser.name || '',
          email: updatedUser.email,
          role: updatedUser.role || 'customer',
        });
      } catch (notificationError) {
        console.error('Failed to send user registration notifications:', notificationError);
        // Don't fail user creation if notifications fail
      }

      return NextResponse.json({
        user: updatedUser,
        message: sendWelcomeEmail && !password
          ? 'User created successfully. Welcome email sent.'
          : 'User created successfully.'
      }, { status: 201 });

    } catch (authError: any) {
      console.error('Error creating user:', authError);

      // Handle specific Better Auth errors
      if (authError.message?.includes('already exists') || authError.message?.includes('duplicate')) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
