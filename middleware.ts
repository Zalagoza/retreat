import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verifySession } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.next();
}

// /admin/login is excluded so the login page is reachable
export const config = {
  matcher: ['/admin', '/admin/((?!login).*)'],
};
