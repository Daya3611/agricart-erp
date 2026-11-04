import { NextResponse } from 'next/server';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/auth/session';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { bootstrapInitialSuperAdmin } from '@/lib/services/seed-service';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { idToken, email, password } = body;

    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!idToken && (!normalizedEmail || !password)) {
      return NextResponse.json(
        { success: false, error: 'Authentication credentials or valid token required.' },
        { status: 400 }
      );
    }

    let decoded: any = null;

    // 1. If idToken is provided, verify it cryptographically via Firebase Admin SDK
    if (idToken && hasValidAdminCredentials) {
      try {
        decoded = await adminAuth.verifyIdToken(idToken);
      } catch (tokenErr: any) {
        console.warn('Firebase ID token verification failed:', tokenErr.message);
        return NextResponse.json(
          { success: false, error: 'Authentication session expired or invalid. Please sign in again.' },
          { status: 401 }
        );
      }
    }

    // 2. Fallback: if no valid idToken provided yet but email & password are provided,
    // verify securely with Firebase Authentication Identity Toolkit
    if (!decoded && normalizedEmail && password) {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (apiKey) {
        try {
          const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: normalizedEmail, password, returnSecureToken: true }),
            }
          );
          const authData = await authRes.json();
          if (!authRes.ok || !authData.idToken) {
            const errCode = authData.error?.message;
            if (errCode === 'EMAIL_NOT_FOUND' || errCode === 'INVALID_LOGIN_CREDENTIALS' || errCode === 'INVALID_PASSWORD') {
              return NextResponse.json(
                { success: false, error: 'Invalid email or password. Please verify your credentials.' },
                { status: 401 }
              );
            }
            if (errCode === 'USER_DISABLED') {
              return NextResponse.json(
                { success: false, error: 'Your account has been disabled. Please contact your system administrator.' },
                { status: 403 }
              );
            }
            return NextResponse.json(
              { success: false, error: 'Authentication failed. Please check your credentials.' },
              { status: 401 }
            );
          }

          idToken = authData.idToken;
          if (hasValidAdminCredentials) {
            decoded = await adminAuth.verifyIdToken(idToken);
          } else {
            decoded = { uid: authData.localId, email: authData.email };
          }
        } catch (apiErr: any) {
          console.error('Firebase Auth Identity Toolkit error:', apiErr.message);
          return NextResponse.json(
            { success: false, error: 'Authentication service temporarily unavailable. Please retry.' },
            { status: 500 }
          );
        }
      }
    }

    if (!decoded && !idToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. Please check your email and password.' },
        { status: 401 }
      );
    }

    const authUid = decoded?.uid || normalizedEmail;
    const authEmail = (decoded?.email || normalizedEmail).toLowerCase().trim();
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();

    // 3. Secure initial Super Admin provisioning / auto-repair:
    // If the verified user matches the configured ADMIN_EMAIL, ensure they are provisioned as super_admin
    if (configuredAdminEmail && authEmail === configuredAdminEmail) {
      const existingDoc = await fetchDocument(ERP_COLLECTIONS.employees, authUid);
      if (!existingDoc || (existingDoc as any).role !== 'super_admin' || (existingDoc as any).accountStatus !== 'active') {
        try {
          await bootstrapInitialSuperAdmin(authUid, authEmail);
        } catch (bootErr: any) {
          console.error('Auto-bootstrap Super Admin warning:', bootErr.message);
        }
      }
    }

    // 4. Fetch trusted user profile from Firestore using authUid as the document ID in erp_emp
    let userProfile: UserProfile | null = null;
    const docData = await fetchDocument(ERP_COLLECTIONS.employees, authUid);
    if (docData) {
      userProfile = (docData as unknown) as UserProfile;
    } else {
      // Fallback query by email in erp_emp
      const users = (await fetchCollection(ERP_COLLECTIONS.employees, [{ field: 'email', op: '==', value: authEmail }])) as UserProfile[];
      if (users.length > 0) {
        userProfile = users[0];
      }
    }

    if (!userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: 'User profile not found in ERP. Staff accounts must be provisioned by an administrator. Please contact your administrator.',
        },
        { status: 404 }
      );
    }

    if (userProfile.accountStatus === 'deactivated' || userProfile.accountStatus === 'inactive') {
      return NextResponse.json(
        { success: false, error: 'Account has been deactivated. Please contact your system administrator.' },
        { status: 403 }
      );
    }

    // 5. Trusted Role-based redirects:
    // super_admin -> /admin/dashboard
    // admin -> /admin/dashboard
    // manager -> /manager/dashboard
    // staff -> /staff/dashboard
    let defaultRedirect = '/staff/dashboard';
    if (userProfile.role === 'super_admin' || userProfile.role === 'admin') {
      defaultRedirect = '/admin/dashboard';
    } else if (userProfile.role === 'manager') {
      defaultRedirect = '/manager/dashboard';
    } else {
      defaultRedirect = '/staff/dashboard';
    }

    const response = NextResponse.json({
      success: true,
      role: userProfile.role,
      user: userProfile,
      redirectUrl: defaultRedirect,
    });

    const sessionTokenValue = idToken || authUid;

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionTokenValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    response.cookies.set({
      name: ROLE_COOKIE_NAME,
      value: userProfile.role,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Create or retrieve daily attendance session for authenticated user
    try {
      const { recordAttendanceLogin } = await import('@/lib/services/attendance-service');
      await recordAttendanceLogin(userProfile, body.gps, body.locationStatus || 'unavailable');
    } catch (attErr: any) {
      console.warn('Attendance login record warning:', attErr.message);
    }

    await logAuditAction({
      actorUid: authUid,
      actorName: userProfile.fullName || 'User',
      actorRole: userProfile.role || 'staff',
      action: 'login',
      resourceType: 'auth',
      resourceId: authUid,
      details: `User ${userProfile.fullName || authUid} (${userProfile.role}) logged in successfully`,
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

