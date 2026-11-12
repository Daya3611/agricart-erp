import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  MobileProfileUpdateSchema,
} from '@/lib/api/v1-helper';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { Department, Center, UserProfile } from '@/types';
import { logAuditAction } from '@/lib/services/audit-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    const freshUser = ((await fetchDocument(ERP_COLLECTIONS.employees, user.uid)) as unknown as UserProfile) || user;

    let department: Department | null = null;
    if (freshUser.departmentId) {
      department = (await fetchDocument(ERP_COLLECTIONS.departments, freshUser.departmentId)) as Department | null;
    }

    const centers: Center[] = [];
    if (freshUser.assignedCenterIds && freshUser.assignedCenterIds.length > 0) {
      for (const centerId of freshUser.assignedCenterIds) {
        const c = (await fetchDocument(ERP_COLLECTIONS.centers, centerId)) as Center | null;
        if (c) centers.push(c);
      }
    }

    return apiSuccess({
      uid: freshUser.uid,
      employeeId: freshUser.employeeId || '',
      fullName: freshUser.fullName,
      email: freshUser.email,
      phone: freshUser.phone || '',
      emergencyContact: freshUser.emergencyContact || '',
      bio: freshUser.bio || '',
      designation: freshUser.designation || 'Staff',
      role: freshUser.role,
      accountStatus: freshUser.accountStatus,
      departmentId: freshUser.departmentId || '',
      departmentName: department?.name || freshUser.departmentName || '',
      departmentCode: department?.code || '',
      assignedCenterIds: freshUser.assignedCenterIds || [],
      assignedCenterNames: centers.map((c) => c.name),
      centers: centers.map((c) => ({ id: c.id, name: c.name, code: c.code, address: c.address, photoUrl: c.photoUrl || c.logoUrl || '' })),
      avatarUrl: freshUser.avatarUrl || '',
      avatarMediaId: freshUser.avatarMediaId || '',
      avatarObjectKey: freshUser.avatarObjectKey || '',
      joiningDate: freshUser.joiningDate || '',
      createdAt: freshUser.createdAt || '',
      updatedAt: freshUser.updatedAt || '',
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    const { data, errorResponse } = await parseAndValidate(req, MobileProfileUpdateSchema);
    if (errorResponse) return errorResponse;

    const updates: Partial<UserProfile> = {
      updatedAt: new Date().toISOString(),
    };

    if (data!.phone !== undefined) updates.phone = data!.phone;
    if (data!.emergencyContact !== undefined) updates.emergencyContact = data!.emergencyContact;
    if (data!.bio !== undefined) updates.bio = data!.bio;
    if (data!.avatarUrl !== undefined) updates.avatarUrl = data!.avatarUrl;
    if (data!.avatarMediaId !== undefined) updates.avatarMediaId = data!.avatarMediaId;
    if (data!.avatarObjectKey !== undefined) updates.avatarObjectKey = data!.avatarObjectKey;

    await updateDocument(ERP_COLLECTIONS.employees, user.uid, updates);

    await logAuditAction({
      actorUid: user.uid,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'update_profile',
      resourceType: 'system',
      resourceId: user.uid,
      details: `Employee ${user.fullName} updated personal profile via mobile app.`,
    });

    const updated = { ...user, ...updates };

    return apiSuccess(
      {
        uid: updated.uid,
        employeeId: updated.employeeId,
        fullName: updated.fullName,
        phone: updated.phone || '',
        emergencyContact: updated.emergencyContact || '',
        bio: updated.bio || '',
        updatedAt: updated.updatedAt,
      },
      'Profile updated successfully'
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
