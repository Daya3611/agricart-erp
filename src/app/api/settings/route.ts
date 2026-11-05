import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireSuperAdmin } from '@/lib/auth/permissions';
import { saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { SystemSettings } from '@/types';
import { getSystemSettings, invalidateSettingsCache } from '@/lib/services/settings-service';
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/constants/reporting-defaults';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const settings = await getSystemSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message, settings: DEFAULT_SYSTEM_SETTINGS }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireSuperAdmin();
    const body = await req.json();

    const existingSettings = await getSystemSettings();

    const updatedSettings: SystemSettings = {
      ...existingSettings,
      ...body,
      reportingSettings: {
        ...existingSettings.reportingSettings,
        ...(body.reportingSettings || {}),
      },
      reminderSettings: {
        ...existingSettings.reminderSettings,
        ...(body.reminderSettings || {}),
      },
      emailSettings: {
        ...existingSettings.emailSettings,
        ...(body.emailSettings || {}),
      },
      reportingConfig: {
        ...(existingSettings.reportingConfig || {}),
        ...(body.reportingConfig || {}),
        pdfSettings: {
          ...(existingSettings.reportingConfig?.pdfSettings || {}),
          ...(body.reportingConfig?.pdfSettings || {}),
        },
        docxSettings: {
          ...(existingSettings.reportingConfig?.docxSettings || {}),
          ...(body.reportingConfig?.docxSettings || {}),
        },
        excelSettings: {
          ...(existingSettings.reportingConfig?.excelSettings || {}),
          ...(body.reportingConfig?.excelSettings || {}),
        },
        requiredActivityFields: {
          ...(existingSettings.reportingConfig?.requiredActivityFields || {}),
          ...(body.reportingConfig?.requiredActivityFields || {}),
        },
        exportPermissions: {
          ...(existingSettings.reportingConfig?.exportPermissions || {}),
          ...(body.reportingConfig?.exportPermissions || {}),
        },
        organization: {
          ...(existingSettings.reportingConfig?.organization || {}),
          ...(body.reportingConfig?.organization || {}),
        },
      } as any,
      id: 'global',
      updatedByUid: sessionUser.uid,
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(ERP_COLLECTIONS.systemSettings, 'global', updatedSettings);
    invalidateSettingsCache();

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'update_system_settings',
      resourceType: 'system_settings',
      resourceId: 'global',
      details: 'Updated global system settings and centralized reporting configuration',
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
