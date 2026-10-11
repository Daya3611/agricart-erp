import { cookies, headers } from 'next/headers';
import { adminAuth, adminDb, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile, UserRole } from '@/types';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from './constants';
export { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME };

function decodeJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(decodedJson);
    }
  } catch {}
  return null;
}

export async function getServerSession(): Promise<UserProfile | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const activeToken = token || bearerToken;

    if (!activeToken) {
      return null;
    }

    let uid: string | null = null;
    let decodedEmail: string | null = null;

    const isJwt = activeToken.includes('.') && activeToken.split('.').length === 3;

    // 1. Verify token with Firebase Admin Auth if admin credentials exist and it is a JWT
    if (isJwt) {
      if (hasValidAdminCredentials) {
        try {
          const decoded = await adminAuth.verifyIdToken(activeToken);
          uid = decoded.uid;
          decodedEmail = decoded.email || null;
        } catch {
          // Token verification failed or expired with Admin SDK
        }
      }
      if (!uid) {
        const payload = decodeJwtPayload(activeToken);
        if (payload) {
          uid = payload.user_id || payload.sub || null;
          decodedEmail = payload.email || null;
        }
      }
    } else {
      // Not a JWT: activeToken can be a UID or email
      if (activeToken.includes('@')) {
        decodedEmail = activeToken;
      } else {
        uid = activeToken;
      }
    }

    // 2. Fetch trusted employee profile from Firestore (erp_emp)
    let userProfile: UserProfile | null = null;

    if (uid) {
      const docData = await fetchDocument(ERP_COLLECTIONS.employees, uid);
      if (docData) {
        userProfile = (docData as unknown) as UserProfile;
      } else {
        // Fallback: search by uid field in case document id is not uid
        const users = (await fetchCollection(ERP_COLLECTIONS.employees, [{ field: 'uid', op: '==', value: uid }])) as UserProfile[];
        if (users.length > 0) {
          userProfile = users[0];
        }
      }
    }

    if (!userProfile && decodedEmail) {
      const users = (await fetchCollection(ERP_COLLECTIONS.employees, [{ field: 'email', op: '==', value: decodedEmail }])) as UserProfile[];
      if (users.length > 0) {
        userProfile = users[0];
      }
    }

    if (!userProfile) {
      return null;
    }

    // 3. Normalize legacy user profiles if fields are missing
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const userEmail = (userProfile.email || decodedEmail || '').toLowerCase().trim();

    if (!userProfile.uid) {
      userProfile.uid = (userProfile as any).id || uid || 'usr_unknown';
    }
    if (!userProfile.fullName) {
      userProfile.fullName = (userProfile as any).name || (userProfile as any).displayName || userEmail || 'Staff Member';
    }
    if (!userProfile.accountStatus) {
      userProfile.accountStatus = 'active';
    }
    if (!userProfile.role) {
      if (adminEmail && userEmail === adminEmail) {
        userProfile.role = 'super_admin';
      } else {
        userProfile.role = 'staff';
      }
    }

    // 4. Check account status: deactivated or inactive accounts MUST be rejected
    if (userProfile.accountStatus === 'deactivated' || userProfile.accountStatus === 'inactive') {
      return null;
    }

    return userProfile;
  } catch (err) {
    console.error('getServerSession error:', err);
    return null;
  }
}

