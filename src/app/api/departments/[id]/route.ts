import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument, updateDocument, deleteDocument, fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { Department } from '@/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { id } = await params;

    const dept = (await fetchDocument(ERP_COLLECTIONS.departments, id)) as Department | null;
    if (!dept) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, department: dept });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const existingDept = (await fetchDocument(ERP_COLLECTIONS.departments, id)) as Department | null;
    if (!existingDept) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    const { name, code, description, active, managerUids } = body;

    const updatedFields: Partial<Department> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updatedFields.name = name.trim();
    if (code !== undefined) updatedFields.code = code.trim().toUpperCase();
    if (description !== undefined) updatedFields.description = description.trim();
    if (active !== undefined) updatedFields.active = Boolean(active);
    if (managerUids !== undefined) updatedFields.managerUids = managerUids;

    await updateDocument(ERP_COLLECTIONS.departments, id, updatedFields);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'update_department',
      resourceType: 'department',
      resourceId: id,
      details: `Updated department ${updatedFields.name || existingDept.name} (${updatedFields.code || existingDept.code})`,
      previousValues: { name: existingDept.name, code: existingDept.code, active: existingDept.active },
      newValues: updatedFields,
    });

    const updatedDept = { ...existingDept, ...updatedFields };
    return NextResponse.json({ success: true, department: updatedDept });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    const existingDept = (await fetchDocument(ERP_COLLECTIONS.departments, id)) as Department | null;
    if (!existingDept) {
      return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 });
    }

    // Check if any employees are currently assigned to this department
    const assignedStaff = (await fetchCollection(ERP_COLLECTIONS.employees, [
      { field: 'departmentId', op: '==', value: id },
    ])) as any[];

    if (assignedStaff.length > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete department: ${assignedStaff.length} employee(s) are currently assigned to this department. Reassign them first, or deactivate the department instead.`,
          assignedCount: assignedStaff.length,
        },
        { status: 400 }
      );
    }

    await deleteDocument(ERP_COLLECTIONS.departments, id);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'delete_department',
      resourceType: 'department',
      resourceId: id,
      details: `Deleted department ${existingDept.name} (${existingDept.code})`,
    });

    return NextResponse.json({ success: true, message: 'Department removed successfully.' });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
