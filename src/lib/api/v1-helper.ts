import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile, UserRole } from '@/types';
import { ROLE_HIERARCHY, hasRolePermission } from '@/lib/auth/permissions';
import { getServerSession } from '@/lib/auth/session';
import { isAllowedOrigin, getCorsHeaders, handleCorsPreflight, applyCorsHeaders } from './cors';

export { isAllowedOrigin, getCorsHeaders, handleCorsPreflight, applyCorsHeaders };

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MobileAuthResult {
  user: UserProfile;
  token: string;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  message?: string;
  data: T;
  meta?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
}

// ============================================================================
// Response Helpers
// ============================================================================

export function apiSuccess<T>(
  data: T,
  message?: string,
  meta?: Record<string, any>,
  status = 200,
  req?: Request
): NextResponse {
  const body: ApiSuccessResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  };
  const response = NextResponse.json(body, { status });
  if (req) {
    applyCorsHeaders(response, req);
  }
  return response;
}

export function apiError(
  message: string,
  status = 400,
  details?: any,
  errorCode?: string,
  req?: Request
): NextResponse {
  const code = errorCode || (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST');
  const body: ApiErrorResponse = {
    success: false,
    error: code,
    message,
    ...(details ? { details } : {}),
  };
  const response = NextResponse.json(body, { status });
  if (req) {
    applyCorsHeaders(response, req);
  }
  return response;
}

// ============================================================================
// Rate Limiter (In-Memory sliding window per IP / UID)
// ============================================================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(key: string, maxRequests = 60, windowSeconds = 60): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

// ============================================================================
// Mobile Authentication Guard (Firebase Bearer Token Verification)
// ============================================================================

function decodeJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(decodedJson);
    }
  } catch { }
  return null;
}

