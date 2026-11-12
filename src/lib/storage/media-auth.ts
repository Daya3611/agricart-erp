import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { getServerSession } from '@/lib/auth/session';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile } from '@/types';
import { MediaEntityType, MediaRecord } from './media-types';

const ALLOWED_ENTITY_TYPES = new Set<MediaEntityType>([
  'product',
  'farmer',
  'center',
  'user',
  'report',
  'activity',
  'leave',
  'organization',
  'document',
]);

export function parseMediaEntityType(raw: string | null | undefined): MediaEntityType {
  const val = (raw || '').trim().toLowerCase() as MediaEntityType;
  if (!ALLOWED_ENTITY_TYPES.has(val)) {
    throw new Error(
      'INVALID_ENTITY_TYPE: entityType must be one of product, farmer, center, user, report, activity, leave, organization, document.'
    );
  }
  return val;
}

/**
 * Strictly authenticates the caller via Firebase Bearer token OR verified web session cookie.
 * Never bypasses authentication in development or production.
 */
export async function requireStrictMediaUser(req: Request): Promise<UserProfile> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new Error('UNAUTHORIZED: Missing bearer token.');
    }
    if (!hasValidAdminCredentials) {
      throw new Error('UNAUTHORIZED: Server authentication credentials not configured.');
    }
    let decoded: { uid?: string; email?: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      throw new Error('UNAUTHORIZED: Invalid or expired authentication token.');
    }

    let profile = decoded.uid
      ? ((await fetchDocument(ERP_COLLECTIONS.employees, decoded.uid)) as UserProfile | null)
      : null;

    if (!profile && decoded.email) {
      const matches = (await fetchCollection(ERP_COLLECTIONS.employees, [
        { field: 'email', op: '==', value: decoded.email.toLowerCase().trim() },
      ])) as UserProfile[];
      if (matches.length > 0) profile = matches[0];
    }

    if (!profile) {
      throw new Error('UNAUTHORIZED: Employee account not found.');
    }
    if (profile.accountStatus !== 'active') {
      throw new Error('FORBIDDEN: Account is inactive or deactivated.');
    }
    return profile;
  }

  const sessionUser = await getServerSession();
  if (!sessionUser) {
    throw new Error('UNAUTHORIZED: Valid session or bearer token required.');
  }
  if (sessionUser.accountStatus !== 'active') {
    throw new Error('FORBIDDEN: Account is inactive or deactivated.');
  }
  return sessionUser;
}

function managerCoversUser(manager: UserProfile, targetUser: UserProfile): boolean {
  if (manager.uid === targetUser.uid) return true;
  const deptMatch = Boolean(manager.departmentId && targetUser.departmentId === manager.departmentId);
  const centerMatch = Boolean(
    targetUser.assignedCenterIds?.some((c) => manager.assignedCenterIds?.includes(c))
  );
  return deptMatch || centerMatch;
}

function managerCoversCenter(manager: UserProfile, centerId?: string): boolean {
  if (!centerId) return false;
  return Boolean(manager.assignedCenterIds?.includes(centerId));
}

