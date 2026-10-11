import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument, updateDocument, deleteDocument, fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { Center } from '@/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { id } = await params;

    const center = (await fetchDocument(ERP_COLLECTIONS.centers, id)) as Center | null;
    if (!center) {
      return NextResponse.json({ success: false, error: 'Center not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, center });
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

    const existingCenter = (await fetchDocument(ERP_COLLECTIONS.centers, id)) as Center | null;
    if (!existingCenter) {
      return NextResponse.json({ success: false, error: 'Center not found' }, { status: 404 });
    }

    const { name, code, address, locationDetails, departmentId, active } = body;

    const updatedFields: Partial<Center> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updatedFields.name = name.trim();
    if (code !== undefined) updatedFields.code = code.trim().toUpperCase();
    if (address !== undefined) updatedFields.address = address.trim();
    if (locationDetails !== undefined) updatedFields.locationDetails = locationDetails.trim();
    if (departmentId !== undefined) updatedFields.departmentId = departmentId;
    if (active !== undefined) updatedFields.active = Boolean(active);

    await updateDocument(ERP_COLLECTIONS.centers, id, updatedFields);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'update_center',
      resourceType: 'center',
      resourceId: id,
      details: `Updated center ${updatedFields.name || existingCenter.name} (${updatedFields.code || existingCenter.code})`,
      previousValues: { name: existingCenter.name, code: existingCenter.code, active: existingCenter.active },
      newValues: updatedFields,
    });

    const updatedCenter = { ...existingCenter, ...updatedFields };
    return NextResponse.json({ success: true, center: updatedCenter });
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

    const existingCenter = (await fetchDocument(ERP_COLLECTIONS.centers, id)) as Center | null;
    if (!existingCenter) {
      return NextResponse.json({ success: false, error: 'Center not found' }, { status: 404 });
    }

    // Check if any employees are currently assigned to this center
    const allStaff = (await fetchCollection(ERP_COLLECTIONS.employees)) as any[];
    const assignedStaff = allStaff.filter((u) => Array.isArray(u.assignedCenterIds) && u.assignedCenterIds.includes(id));

    if (assignedStaff.length > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete center: ${assignedStaff.length} employee(s) are currently assigned to this center. Reassign them first, or deactivate the center instead.`,
          assignedCount: assignedStaff.length,
        },
        { status: 400 }
      );
    }

    await deleteDocument(ERP_COLLECTIONS.centers, id);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'delete_center',
      resourceType: 'center',
      resourceId: id,
      details: `Deleted procurement center ${existingCenter.name} (${existingCenter.code})`,
    });

    return NextResponse.json({ success: true, message: 'Center removed successfully.' });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
