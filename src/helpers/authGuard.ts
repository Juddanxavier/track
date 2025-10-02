/** @format */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

type UserRole = 'customer' | 'admin' | 'super-admin' | string;

export async function getSessionFromHeaders() {
  try {
    const h = await headers();
    return await auth.api.getSession({ headers: h });
  } catch {
    return null;
  }
}

export function roleHomeFor(role: UserRole): '/admin' | '/dashboard' {
  return role === 'admin' || role === 'super-admin' ? '/admin' : '/dashboard';
}

export async function requireAuth(options?: { redirectTo?: string }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    const h = await headers();
    const url = h.get('x-pathname') || '/';
    const search = h.get('x-search') || '';
    const returnTo = encodeURIComponent(`${url}${search}`);
    redirect(options?.redirectTo ?? `/auth/sign-in?redirectTo=${returnTo}`);
  }
  return session;
}

export async function redirectAuthenticatedToHome() {
  const session = await getSessionFromHeaders();
  if (session) {
    const role = (session.user?.role as UserRole) ?? 'customer';
    redirect(roleHomeFor(role));
  }
}

export async function requireRole(allowedRoles: UserRole[], fallback?: string) {
  const session = await requireAuth();
  const role = (session.user?.role as UserRole) ?? 'customer';
  if (!allowedRoles.includes(role)) {
    redirect(fallback ?? roleHomeFor(role));
  }
  return session;
}