export async function assertCanUploadMedia(params: {
  user: UserProfile;
  entityType: MediaEntityType;
  entityId: string;
  centerId?: string;
}): Promise<void> {
  const { user, entityType, entityId, centerId } = params;

  if (user.role === 'super_admin') return;

  if (entityType === 'organization') {
    if (user.role !== 'admin') {
      throw new Error('FORBIDDEN: Only administrators can modify organization branding media.');
    }
    return;
  }

  if (user.role === 'admin') {
    if (entityType === 'user' && entityId !== user.uid) {
      const targetUser = (await fetchDocument(ERP_COLLECTIONS.employees, entityId)) as UserProfile | null;
      if (targetUser?.role === 'super_admin') {
        throw new Error('FORBIDDEN: Only a Super Admin can modify another Super Admin profile media.');
      }
    }
    return;
  }

  if (user.role === 'manager') {
    if (entityType === 'user') {
      if (entityId === user.uid) return;
      const targetUser = (await fetchDocument(ERP_COLLECTIONS.employees, entityId)) as UserProfile | null;
      if (!targetUser || !managerCoversUser(user, targetUser)) {
        throw new Error('FORBIDDEN: You can only manage profile media for staff in your department or centers.');
      }
      return;
    }

    if (entityType === 'center') {
      if (!managerCoversCenter(user, entityId)) {
        throw new Error('FORBIDDEN: You can only upload media for your assigned center.');
      }
      return;
    }

    if (['product', 'farmer', 'document'].includes(entityType)) {
      if (centerId && !managerCoversCenter(user, centerId)) {
        throw new Error('FORBIDDEN: You cannot upload media outside your assigned center.');
      }
      return;
    }

    // report / activity / leave
    return;
  }

  // Staff role restrictions
  if (entityType === 'user') {
    if (entityId !== user.uid) {
      throw new Error('FORBIDDEN: Staff can only update their own profile photo.');
    }
    return;
  }

  if (entityType === 'report' || entityType === 'activity') {
    const existingReport = (await fetchDocument(ERP_COLLECTIONS.fieldReports, entityId)) as any;
    if (existingReport && existingReport.staffUid && existingReport.staffUid !== user.uid) {
      throw new Error('FORBIDDEN: You cannot upload attachments to another employee report.');
    }
    const existingActivity = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, entityId)) as any;
    if (existingActivity && existingActivity.staffUid && existingActivity.staffUid !== user.uid) {
      throw new Error('FORBIDDEN: You cannot upload evidence to another employee activity.');
    }
    return;
  }

  if (entityType === 'leave') {
    const leaveDoc = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, entityId)) as any;
    if (leaveDoc && leaveDoc.staffUid && leaveDoc.staffUid !== user.uid) {
      throw new Error('FORBIDDEN: You can only upload supporting documents for your own leave requests.');
    }
    return;
  }

  throw new Error(`FORBIDDEN: Staff role is not authorized to upload ${entityType} media.`);
}

export async function assertCanAccessMedia(user: UserProfile, record: MediaRecord): Promise<void> {
  if (record.isPublic) return;
  if (user.role === 'super_admin' || user.role === 'admin') return;
  if (record.uploadedBy === user.uid) return;
  if (record.entityType === 'user' && record.entityId === user.uid) return;

  if (user.role === 'manager') {
    if (record.centerId && managerCoversCenter(user, record.centerId)) return;
    const owner = (await fetchDocument(ERP_COLLECTIONS.employees, record.uploadedBy)) as UserProfile | null;
    if (owner && managerCoversUser(user, owner)) return;
    throw new Error('FORBIDDEN: You do not have permission to access media outside your department or center.');
  }

  // Staff can access their own report/activity/leave media or media for their own entity
  if (
    (record.entityType === 'report' || record.entityType === 'activity') &&
    record.entityId
  ) {
    const report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, record.entityId)) as any;
    if (report?.staffUid === user.uid) return;
    const activity = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, record.entityId)) as any;
    if (activity?.staffUid === user.uid) return;
  }

  throw new Error('FORBIDDEN: You do not have permission to access this media file.');
}

export async function assertCanDeleteMedia(user: UserProfile, record: MediaRecord): Promise<void> {
  if (user.role === 'super_admin') return;

  if (record.entityType === 'organization') {
    if (user.role !== 'admin') {
      throw new Error('FORBIDDEN: Only administrators can delete organization branding media.');
    }
    return;
  }

  if (user.role === 'admin') {
    if (record.entityType === 'user') {
      const targetUser = (await fetchDocument(ERP_COLLECTIONS.employees, record.entityId)) as UserProfile | null;
      if (targetUser?.role === 'super_admin') {
        throw new Error('FORBIDDEN: Admin cannot delete Super Admin media.');
      }
    }
    return;
  }

  if (user.role === 'manager') {
    if (record.uploadedBy === user.uid) return;
    if (record.centerId && managerCoversCenter(user, record.centerId)) return;
    if (record.entityType === 'center' && managerCoversCenter(user, record.entityId)) return;
    const owner = (await fetchDocument(ERP_COLLECTIONS.employees, record.uploadedBy)) as UserProfile | null;
    if (owner && managerCoversUser(user, owner)) return;
    throw new Error('FORBIDDEN: Managers can only delete media within their assigned department or center.');
  }

  // Staff can only delete their own uploaded profile/report/activity/leave media
  if (
    record.uploadedBy === user.uid &&
    ['user', 'report', 'activity', 'leave'].includes(record.entityType)
  ) {
    return;
  }

  throw new Error('FORBIDDEN: You do not have permission to delete this media file.');
}

