import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { getDashboardStats } from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessionUser = await requireAuthenticatedUser();
    if (sessionUser.role === 'staff') {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: Staffs cannot access administrative analytics.' }, { status: 403 });
    }

    const params = sessionUser.role === 'manager' && sessionUser.departmentId ? { departmentId: sessionUser.departmentId } : undefined;
    const stats = await getDashboardStats(params);
    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    if (err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
