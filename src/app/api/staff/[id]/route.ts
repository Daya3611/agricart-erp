import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    // Staff cannot view profiles other than their own
    if (sessionUser.role === 'staff' && sessionUser.uid !== id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: Staff cannot view other user profiles.' }, { status: 403 });
    }

    const userDoc = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!userDoc) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Manager can only view staff in their department or centers
    if (sessionUser.role === 'manager' && sessionUser.uid !== id) {
      const isDeptMatch = sessionUser.departmentId && userDoc.departmentId === sessionUser.departmentId;
      const isCenterMatch = userDoc.assignedCenterIds?.some((c) => sessionUser.assignedCenterIds?.includes(c));
      if (!isDeptMatch && !isCenterMatch) {
        return NextResponse.json({ success: false, error: 'FORBIDDEN: Restricted to assigned department or center.' }, { status: 403 });
      }
    }

    let lastLogin: string | null = (userDoc as any).lastLogin || null;
    let authCreatedAt: string | null = (userDoc as any).authCreatedAt || userDoc.createdAt || null;
    let photoURL: string | null = (userDoc as any).photoURL || null;

    if (hasValidAdminCredentials) {
      try {
        const authUser = await adminAuth.getUser(id);
        if (authUser) {
          if (authUser.metadata?.lastSignInTime) {
            lastLogin = authUser.metadata.lastSignInTime;
          }
          if (authUser.metadata?.creationTime) {
            authCreatedAt = authUser.metadata.creationTime;
          }
          if (authUser.photoURL) {
            photoURL = authUser.photoURL;
          }
        }
      } catch {
        // Fallback to Firestore document fields
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        ...userDoc,
        lastLogin,
        authCreatedAt,
        photoURL,
      },
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const existingUser = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only Super Admin can modify an administrator or promote/demote admin roles
    if (
      (existingUser.role === 'super_admin' || existingUser.role === 'admin' || body.role === 'super_admin' || body.role === 'admin') &&
      sessionUser.role !== 'super_admin'
    ) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Only Super Admin can modify administrator accounts.' },
        { status: 403 }
      );
    }

    // Do not allow changing employeeId after creation
    const { employeeId, ...allowedUpdates } = body;

    const updatedFields: Record<string, any> = {
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    };

    // If accountStatus is updated, sync Firebase Auth disabled state
    if (body.accountStatus) {
      try {
        await adminAuth.updateUser(id, {
          disabled: body.accountStatus === 'deactivated',
        });
      } catch (authErr: any) {
        console.warn('Firebase Auth user disabled state update warning:', authErr.message);
      }
    }

    // If role changed and sessionUser is super_admin, sync custom claims
    if (body.role && body.role !== existingUser.role && sessionUser.role === 'super_admin') {
      try {
        await adminAuth.setCustomUserClaims(id, {
          role: body.role,
          admin: body.role === 'admin' || body.role === 'super_admin',
        });
      } catch (claimsErr: any) {
        console.warn('Firebase Auth custom claims update warning:', claimsErr.message);
      }
    }

    await updateDocument(ERP_COLLECTIONS.employees, id, updatedFields);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: body.accountStatus ? `update_status_${body.accountStatus}` : 'update_staff',
      resourceType: 'user',
      resourceId: id,
      details: `Updated staff profile for ${id} (${body.fullName || existingUser.fullName})`,
      previousValues: { role: existingUser.role, accountStatus: existingUser.accountStatus },
      newValues: { role: body.role || existingUser.role, accountStatus: body.accountStatus || existingUser.accountStatus },
    });

    return NextResponse.json({ success: true, user: { ...existingUser, ...updatedFields } });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAdmin();
    const { id } = await params;

    const existingUser = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only Super Admin can deactivate an administrator
    if ((existingUser.role === 'super_admin' || existingUser.role === 'admin') && sessionUser.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Only Super Admin can deactivate administrator accounts.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    await updateDocument(ERP_COLLECTIONS.employees, id, { accountStatus: 'deactivated', updatedAt: now });

    try {
      await adminAuth.updateUser(id, { disabled: true });
    } catch (authErr: any) {
      console.warn('Firebase Auth user disable warning:', authErr.message);
    }

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'deactivate_staff',
      resourceType: 'user',
      resourceId: id,
      details: `Deactivated staff account for ${existingUser.fullName} (${existingUser.employeeId})`,
    });

    return NextResponse.json({ success: true, message: 'Account deactivated successfully.' });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
