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
    const departments = await fetchCollection(ERP_COLLECTIONS.departments, filters);
    return NextResponse.json({ success: true, departments });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, departments: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAdmin();
    const body = await req.json();
    const { name, code, description, managerUids } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Department name and code required' }, { status: 400 });
    }

    const id = `dept_${Date.now()}`;
    const now = new Date().toISOString();
    const dept = {
      id,
      name,
      code,
      description: description || '',
      managerUids: managerUids || [],
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument(ERP_COLLECTIONS.departments, id, dept);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'create_department',
      resourceType: 'department',
      resourceId: id,
      details: `Created department ${name} (${code})`,
    });

    return NextResponse.json({ success: true, department: dept });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

