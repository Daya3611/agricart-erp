import { fetchCollection, fetchDocument, saveDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { AttendanceSession, GpsCoordinate, LocationCaptureStatus, LogoutType, UserProfile } from '@/types';
import { getOperationalDateString } from '@/lib/utils/date-utils';
import { logAuditAction } from '@/lib/services/audit-service';

/**
 * Auto-closes any lingering active attendance sessions from previous days at the 23:59:59.999 boundary.
 * Does not fabricate GPS.
 */
export async function closeStaleMidnightSessions(): Promise<number> {
  try {
    const todayStr = getOperationalDateString();
    // Fetch all active sessions
    const activeSessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
      { field: 'status', op: '==', value: 'active' },
    ])) as AttendanceSession[];

    let closedCount = 0;
    const now = new Date().toISOString();

    for (const session of activeSessions) {
      // If the session date is strictly before today in Asia/Kolkata
      if (session.date < todayStr) {
        const midnightBoundaryIso = `${session.date}T23:59:59.999+05:30`;
        const loginTime = session.loginAt || session.loginTimestamp;
        const durationMinutes = loginTime
          ? Math.max(0, Math.round((new Date(midnightBoundaryIso).getTime() - new Date(loginTime).getTime()) / 60000))
          : 0;

        await updateDocument(ERP_COLLECTIONS.attendanceSessions, session.id, {
          logoutTimestamp: midnightBoundaryIso,
          logoutAt: midnightBoundaryIso,
          logoutGps: null,
          logoutLocation: null,
          logoutLocationStatus: 'unavailable',
          logoutType: 'automatic_midnight' as LogoutType,
          status: 'closed',
          attendanceStatus: 'system_closed',
          systemClosed: true,
          attendanceDurationMinutes: durationMinutes,
          durationMinutes,
          syncStatus: 'synced',
          updatedAt: now,
        });
        closedCount++;
      }
    }

    return closedCount;
  } catch (err: any) {
    console.error('Error closing stale midnight sessions:', err.message);
    return 0;
  }
}

/**
 * Record attendance login for an employee.
 * Guarantees no duplicate session on page refresh or token refresh.
 */
