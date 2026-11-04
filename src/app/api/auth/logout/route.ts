import { NextResponse } from 'next/server';
import { getServerSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/auth/session';
import { recordAttendanceLogout } from '@/lib/services/attendance-service';

export async function POST(req: Request) {
  try {
    const sessionUser = await getServerSession();
    if (sessionUser) {
      const body = await req.json().catch(() => ({}));
      const { gps, locationStatus } = body;
      await recordAttendanceLogout(sessionUser, gps, locationStatus || 'unavailable');
    }
  } catch (err: any) {
    console.warn('Attendance logout on sign out warning:', err.message);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(ROLE_COOKIE_NAME);
  return response;
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getServerSession();
    if (sessionUser) {
      await recordAttendanceLogout(sessionUser, null, 'unavailable');
    }
  } catch (err: any) {
    console.warn('Attendance logout on GET sign out warning:', err.message);
  }

  const url = new URL('/login', req.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(ROLE_COOKIE_NAME);
  return response;
}
