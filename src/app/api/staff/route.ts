import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser, StaffCreateSchema } from '@/lib/auth/permissions';
import { fetchCollection, saveDocument, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/resend';
import { getStaffInvitationEmail } from '@/lib/email/templates';
import { logAuditAction } from '@/lib/services/audit-service';
import { generateUniqueEmployeeId, isEmployeeIdUnique } from '@/lib/services/employee-id-service';
import { UserProfile } from '@/types';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const roleFilter = searchParams.get('role') || 'all';
    const deptFilter = searchParams.get('departmentId') || 'all';
    const centerFilter = searchParams.get('centerId') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // 1. Staff can only access their own profile
    if (sessionUser.role === 'staff') {
      const ownProfile = (await fetchDocument(ERP_COLLECTIONS.employees, sessionUser.uid)) as UserProfile | null;
      return NextResponse.json({
        success: true,
        users: [ownProfile || sessionUser],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    }

    const allEmployees = (await fetchCollection(ERP_COLLECTIONS.employees)) as UserProfile[];

    // 2. Managers are restricted to their assigned department or centers
    let scopedEmployees = allEmployees;
    if (sessionUser.role === 'manager') {
      const managerDept = sessionUser.departmentId;
      const managerCenters = sessionUser.assignedCenterIds || [];

      scopedEmployees = allEmployees.filter((u) => {
        if (u.uid === sessionUser.uid) return true;
        const deptMatch = managerDept && u.departmentId === managerDept;
        const centerMatch = u.assignedCenterIds?.some((c) => managerCenters.includes(c));
        return deptMatch || centerMatch;
      });
    }

    // 3. Search and filtering
    let filtered = scopedEmployees.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (deptFilter !== 'all' && u.departmentId !== deptFilter) return false;
      if (centerFilter !== 'all' && !u.assignedCenterIds?.includes(centerFilter)) return false;
      if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false;

      if (search) {
        const matchName = (u.fullName || '').toLowerCase().includes(search);
        const matchEmail = (u.email || '').toLowerCase().includes(search);
        const matchEmpId = (u.employeeId || '').toLowerCase().includes(search);
        const matchPhone = (u.phone || '').toLowerCase().includes(search);
        if (!matchName && !matchEmail && !matchEmpId && !matchPhone) return false;
      }

      return true;
    });

    // 4. Sorting
    filtered.sort((a, b) => {
      let valA: any = (a as any)[sortBy] || '';
      let valB: any = (b as any)[sortBy] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      users: paginatedUsers,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    if (err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message, users: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAdmin();
    const body = await req.json();

    const parseResult = StaffCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      fullName,
      email,
      phone,
      designation,
      role,
      departmentId,
      assignedCenterIds,
      reportingManagerUid,
      workScheduleId,
      joiningDate,
    } = parseResult.data;

    let employeeId = parseResult.data.employeeId?.trim().toUpperCase();

    // Ensure Employee ID is unique using concurrency-safe check
    if (employeeId) {
      const isUnique = await isEmployeeIdUnique(employeeId);
      if (!isUnique) {
        return NextResponse.json(
          { success: false, error: `Employee ID "${employeeId}" is already assigned to another employee.` },
          { status: 400 }
        );
      }
    } else {
      employeeId = await generateUniqueEmployeeId();
    }

    // Super Admin-only actions: only Super Admin can create admin or super_admin accounts
    if ((role === 'super_admin' || role === 'admin') && sessionUser.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Only Super Administrators can provision Admin accounts.' },
        { status: 403 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if employee already exists in erp_emp with this email
    const existingEmpByEmail = await fetchCollection(ERP_COLLECTIONS.employees, [
      { field: 'email', op: '==', value: normalizedEmail },
    ]);
    if (existingEmpByEmail.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An employee profile with this email address already exists.' },
        { status: 400 }
      );
    }

    let uid = `emp_${Date.now()}`;
    let setupUrl = `${process.env.APP_URL || 'http://localhost:3000'}/setup-password?email=${encodeURIComponent(normalizedEmail)}`;
    let invitationStatus: 'pending' | 'sent' = 'pending';

    let createdAuthAccount = false;

    if (hasValidAdminCredentials) {
      try {
        let authUser;
        try {
          authUser = await adminAuth.getUserByEmail(normalizedEmail);
        } catch {
          authUser = await adminAuth.createUser({
            email: normalizedEmail,
            displayName: fullName,
            phoneNumber: phone && phone.startsWith('+') ? phone : undefined,
          });
          createdAuthAccount = true;
        }

        uid = authUser.uid;

        // Set custom user claims for role
        if (role) {
          await adminAuth.setCustomUserClaims(uid, { role, admin: role === 'admin' || role === 'super_admin' });
        }

        const link = await adminAuth.generatePasswordResetLink(normalizedEmail);
        setupUrl = link;
      } catch (authErr: any) {
        console.warn('Firebase Admin Auth createUser note:', authErr.message);
      }
    }

    // Resolve department and center names
    let departmentName = 'Field Operations & Procurement';
    if (departmentId) {
      const deptDoc = await fetchDocument(ERP_COLLECTIONS.departments, departmentId);
      if (deptDoc) departmentName = (deptDoc as any).name || departmentName;
    }

    let assignedCenterNames: string[] = [];
    if (assignedCenterIds && assignedCenterIds.length > 0) {
      for (const cId of assignedCenterIds) {
        const cDoc = await fetchDocument(ERP_COLLECTIONS.centers, cId);
        if (cDoc) assignedCenterNames.push((cDoc as any).name);
      }
    }

    let reportingManagerName = '';
    if (reportingManagerUid) {
      const mgrDoc = await fetchDocument(ERP_COLLECTIONS.employees, reportingManagerUid);
      if (mgrDoc) reportingManagerName = (mgrDoc as any).fullName || '';
    }

    const now = new Date().toISOString();
    const employeeProfile: UserProfile = {
      uid,
      employeeId,
      fullName,
      email: normalizedEmail,
      phone: phone || '',
      role: role || 'staff',
      departmentId: departmentId || 'dept_field_ops',
      departmentName,
      assignedCenterIds: assignedCenterIds || [],
      assignedCenterNames,
      reportingManagerUid: reportingManagerUid || '',
      reportingManagerName,
      designation: designation || 'Field Officer',
      joiningDate: joiningDate || now.split('T')[0],
      workScheduleId: workScheduleId || 'sched_standard',
      accountStatus: 'active',
      invitationStatus: 'pending',
      createdByUid: sessionUser.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Save profile to erp_emp with UID as document ID
    const saveRes = await saveDocument(ERP_COLLECTIONS.employees, uid, employeeProfile);
    if (!saveRes.success) {
      // Safe recovery if Firestore save fails
      if (createdAuthAccount) {
        try {
          await adminAuth.deleteUser(uid);
        } catch { }
      }
      return NextResponse.json({ success: false, error: saveRes.error }, { status: 500 });
    }

    // Send invitation email via Resend
    try {
      const { subject, html } = getStaffInvitationEmail({
        recipientName: fullName,
        employeeId,
        setupUrl,
        role: role || 'staff',
      });

      const emailRes = await sendEmail({
        to: normalizedEmail,
        subject,
        html,
        emailType: 'staff_invitation',
        staffUid: uid,
      });

      if (emailRes.success) {
        invitationStatus = 'sent';
        await saveDocument(ERP_COLLECTIONS.employees, uid, { invitationStatus: 'sent' });
        employeeProfile.invitationStatus = 'sent';
      }
    } catch (emailErr: any) {
      console.warn('Failed to send invitation email via Resend:', emailErr.message);
    }

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'create_employee',
      resourceType: 'user',
      resourceId: uid,
      details: `Created employee record in erp_emp for ${fullName} (${employeeId}) - role: ${role}`,
    });

    return NextResponse.json({ success: true, user: employeeProfile });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
