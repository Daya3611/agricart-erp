import { UserRole, UserProfile } from '@/types';
import { getServerSession } from '@/lib/auth/session';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  staff: 1,
};

export function hasRolePermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageStaff(actorRole: UserRole): boolean {
  return hasRolePermission(actorRole, 'admin');
}

export function canManageDepartments(actorRole: UserRole): boolean {
  return hasRolePermission(actorRole, 'admin');
}

export function canManageCenters(actorRole: UserRole): boolean {
  return hasRolePermission(actorRole, 'admin');
}

export function canReviewReports(
  actorRole: UserRole,
  actorDepartmentId?: string,
  targetDepartmentId?: string,
  actorAssignedCenterIds: string[] = [],
  targetCenterId?: string
): boolean {
  if (hasRolePermission(actorRole, 'admin')) {
    return true;
  }
  if (actorRole === 'manager') {
    const isDeptMatch = actorDepartmentId && targetDepartmentId && actorDepartmentId === targetDepartmentId;
    const isCenterMatch = targetCenterId && actorAssignedCenterIds.includes(targetCenterId);
    return Boolean(isDeptMatch || isCenterMatch);
  }
  return false;
}

export function canViewAuditLogs(actorRole: UserRole): boolean {
  return hasRolePermission(actorRole, 'admin');
}

export function canEditSystemSettings(actorRole: UserRole): boolean {
  return actorRole === 'super_admin';
}

// Server Authorization Guard Helpers
export async function requireAuthenticatedUser(): Promise<UserProfile> {
  const sessionUser = await getServerSession();
  if (!sessionUser) {
    throw new Error('UNAUTHORIZED: Authentication session required.');
  }
  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    throw new Error('FORBIDDEN: Account is deactivated.');
  }
  return sessionUser;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<UserProfile> {
  const user = await requireAuthenticatedUser();
  if (!allowedRoles.includes(user.role) && !hasRolePermission(user.role, 'super_admin')) {
    throw new Error(`FORBIDDEN: Required role: ${allowedRoles.join(', ')}.`);
  }
  return user;
}

export async function requireAdmin(): Promise<UserProfile> {
  return requireRole(['admin', 'super_admin']);
}

export async function requireSuperAdmin(): Promise<UserProfile> {
  return requireRole(['super_admin']);
}

export async function requireStaff(): Promise<UserProfile> {
  const user = await requireAuthenticatedUser();
  if (user.role !== 'staff') {
    throw new Error('FORBIDDEN: Staff access required.');
  }
  return user;
}

export async function requireManagerAccess(departmentId?: string, centerId?: string): Promise<UserProfile> {
  const user = await requireAuthenticatedUser();
  if (hasRolePermission(user.role, 'admin')) {
    return user;
  }
  if (user.role === 'manager') {
    if (departmentId && user.departmentId && user.departmentId !== departmentId) {
      throw new Error('FORBIDDEN: Restricted to assigned department.');
    }
    if (centerId && user.assignedCenterIds && !user.assignedCenterIds.includes(centerId)) {
      throw new Error('FORBIDDEN: Restricted to assigned centers.');
    }
    return user;
  }
  throw new Error('FORBIDDEN: Manager or Admin access required.');
}

export async function requireReportOwnership(reportId: string): Promise<{ user: UserProfile; report: any }> {
  const user = await requireAuthenticatedUser();
  const reportDoc = await fetchDocument(ERP_COLLECTIONS.dailyReports, reportId);
  if (!reportDoc) {
    throw new Error('NOT_FOUND: Daily report not found.');
  }
  const report = reportDoc as any;

  if (hasRolePermission(user.role, 'admin')) {
    return { user, report };
  }
  if (user.role === 'manager' && canReviewReports(user.role, user.departmentId, report.departmentId, user.assignedCenterIds, report.centerId)) {
    return { user, report };
  }
  if (user.role === 'staff' && report.staffUid === user.uid) {
    return { user, report };
  }
  throw new Error('FORBIDDEN: You do not have permission to access or edit this report.');
}

// Zod Validation Schemas
export const StaffCreateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  employeeId: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  designation: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'manager', 'staff']),
  departmentId: z.string().min(1, 'Department is required'),
  assignedCenterIds: z.array(z.string()).default([]),
  reportingManagerUid: z.string().optional(),
  workScheduleId: z.string().optional(),
  joiningDate: z.string().optional(),
});

export const ReportCreateSchema = z.object({
  id: z.string().optional(),
  reportDate: z.string().min(10, 'Report date is required'),
  workLocation: z.string().min(2, 'Work location is required'),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
  activities: z.string().min(5, 'Activities description required'),
  completedTasks: z.string().min(2, 'Completed tasks required'),
  farmersVisited: z.number().nonnegative().default(0),
  meetingsConducted: z.number().nonnegative().default(0),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  pendingWork: z.string().optional(),
  supportRequired: z.string().optional(),
  nextDayPlan: z.string().optional(),
  remarks: z.string().optional(),
  attachments: z.array(z.any()).default([]),
  submitNow: z.boolean().default(false),
});

export const ReportReviewSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  status: z.enum(['approved', 'correction_requested', 'edit_requested', 'rejected']),
  comment: z.string().default(''),
});

export const ReportEditRequestSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  reason: z.string().trim().min(1, 'Reason for requesting edit is required').max(1000),
  instructions: z.string().max(2000).optional().default(''),
});

export const StaffProfileUpdateSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
});


