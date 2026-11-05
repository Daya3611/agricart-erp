import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError, handleCorsPreflight } from '@/lib/api/v1-helper';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { Department, Center } from '@/types';
import { hasRolePermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    // Fetch department details if available
    let department: Department | null = null;
    if (user.departmentId) {
      department = (await fetchDocument(ERP_COLLECTIONS.departments, user.departmentId)) as Department | null;
    }

    // Fetch assigned centers if available
    const centers: Center[] = [];
    if (user.assignedCenterIds && user.assignedCenterIds.length > 0) {
      for (const centerId of user.assignedCenterIds) {
        const c = (await fetchDocument(ERP_COLLECTIONS.centers, centerId)) as Center | null;
        if (c) centers.push(c);
      }
    }

    const permissions = {
      role: user.role,
      isSuperAdmin: user.role === 'super_admin',
      isAdmin: hasRolePermission(user.role, 'admin'),
      isManager: user.role === 'manager',
      isStaff: user.role === 'staff',
      canReviewReports: hasRolePermission(user.role, 'manager'),
      canManageStaff: hasRolePermission(user.role, 'admin'),
      canApproveLeaves: hasRolePermission(user.role, 'manager'),
      canViewLiveMonitor: hasRolePermission(user.role, 'admin'),
      canAccessAdminPanel: hasRolePermission(user.role, 'manager'),
    };

    const responseData = {
      uid: user.uid,
      employeeId: user.employeeId || '',
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      designation: user.designation || 'Field Officer',
      role: user.role,
      accountStatus: user.accountStatus,
      departmentId: user.departmentId || '',
      departmentName: department?.name || user.departmentName || '',
      departmentCode: department?.code || '',
      assignedCenterIds: user.assignedCenterIds || [],
      assignedCenterNames: centers.map((c) => c.name),
      centers: centers.map((c) => ({ id: c.id, name: c.name, code: c.code, address: c.address })),
      emergencyContact: user.emergencyContact || '',
      bio: user.bio || '',
      joiningDate: user.joiningDate || '',
      workScheduleId: user.workScheduleId || '',
      reportingManagerUid: user.reportingManagerUid || '',
      permissions,
    };

    return apiSuccess(responseData, 'Authentication successful', undefined, 200, req);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status, undefined, undefined, req);
  }
}

