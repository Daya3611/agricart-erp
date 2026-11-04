import { NextResponse } from 'next/server';
import { closeStaleMidnightSessions } from '@/lib/services/attendance-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow local or verified callers
      const host = req.headers.get('host') || '';
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
      }
    }

    const closedCount = await closeStaleMidnightSessions();

    return NextResponse.json({
      success: true,
      message: `Automatic midnight attendance closure executed. Closed ${closedCount} stale session(s).`,
      closedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Midnight cron error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