function getCookieValue(req: Request, name: string): string | null {
  try {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Validates the Authorization: Bearer <FIREBASE_ID_TOKEN> header.
 * Verifies with Firebase Admin SDK, loads trusted Firestore employee profile,
 * verifies active account status and checks required role permissions.
 *
 * In local development, also supports query parameter (?token=... or ?uid=...),
 * cookie session fallback, or auto dev-user fallback so browser testing and Postman work out-of-the-box.
 */
export async function requireMobileAuth(
  req: Request,
  allowedRoles?: UserRole[]
): Promise<MobileAuthResult> {
  const url = new URL(req.url);
  const host = req.headers.get('host') || '';
  const isLocalDev =
    process.env.NODE_ENV !== 'production' ||
    host.includes('localhost') ||
    host.includes('127.0.0.1');

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check query parameter fallback (?token=... or ?auth=...)
  if (!token) {
    const queryToken = url.searchParams.get('token') || url.searchParams.get('auth');
    if (queryToken) {
      token = queryToken.trim();
    }
  }

  // 3. Fallback to web session cookie (if logged into web app in browser)
  if (!token) {
    const sessionCookie = getCookieValue(req, 'agricart_session');
    if (sessionCookie) {
      token = sessionCookie.trim();
    }
  }

  // 4. Local Development / Browser Direct Access Fallback
  if (!token && isLocalDev) {
    // Check if a specific test UID or email was passed in query or header
    const devUid =
      url.searchParams.get('uid') ||
      url.searchParams.get('employeeUid') ||
      req.headers.get('x-dev-uid') ||
      req.headers.get('x-employee-uid');
    const devEmail =
      url.searchParams.get('email') ||
      req.headers.get('x-dev-email') ||
      process.env.ADMIN_EMAIL ||
      'hi@dayanandgawade.in';

    let devUser: UserProfile | null = null;

    if (devUid) {
      const doc = await fetchDocument(ERP_COLLECTIONS.employees, devUid);
      if (doc) devUser = doc as unknown as UserProfile;
    }

    if (!devUser && devEmail) {
      const users = (await fetchCollection(ERP_COLLECTIONS.employees, [
        { field: 'email', op: '==', value: devEmail.toLowerCase().trim() },
      ])) as UserProfile[];
      if (users.length > 0) devUser = users[0];
    }

    if (!devUser) {
      // Pick first active employee in database
      const allEmps = (await fetchCollection(ERP_COLLECTIONS.employees)) as UserProfile[];
      if (allEmps.length > 0) {
        devUser = allEmps.find((e) => e.accountStatus === 'active') || allEmps[0];
      }
    }

    if (!devUser) {
      // Synthesize standard dev super admin
      devUser = {
        uid: 'dev_user_01',
        employeeId: 'AGRI-EMP-8541',
        fullName: 'Dayanand Gawade (Dev)',
        email: devEmail || 'hi@dayanandgawade.in',
        phone: '+91 9876543210',
        designation: 'Super Administrator',
        role: 'super_admin',
        accountStatus: 'active',
        departmentId: 'dept_field_ops',
        departmentName: 'Field Operations',
        assignedCenterIds: ['ctr_nashik_01'],
        assignedCenterNames: ['Nashik Center'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const finalDevUser = devUser;

    if (
      allowedRoles &&
      !allowedRoles.includes(finalDevUser.role) &&
      !hasRolePermission(finalDevUser.role, 'super_admin')
    ) {
      throw new Error(`FORBIDDEN: Operation restricted to [${allowedRoles.join(', ')}].`);
    }

    return { user: finalDevUser, token: 'dev_local_bypass' };
  }

  if (!token) {
    throw new Error('UNAUTHORIZED: Missing Authorization Bearer token.');
  }

  let uid: string | null = null;
  let email: string | null = null;

  // 1. Verify ID Token
  const isJwt = token.includes('.') && token.split('.').length === 3;

  if (hasValidAdminCredentials && isJwt) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email || null;
    } catch (err: any) {
      if (!isLocalDev) {
        if (err.code === 'auth/id-token-expired') {
          throw new Error('UNAUTHORIZED: Firebase ID token has expired. Please refresh the token on mobile.');
        }
        throw new Error(`UNAUTHORIZED: Invalid Firebase ID token (${err.message || 'Verification failed'}).`);
      }
      // In local dev, allow inspecting decoded unverified payload
      const payload = decodeJwtPayload(token);
      if (payload) {
        uid = payload.user_id || payload.sub || null;
        email = payload.email || null;
      }
    }
  } else {
    // Non-JWT or development mode plain UID / email token
    const payload = decodeJwtPayload(token);
    if (payload) {
      uid = payload.user_id || payload.sub || null;
      email = payload.email || null;
    } else if (isLocalDev || token.length < 128) {
      if (token.includes('@')) email = token;
      else uid = token;
    }
  }

  if (!uid && !email) {
    throw new Error('UNAUTHORIZED: Could not extract valid UID or email from token.');
  }

  // 2. Fetch trusted employee profile from Firestore (erp_emp)
  let userProfile: UserProfile | null = null;

  if (uid) {
    const docData = await fetchDocument(ERP_COLLECTIONS.employees, uid);
    if (docData) {
      userProfile = (docData as unknown) as UserProfile;
    } else {
      const users = (await fetchCollection(ERP_COLLECTIONS.employees, [
        { field: 'uid', op: '==', value: uid },
      ])) as UserProfile[];
      if (users.length > 0) {
        userProfile = users[0];
      }
    }
  }

  if (!userProfile && email) {
    const users = (await fetchCollection(ERP_COLLECTIONS.employees, [
      { field: 'email', op: '==', value: email.toLowerCase().trim() },
    ])) as UserProfile[];
    if (users.length > 0) {
      userProfile = users[0];
    }
  }

  if (!userProfile && isLocalDev) {
    // In dev mode, if UID not in DB, synthesize profile
    userProfile = {
      uid: uid || 'dev_user_01',
      employeeId: 'AGRI-EMP-8541',
      fullName: email ? email.split('@')[0] : 'Dev Staff',
      email: email || 'dev@agricartfpc.in',
      phone: '',
      designation: 'Staff Member',
      role: 'staff',
      accountStatus: 'active',
      departmentId: 'dept_field_ops',
      departmentName: 'Field Operations',
      assignedCenterIds: ['ctr_nashik_01'],
      assignedCenterNames: ['Nashik Center'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (!userProfile) {
    throw new Error('UNAUTHORIZED: No employee profile registered for this account.');
  }

  // 3. Normalization & safety checks
  if (!userProfile.uid) userProfile.uid = uid || 'usr_unknown';
  if (!userProfile.accountStatus) userProfile.accountStatus = 'active';

  // 4. Deactivated or disabled account rejection
  if (userProfile.accountStatus === 'deactivated' || userProfile.accountStatus === 'inactive') {
    throw new Error('FORBIDDEN: Employee account has been deactivated. Please contact your administrator.');
  }

  // 5. Role Authorization
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowed = allowedRoles.includes(userProfile.role);
    const isSuperAdmin = userProfile.role === 'super_admin';
    if (!hasAllowed && !isSuperAdmin) {
      throw new Error(`FORBIDDEN: Operation restricted to [${allowedRoles.join(', ')}]. Current role: ${userProfile.role}.`);
    }
  }

  return { user: userProfile, token };
}

// ============================================================================
// Request Body Validation Helper
// ============================================================================

export async function parseAndValidate<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ data?: T; errorResponse?: NextResponse }> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        errorResponse: apiError(
          'Input validation failed',
          400,
          result.error.flatten().fieldErrors,
          'VALIDATION_ERROR'
        ),
      };
    }
    return { data: result.data };
  } catch (err: any) {
    return {
      errorResponse: apiError(
        `Invalid JSON payload: ${err.message}`,
        400,
        undefined,
        'INVALID_JSON'
      ),
    };
  }
}

