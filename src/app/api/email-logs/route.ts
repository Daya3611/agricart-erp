import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/permissions';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { EmailLog } from '@/types';

export async function GET() {
  try {
    const sessionUser = await requireAdmin();
    const logs = (await fetchCollection(ERP_COLLECTIONS.emailLogs)) as EmailLog[];

    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message, logs: [] }, { status });
  }
}
