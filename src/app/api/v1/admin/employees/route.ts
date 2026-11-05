import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchCollection, saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { UserProfile, UserRole } from '@/types';
import { generateUniqueEmployeeId, isEmployeeIdUnique } from '@/lib/services/employee-id-service';
import { logAuditAction } from '@/lib/services/audit-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

const MobileEmployeeCreateSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().optional(),
  designation: z.string().optional().default('Field Officer'),
  role: z.enum(['super_admin', 'admin', 'manager', 'staff']).default('staff'),
  departmentId: z.string().optional().default(''),
  departmentName: z.string().optional().default(''),
  assignedCenterIds: z.array(z.string()).default([]),
  assignedCenterNames: z.array(z.string()).default([]),
  reportingManagerUid: z.string().optional(),
  joiningDate: z.string().optional(),
  employeeId: z.string().optional(),
  password: z.string().min(6, 'Temporary password must be at least 6 characters').optional(),
});

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin', 'manager']);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const roleFilter = searchParams.get('role') || 'all';
    const deptFilter = searchParams.get('departmentId') || 'all';
    const centerFilter = searchParams.get('centerId') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let allEmployees = (await fetchCollection(ERP_COLLECTIONS.employees)) as UserProfile[];

    // Scoping for manager
    if (user.role === 'manager') {
      const managerDept = user.departmentId;
      const managerCenters = user.assignedCenterIds || [];
      allEmployees = allEmployees.filter((u) => {
        if (u.uid === user.uid) return true;
        const deptMatch = managerDept && u.departmentId === managerDept;
        const centerMatch = u.assignedCenterIds?.some((c) => managerCenters.includes(c));
        return deptMatch || centerMatch;
      });
    }

    // Filters
    let filtered = allEmployees.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (deptFilter !== 'all' && u.departmentId !== deptFilter) return false;
      if (centerFilter !== 'all' && !u.assignedCenterIds?.includes(centerFilter)) return false;
      if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false;
      if (search) {
        const matchesName = u.fullName?.toLowerCase().includes(search);
        const matchesEmail = u.email?.toLowerCase().includes(search);
        const matchesEmpId = u.employeeId?.toLowerCase().includes(search);
        const matchesPhone = u.phone?.toLowerCase().includes(search);
        return matchesName || matchesEmail || matchesEmpId || matchesPhone;
      }
      return true;
    });

    filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return apiSuccess(paginated, undefined, {
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin']);
    const body = await req.json();

    const parseResult = MobileEmployeeCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError('Validation failed', 400, parseResult.error.flatten().fieldErrors, 'VALIDATION_ERROR');
    }

    const data = parseResult.data;

    // Super admin role restriction
    if ((data.role === 'super_admin' || data.role === 'admin') && user.role !== 'super_admin') {
      return apiError('FORBIDDEN: Only Super Administrators can provision Admin accounts.', 403);
    }

    let employeeId = data.employeeId?.trim().toUpperCase();
    if (employeeId) {
      const isUnique = await isEmployeeIdUnique(employeeId);
      if (!isUnique) {
        return apiError(`Employee ID "${employeeId}" is already assigned to another employee.`, 400);
      }
    } else {
      employeeId = await generateUniqueEmployeeId();
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // Check duplicate email
    const existing = await fetchCollection(ERP_COLLECTIONS.employees, [
      { field: 'email', op: '==', value: normalizedEmail },
    ]);
    if (existing.length > 0) {
      return apiError(`An employee with email "${normalizedEmail}" already exists.`, 400);
    }

    const now = new Date().toISOString();
    let firebaseUid = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Create Firebase Auth user if credentials configured
    if (hasValidAdminCredentials) {
      try {
        const authUser = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: data.fullName,
          password: data.password || 'Agricart@123',
          disabled: false,
        });
        firebaseUid = authUser.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          try {
            const existingAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
            firebaseUid = existingAuthUser.uid;
          } catch {
            return apiError('Email already registered in Firebase Authentication.', 400);
          }
        } else {
          return apiError(`Firebase Auth user creation failed: ${authErr.message}`, 400);
        }
      }
    }

    const newEmployee: UserProfile = {
      uid: firebaseUid,
      employeeId,
      fullName: data.fullName,
      email: normalizedEmail,
      phone: data.phone || '',
      designation: data.designation || 'Field Officer',
      role: data.role as UserRole,
      departmentId: data.departmentId || '',
      departmentName: data.departmentName || '',
      assignedCenterIds: data.assignedCenterIds || [],
      assignedCenterNames: data.assignedCenterNames || [],
      reportingManagerUid: data.reportingManagerUid || '',
      accountStatus: 'active',
      joiningDate: data.joiningDate || now.split('T')[0],
      createdAt: now,
      updatedAt: now,
      createdByUid: user.uid,
    };

    await saveDocument(ERP_COLLECTIONS.employees, firebaseUid, newEmployee);

    await logAuditAction({
      actorUid: user.uid,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'create_employee',
      resourceType: 'user',
      resourceId: firebaseUid,
      details: `Created new employee ${data.fullName} (${employeeId}, ${data.role})`,
    });

    return apiSuccess(newEmployee, 'Employee created successfully', undefined, 201);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
