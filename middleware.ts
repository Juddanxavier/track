/** @format */

import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/helpers/authHelpers';

const protectedRoutes = ['/admin', '/dashboard'];

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const session = await getSession(request);
  const res = NextResponse.next();

  const isLoggedIn = !!session;
  const isOnProtectedRoute = protectedRoutes.includes(nextUrl.pathname);
  const isOnAuthRoute = nextUrl.pathname.startsWith('/auth');

  if (isOnProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  if (isLoggedIn && isOnAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
