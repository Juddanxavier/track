/** @format */

import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function getSession(request: NextRequest) {
  try {
    // Query session directly; rely on incoming headers (cookies) from the request
    const session = await auth.api.getSession({ headers: request.headers });
    return session ?? null;
  } catch {
    return null;
  }
}

export async function getUserRole(
  request: NextRequest
): Promise<string | null> {
  const session = await getSession(request);
  return session?.user.role ?? 'customer';
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  const role = await getUserRole(request);
  return role === 'admin' || role === 'super-admin';
}

export async function isSuperAdmin(request: NextRequest): Promise<boolean> {
  const role = await getUserRole(request);
  return role === 'super-admin';
}