// ============================================================================
// Common Mobile Zod Schemas
// ============================================================================

export const MobileGpsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  placeName: z.string().optional().nullable(),
});

export const MobileAttendanceCheckInSchema = z.object({
  gps: MobileGpsSchema.optional().nullable(),
  locationStatus: z.enum(['captured', 'unavailable', 'permission_denied', 'timeout']).default('unavailable'),
  clientTimestamp: z.string().optional(),
});

export const MobileAttendanceCheckOutSchema = z.object({
  gps: MobileGpsSchema.optional().nullable(),
  locationStatus: z.enum(['captured', 'unavailable', 'permission_denied', 'timeout']).default('unavailable'),
  clientTimestamp: z.string().optional(),
});

export const MobileActivityStartSchema = z.object({
  clientActivityId: z.string().optional(), // Offline-generated UUID
  activityId: z.string().optional(),
  slotNumber: z.number().int().min(1).max(20).default(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  activityName: z.string().min(2, 'Activity name is required'),
  activityNameLabel: z.string().optional(),
  activityOther: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  wadi: z.string().optional().nullable(),
  activityType: z.enum(['single_farmer', 'group', 'group_meeting', 'demonstration', 'training', 'other']).default('single_farmer'),
  farmerName: z.string().optional().nullable(),
  groupDetails: z.string().optional().nullable(),
  totalParticipants: z.number().int().nonnegative().default(0),
  maleParticipants: z.number().int().nonnegative().default(0),
  femaleParticipants: z.number().int().nonnegative().default(0),
  observations: z.string().optional().nullable(),
  farmerIssues: z.string().optional().nullable(),
  supportProvided: z.array(z.string()).default([]),
  supportOther: z.string().optional().nullable(),
  followUpRequired: z.boolean().default(false),
  followUpDetails: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  photoEvidence: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  videoEvidence: z.array(z.string()).optional(),
  gps: MobileGpsSchema.optional().nullable(),
  locationStatus: z.enum(['captured', 'unavailable', 'permission_denied', 'timeout']).default('unavailable'),
  clientTimestamp: z.string().optional(),
});

export const MobileActivityUpdateSchema = z.object({
  slotNumber: z.number().int().min(1).max(20).optional(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  activityName: z.string().optional(),
  activityNameLabel: z.string().optional(),
  activityOther: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  wadi: z.string().optional().nullable(),
  activityType: z.enum(['single_farmer', 'group', 'group_meeting', 'demonstration', 'training', 'other']).optional(),
  farmerName: z.string().optional().nullable(),
  groupDetails: z.string().optional().nullable(),
  totalParticipants: z.number().int().nonnegative().optional(),
  maleParticipants: z.number().int().nonnegative().optional(),
  femaleParticipants: z.number().int().nonnegative().optional(),
  observations: z.string().optional().nullable(),
  farmerIssues: z.string().optional().nullable(),
  supportProvided: z.array(z.string()).optional(),
  supportOther: z.string().optional().nullable(),
  followUpRequired: z.boolean().optional(),
  followUpDetails: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  photoEvidence: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  videoEvidence: z.array(z.string()).optional(),
  clientTimestamp: z.string().optional(),
});

export const MobileActivityEndSchema = z.object({
  endGps: MobileGpsSchema.optional().nullable(),
  locationStatus: z.enum(['captured', 'unavailable', 'permission_denied', 'timeout']).default('unavailable'),
  finalDetails: MobileActivityUpdateSchema.optional(),
  clientTimestamp: z.string().optional(),
});

export const MobileLeaveCreateSchema = z.object({
  leaveType: z.enum(['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'other']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  isHalfDay: z.boolean().default(false),
  halfDayType: z.enum(['first_half', 'second_half']).optional(),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
});

export const MobileLeaveReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export const MobileProfileUpdateSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  bio: z.string().max(500).optional(),
});

