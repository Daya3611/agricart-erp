import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, StaffProfileUpdateSchema } from '@/lib/auth/permissions';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';
import { handleCorsPreflight } from '@/lib/api/cors';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET() {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const userDoc = (await fetchDocument(ERP_COLLECTIONS.employees, sessionUser.uid)) as UserProfile | null;
    if (!userDoc) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: userDoc });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json();

    const parseResult = StaffProfileUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phone, emergencyContact, bio } = parseResult.data;

    // Explicitly permitted fields only
    const updateData: Partial<UserProfile> = {
      updatedAt: new Date().toISOString(),
    };
    if (phone !== undefined) updateData.phone = phone;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (bio !== undefined) updateData.bio = bio;

    await updateDocument(ERP_COLLECTIONS.employees, sessionUser.uid, updateData);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'update_personal_profile',
      resourceType: 'user',
      resourceId: sessionUser.uid,
      details: `User ${sessionUser.fullName} updated permitted personal profile fields`,
    });

    const updatedProfile = (await fetchDocument(ERP_COLLECTIONS.employees, sessionUser.uid)) as unknown as UserProfile;
    return NextResponse.json({ success: true, user: updatedProfile });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
