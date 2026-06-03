import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Paths requiring authentication
  const isProtectedPath = pathname.startsWith('/dashboard');

  // Authentication paths that should only be accessible if NOT logged in
  const isAuthPath = pathname === '/login' || pathname === '/register';

  if (isProtectedPath && !token) {
    // Redirect unauthenticated users trying to access dashboard to login
    const loginUrl = new URL('/login', request.url);
    // Optional: add original destination path to redirect to after login
    // loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && token) {
    // Redirect authenticated users trying to access login/register to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Config to apply middleware to paths:
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
};
