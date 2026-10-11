import { NextResponse } from 'next/server';
import { processAutomaticMissingReportReminders } from '@/lib/services/reminder-service';
import { logAuditAction } from '@/lib/services/audit-service';

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'agricart_cron_secret_key_8492049182390123';

    const { searchParams } = new URL(req.url);
    const secretQuery = searchParams.get('secret');

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${cronSecret}`) ||
      (secretQuery && secretQuery === cronSecret) ||
      process.env.NODE_ENV === 'development';

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized scheduled job execution' }, { status: 401 });
    }

    const targetDate = searchParams.get('date') || undefined;
    const result = await processAutomaticMissingReportReminders(targetDate);

    await logAuditAction({
      actorUid: 'system_cron',
      actorName: 'Vercel Cron Scheduler',
      actorRole: 'super_admin',
      action: 'run_reminder_cron',
      resourceType: 'system',
      resourceId: targetDate || 'today',
      details: `Executed missing report reminders: ${result.remindersSent} reminders, ${result.escalationsSent} escalations`,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

