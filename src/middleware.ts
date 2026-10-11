import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/auth/constants';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/setup-password'];

function isSafeInternalUrl(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, images, API routes, and public files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png'
  ) {
    return NextResponse.next();
  }

  // Public registration is disabled: redirect /register to /login
  if (pathname.startsWith('/register')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const roleCookie = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // 1. If visiting /login or public route with an error or returnUrl query param,
  // it indicates a server auth check or redirect sent them here.
  // We MUST allow access and clear any stale session cookies to prevent infinite bounce loops.
  if (
    pathname.startsWith('/login') &&
    (request.nextUrl.searchParams.has('returnUrl') || request.nextUrl.searchParams.has('error'))
  ) {
    const response = NextResponse.next();
    if (sessionCookie) response.cookies.delete(SESSION_COOKIE_NAME);
    if (roleCookie) response.cookies.delete(ROLE_COOKIE_NAME);
    return response;
  }

  // 2. If user is unauthenticated and attempting to access a protected route
  if (!sessionCookie && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    if (isSafeInternalUrl(pathname)) {
      loginUrl.searchParams.set('returnUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. If user is authenticated and visiting login, register or root page
  const validRoles = ['super_admin', 'admin', 'manager', 'staff'];
  const isValidRole = Boolean(roleCookie && validRoles.includes(roleCookie));

  if (sessionCookie && (isPublicRoute || pathname === '/' || pathname === '/dashboard')) {
    if (isValidRole) {
      if (roleCookie === 'super_admin' || roleCookie === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      if (roleCookie === 'manager') {
        return NextResponse.redirect(new URL('/manager/dashboard', request.url));
      }
      if (roleCookie === 'staff') {
        return NextResponse.redirect(new URL('/staff/dashboard', request.url));
      }
    } else {
      // Stale or unrecognized role: do not redirect into loop, clear cookies on public route
      if (isPublicRoute) {
        const response = NextResponse.next();
        response.cookies.delete(SESSION_COOKIE_NAME);
        response.cookies.delete(ROLE_COOKIE_NAME);
        return response;
      }
      // For root or /dashboard, let the server-side page determine the destination
      return NextResponse.next();
    }
  }

  // 4. Role-based Route Protection preliminary fast-path
  if (sessionCookie && isValidRole) {
    // Staff attempting to access admin or manager routes -> redirect to staff dashboard
    if (roleCookie === 'staff' && (pathname.startsWith('/admin') || pathname.startsWith('/manager'))) {
      return NextResponse.redirect(new URL('/staff/dashboard', request.url));
    }

    // Admin/Super Admin attempting to access staff routes -> redirect to admin dashboard
    if ((roleCookie === 'admin' || roleCookie === 'super_admin') && pathname.startsWith('/staff')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Manager attempting to access admin routes -> redirect to manager dashboard
    if (roleCookie === 'manager' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/manager/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export default middleware;
export { middleware as proxy };

