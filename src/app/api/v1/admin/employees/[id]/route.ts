import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile, UserRole } from '@/types';
import { logAuditAction } from '@/lib/services/audit-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

const MobileEmployeeUpdateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'manager', 'staff']).optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  assignedCenterIds: z.array(z.string()).optional(),
  assignedCenterNames: z.array(z.string()).optional(),
  accountStatus: z.enum(['active', 'inactive', 'deactivated']).optional(),
  reportingManagerUid: z.string().optional(),
  emergencyContact: z.string().optional(),
  bio: z.string().max(500).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin', 'manager']);
    const { id: empId } = await params;

    const emp = (await fetchDocument(ERP_COLLECTIONS.employees, empId)) as UserProfile | null;
    if (!emp) {
      return apiError('Employee not found.', 404);
    }

    // Manager scoping check
    if (user.role === 'manager' && emp.uid !== user.uid) {
      const isDeptMatch = user.departmentId && emp.departmentId === user.departmentId;
      const isCenterMatch = emp.assignedCenterIds?.some((c) => user.assignedCenterIds?.includes(c));
      if (!isDeptMatch && !isCenterMatch) {
        return apiError('FORBIDDEN: Employee outside your managed scope.', 403);
      }
    }

    return apiSuccess(emp);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin']);
    const { id: empId } = await params;
    const body = await req.json();

    const parseResult = MobileEmployeeUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError('Validation failed', 400, parseResult.error.flatten().fieldErrors, 'VALIDATION_ERROR');
    }

    const emp = (await fetchDocument(ERP_COLLECTIONS.employees, empId)) as UserProfile | null;
    if (!emp) {
      return apiError('Employee not found.', 404);
    }

    const updates = parseResult.data;

    // Super Admin check for promoting to super_admin or admin
    if (updates.role && (updates.role === 'super_admin' || updates.role === 'admin') && user.role !== 'super_admin') {
      return apiError('FORBIDDEN: Only Super Administrators can grant administrative roles.', 403);
    }

    // Disallow self deactivation
    if (user.uid === empId && updates.accountStatus && updates.accountStatus !== 'active') {
      return apiError('You cannot deactivate your own account.', 400);
    }

    const now = new Date().toISOString();
    const patch: Partial<UserProfile> = {
      ...updates,
      role: updates.role as UserRole | undefined,
      updatedAt: now,
    };

    await updateDocument(ERP_COLLECTIONS.employees, empId, patch);

    await logAuditAction({
      actorUid: user.uid,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'update_employee',
      resourceType: 'user',
      resourceId: empId,
      details: `Admin ${user.fullName} updated profile for ${emp.fullName} (${emp.employeeId}). Changes: ${Object.keys(updates).join(', ')}`,
    });

    const merged = { ...emp, ...patch };

    return apiSuccess(merged, 'Employee updated successfully');
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
