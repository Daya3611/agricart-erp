import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection, fetchDocument, updateDocument, deleteDocument } from '@/lib/firebase/firestore';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';

/**
 * Resolves an employee record by Firestore document ID first, falling back to querying
 * the `uid` field for legacy records whose document ID differs from their Auth UID.
 */
async function findEmployeeRecord(id: string): Promise<{ docId: string; user: UserProfile } | null> {
  const direct = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as (UserProfile & { id?: string }) | null;
  if (direct) {
    return { docId: direct.id || id, user: direct };
  }

  const matches = (await fetchCollection(ERP_COLLECTIONS.employees, [
    { field: 'uid', op: '==', value: id },
  ])) as (UserProfile & { id?: string })[];

  if (matches.length > 0) {
    const match = matches[0];
    return { docId: match.id || match.uid || id, user: match };
  }

  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    // Staff cannot view profiles other than their own
    if (sessionUser.role === 'staff' && sessionUser.uid !== id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: Staff cannot view other user profiles.' }, { status: 403 });
    }

    const record = await findEmployeeRecord(id);
    if (!record) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const userDoc = record.user;

    // Manager can only view staff in their department or centers
    if (sessionUser.role === 'manager' && sessionUser.uid !== id) {
      const isDeptMatch = sessionUser.departmentId && userDoc.departmentId === sessionUser.departmentId;
      const isCenterMatch = userDoc.assignedCenterIds?.some((c) => sessionUser.assignedCenterIds?.includes(c));
      if (!isDeptMatch && !isCenterMatch) {
        return NextResponse.json({ success: false, error: 'FORBIDDEN: Restricted to assigned department or center.' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, user: userDoc });
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

    const record = await findEmployeeRecord(id);
    if (!record) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const { docId, user: existingUser } = record;
    const targetAuthUid = existingUser.uid || id;

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

    // Prevent self-deactivation or deactivating Super Admin accounts
    if (body.accountStatus === 'deactivated') {
      if (sessionUser.uid === id || sessionUser.uid === targetAuthUid) {
        return NextResponse.json(
          { success: false, error: 'FORBIDDEN: You cannot deactivate your own currently logged-in account.' },
          { status: 403 }
        );
      }
      if (existingUser.role === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'FORBIDDEN: Super Admin accounts cannot be deactivated.' },
          { status: 403 }
        );
      }
    }

    // Do not allow changing employeeId after creation
    const { employeeId, ...allowedUpdates } = body;

    const updatedFields: Record<string, any> = {
      ...allowedUpdates,
      updatedAt: new Date().toISOString(),
    };

    // If accountStatus is updated, sync Firebase Auth disabled state
    if (body.accountStatus && hasValidAdminCredentials) {
      try {
        await adminAuth.updateUser(targetAuthUid, {
          disabled: body.accountStatus === 'deactivated',
        });
      } catch (authErr: any) {
        console.warn('Firebase Auth user disabled state update warning:', authErr.message);
      }
    }

    // If role changed and sessionUser is super_admin, sync custom claims
    if (body.role && body.role !== existingUser.role && sessionUser.role === 'super_admin' && hasValidAdminCredentials) {
      try {
        await adminAuth.setCustomUserClaims(targetAuthUid, {
          role: body.role,
          admin: body.role === 'admin' || body.role === 'super_admin',
        });
      } catch (claimsErr: any) {
        console.warn('Firebase Auth custom claims update warning:', claimsErr.message);
      }
    }

    await updateDocument(ERP_COLLECTIONS.employees, docId, updatedFields);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: body.accountStatus ? `update_status_${body.accountStatus}` : 'update_staff',
      resourceType: 'user',
      resourceId: targetAuthUid,
      details: `Updated staff profile for ${targetAuthUid} (${body.fullName || existingUser.fullName})`,
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

    const record = await findEmployeeRecord(id);
    if (!record) {
      return NextResponse.json({ success: false, error: 'Employee record not found.' }, { status: 404 });
    }

    const { docId, user: existingUser } = record;
    const targetAuthUid = existingUser.uid || id;

    // Guard 1: Prevent deleting the currently logged-in account (Super Admin or Admin)
    if (sessionUser.uid === id || sessionUser.uid === targetAuthUid || sessionUser.uid === docId) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: You cannot delete your own currently logged-in account.' },
        { status: 403 }
      );
    }

    // Guard 2: Prevent accidental deletion of any Super Admin account
    if (existingUser.role === 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Super Admin accounts are protected and cannot be deleted.' },
        { status: 403 }
      );
    }

    // Guard 3: Only Super Admin can delete Admin accounts
    if (existingUser.role === 'admin' && sessionUser.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Only Super Admin can delete administrator accounts.' },
        { status: 403 }
      );
    }

    // Step 1: Delete Firebase Authentication account first so credentials are invalidated before removing profile
    let authDeleted = false;
    if (hasValidAdminCredentials) {
      try {
        await adminAuth.deleteUser(targetAuthUid);
        authDeleted = true;
      } catch (authErr: any) {
        if (authErr?.code === 'auth/user-not-found') {
          console.warn(`Firebase Auth user not found for UID ${targetAuthUid} during deletion; cleaning up Firestore record.`);
        } else {
          console.error(`Failed to delete Firebase Auth user ${targetAuthUid}:`, authErr);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to delete Firebase Authentication account: ${authErr?.message || 'Unknown error'}`,
            },
            { status: 500 }
          );
        }
      }
    }

    // Step 2: Delete corresponding Firestore employee document
    const deleteRes = await deleteDocument(ERP_COLLECTIONS.employees, docId);
    if (!deleteRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: deleteRes.error || 'Failed to delete employee record from Firestore.',
        },
        { status: 500 }
      );
    }

    // Step 3: Record deletion in audit logs
    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'delete_staff',
      resourceType: 'user',
      resourceId: targetAuthUid,
      details: `Permanently deleted employee account for ${existingUser.fullName} (${existingUser.employeeId})`,
      previousValues: {
        uid: targetAuthUid,
        employeeId: existingUser.employeeId,
        fullName: existingUser.fullName,
        email: existingUser.email,
        role: existingUser.role,
        departmentId: existingUser.departmentId,
        accountStatus: existingUser.accountStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${existingUser.fullName} (${existingUser.employeeId}) permanently deleted.`,
      deletedUid: targetAuthUid,
      authDeleted,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
