import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_DISPLAY_COOKIE_NAME,
  sessionCookieAttrs,
} from '@/lib/auth';

export async function POST() {
  const response = NextResponse.redirect(
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  );
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieAttrs(0), maxAge: 0 });
  response.cookies.set(SESSION_DISPLAY_COOKIE_NAME, '', {
    ...sessionCookieAttrs(0),
    httpOnly: false,
    maxAge: 0,
  });
  return response;
}
