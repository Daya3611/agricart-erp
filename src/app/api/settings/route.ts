import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireSuperAdmin } from '@/lib/auth/permissions';
import { fetchDocument, saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/services/seed-service';
import { logAuditAction } from '@/lib/services/audit-service';
import { SystemSettings } from '@/types';

export async function GET() {
  try {
    const sessionUser = await requireAuthenticatedUser();
    let settingsDoc = (await fetchDocument(ERP_COLLECTIONS.systemSettings, 'global')) as SystemSettings | null;

    if (!settingsDoc) {
      settingsDoc = DEFAULT_SYSTEM_SETTINGS;
    }

    return NextResponse.json({ success: true, settings: settingsDoc });
  } catch (err: any) {
    if (err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message, settings: DEFAULT_SYSTEM_SETTINGS }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireSuperAdmin();
    const body = await req.json();

    const updatedSettings: SystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...body,
      id: 'global',
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(ERP_COLLECTIONS.systemSettings, 'global', updatedSettings);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'update_system_settings',
      resourceType: 'system_settings',
      resourceId: 'global',
      details: 'Updated global system settings and reporting deadlines',
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
