import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection, saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const schedules = await fetchCollection(ERP_COLLECTIONS.workSchedules);
    return NextResponse.json({ success: true, schedules });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message, schedules: [] }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAdmin();
    const body = await req.json();
    const { id, name, description, workingDays, dailyCutoffTime, graceMinutes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Schedule name required' }, { status: 400 });
    }

    const scheduleId = id || `sched_${Date.now()}`;
    const now = new Date().toISOString();
    const schedule = {
      id: scheduleId,
      name,
      description: description || '',
      workingDays: workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dailyCutoffTime: dailyCutoffTime || '19:00',
      graceMinutes: Number(graceMinutes || 60),
      active: true,
      updatedAt: now,
    };

    await saveDocument(ERP_COLLECTIONS.workSchedules, scheduleId, schedule);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'save_work_schedule',
      resourceType: 'system_settings',
      resourceId: scheduleId,
      details: `Saved work schedule ${name}`,
    });

    return NextResponse.json({ success: true, schedule });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