export async function recordAttendanceLogin(
  user: UserProfile,
  gps?: GpsCoordinate | null,
  locationStatus: LocationCaptureStatus = 'unavailable'
): Promise<{ success: boolean; session: AttendanceSession; isNew: boolean; error?: string }> {
  // 1. Run midnight cleanup first
  await closeStaleMidnightSessions();

  const todayStr = getOperationalDateString();
  const sessionId = `att_${user.uid}_${todayStr}`;

  // 2. Check if a session already exists for today
  const existing = (await fetchDocument(ERP_COLLECTIONS.attendanceSessions, sessionId)) as AttendanceSession | null;

  if (existing) {
    if (existing.status === 'closed') {
      return {
        success: false,
        session: existing,
        isNew: false,
        error: 'Attendance has already been completed for today. Only one session per employee per day is permitted.',
      };
    }
    // If already exists and is active, return it without creating duplicates
    return {
      success: true,
      session: existing,
      isNew: false,
    };
  }

  // 3. Create fresh attendance session for today
  const now = new Date().toISOString();
  const hasGps = Boolean(gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number');

  const newSession: AttendanceSession = {
    id: sessionId,
    employeeUid: user.uid,
    employeeId: user.employeeId || '',
    employeeName: user.fullName || 'Staff Member',
    departmentId: user.departmentId || '',
    departmentName: user.departmentName || '',
    centerId: user.assignedCenterIds?.[0] || '',
    centerName: user.assignedCenterNames?.[0] || '',
    date: todayStr,
    attendanceDate: todayStr,
    loginTimestamp: now,
    loginAt: now,
    loginGps: hasGps ? gps! : null,
    loginLocation: hasGps ? gps! : null,
    loginLocationStatus: hasGps ? 'captured' : locationStatus,
    logoutTimestamp: null,
    logoutAt: null,
    logoutGps: null,
    logoutLocation: null,
    logoutLocationStatus: null,
    logoutType: null,
    status: 'active',
    attendanceStatus: 'active',
    systemClosed: false,
    attendanceDurationMinutes: 0,
    durationMinutes: 0,
    syncStatus: 'synced',
    createdAt: now,
    updatedAt: now,
  };

  await saveDocument(ERP_COLLECTIONS.attendanceSessions, sessionId, newSession);

  await logAuditAction({
    actorUid: user.uid,
    actorName: user.fullName,
    actorRole: user.role,
    action: 'attendance_login',
    resourceType: 'system',
    resourceId: sessionId,
    details: `Employee ${user.fullName} (${user.employeeId}) logged in for date ${todayStr}. Location status: ${newSession.loginLocationStatus}`,
  });

  return {
    success: true,
    session: newSession,
    isNew: true,
  };
}

/**
 * Record explicit attendance logout for an employee.
 */
export async function recordAttendanceLogout(
  user: UserProfile,
  gps?: GpsCoordinate | null,
  locationStatus: LocationCaptureStatus = 'unavailable'
): Promise<{ success: boolean; session?: AttendanceSession; error?: string }> {
  const todayStr = getOperationalDateString();
  const sessionId = `att_${user.uid}_${todayStr}`;

  let session = (await fetchDocument(ERP_COLLECTIONS.attendanceSessions, sessionId)) as AttendanceSession | null;

  if (session && session.status === 'closed') {
    return {
      success: false,
      session,
      error: 'Attendance has already been completed for today. Duplicate logout is not permitted.',
    };
  }

  // Fallback: look for any active session for this user
  if (!session || session.status !== 'active') {
    const userActiveSessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
      { field: 'employeeUid', op: '==', value: user.uid },
      { field: 'status', op: '==', value: 'active' },
    ])) as AttendanceSession[];
    if (userActiveSessions.length > 0) {
      session = userActiveSessions[0];
    } else {
      session = null;
    }
  }

  if (!session) {
    return { success: false, error: 'No active attendance session found. You must login before logging out.' };
  }

  const now = new Date().toISOString();
  const hasGps = Boolean(gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number');
  const loginTime = session.loginAt || session.loginTimestamp;
  const durationMinutes = loginTime
    ? Math.max(0, Math.round((new Date(now).getTime() - new Date(loginTime).getTime()) / 60000))
    : 0;

  const updatedFields: Partial<AttendanceSession> = {
    logoutTimestamp: now,
    logoutAt: now,
    logoutGps: hasGps ? gps! : null,
    logoutLocation: hasGps ? gps! : null,
    logoutLocationStatus: hasGps ? 'captured' : locationStatus,
    logoutType: 'explicit',
    status: 'closed',
    attendanceStatus: 'closed',
    systemClosed: false,
    attendanceDurationMinutes: durationMinutes,
    durationMinutes,
    syncStatus: 'synced',
    updatedAt: now,
  };

  await updateDocument(ERP_COLLECTIONS.attendanceSessions, session.id, updatedFields);

  const updatedSession = { ...session, ...updatedFields } as AttendanceSession;

  await logAuditAction({
    actorUid: user.uid,
    actorName: user.fullName,
    actorRole: user.role,
    action: 'attendance_logout',
    resourceType: 'system',
    resourceId: session.id,
    details: `Employee ${user.fullName} logged out. Duration: ${durationMinutes} mins. Location status: ${updatedFields.logoutLocationStatus}`,
  });

  return {
    success: true,
    session: updatedSession,
  };
}

/**
 * Get current day attendance session for an employee.
 */
export async function getTodayAttendanceSession(employeeUid: string): Promise<AttendanceSession | null> {
  await closeStaleMidnightSessions();
  const todayStr = getOperationalDateString();
  const sessionId = `att_${employeeUid}_${todayStr}`;
  const session = (await fetchDocument(ERP_COLLECTIONS.attendanceSessions, sessionId)) as AttendanceSession | null;
  return session;
}

/**
 * Fetch attendance sessions for an employee within a date range.
 */
export async function getAttendanceSessionsForEmployee(
  employeeUid: string,
  startDate: string,
  endDate: string
): Promise<AttendanceSession[]> {
  await closeStaleMidnightSessions();
  const sessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
    { field: 'employeeUid', op: '==', value: employeeUid },
  ])) as AttendanceSession[];

  return sessions.filter((s) => s.date >= startDate && s.date <= endDate);
}

/**
 * Fetch all attendance sessions for all employees within a date range.
 */
export async function getAllAttendanceSessionsForRange(
  startDate: string,
  endDate: string
): Promise<AttendanceSession[]> {
  await closeStaleMidnightSessions();
  const sessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions)) as AttendanceSession[];
  return sessions.filter((s) => s.date >= startDate && s.date <= endDate);
}
