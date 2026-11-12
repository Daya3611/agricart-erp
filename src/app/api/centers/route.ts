import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection, saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('all') === 'true';
    const filters = includeAll ? [] : [{ field: 'active', op: '==', value: true }];
    const centers = await fetchCollection(ERP_COLLECTIONS.centers, filters);
    return NextResponse.json({ success: true, centers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, centers: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAdmin();
    const body = await req.json();
    const { name, code, address, locationDetails, departmentId, photoUrl, logoUrl, photoMediaId, photoObjectKey, mediaIds } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Center name and code required' }, { status: 400 });
    }

    const id = `center_${Date.now()}`;
    const now = new Date().toISOString();
    const center = {
      id,
      name,
      code,
      address: address || '',
      locationDetails: locationDetails || '',
      departmentId: departmentId || 'dept_field_ops',
      assignedStaffUids: [],
      ...(photoUrl ? { photoUrl } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(photoMediaId ? { photoMediaId } : {}),
      ...(photoObjectKey ? { photoObjectKey } : {}),
      ...(Array.isArray(mediaIds) ? { mediaIds } : {}),
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument(ERP_COLLECTIONS.centers, id, center);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'create_center',
      resourceType: 'center',
      resourceId: id,
      details: `Created procurement center ${name} (${code})`,
    });

    return NextResponse.json({ success: true, center });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

