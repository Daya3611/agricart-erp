import { NextResponse } from 'next/server';
import { bootstrapInitialSuperAdmin, inviteInitialSuperAdmin } from '@/lib/services/seed-service';
import { getServerSession } from '@/lib/auth/session';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile } from '@/types';

async function isAuthorizedCaller(req?: Request): Promise<boolean> {
  // 1. If an existing Super Admin session is authenticated
  const sessionUser = await getServerSession();
  if (sessionUser?.role === 'super_admin') {
    return true;
  }

  // 2. Check secret token if provided via headers
  if (req) {
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-bootstrap-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && (secretHeader === cronSecret || authHeader === `Bearer ${cronSecret}`)) {
      return true;
    }
  }

  // 3. If no active super_admin exists in database yet, allow initial bootstrap
  const superAdmins = (await fetchCollection(ERP_COLLECTIONS.employees, [
    { field: 'role', op: '==', value: 'super_admin' },
    { field: 'accountStatus', op: '==', value: 'active' },
  ])) as UserProfile[];

  return superAdmins.length === 0;
}

export async function GET(req: Request) {
  try {
    const authorized = await isAuthorizedCaller(req);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Super Admin is already provisioned. Administrative authorization required.' },
        { status: 403 }
      );
    }

    const res = await bootstrapInitialSuperAdmin();
    return NextResponse.json(res, { status: res.success ? 200 : res.needsCreation ? 404 : 403 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authorized = await isAuthorizedCaller(req);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Administrative authorization required to provision or invite.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'bootstrap';

    if (action === 'invite') {
      const inviteRes = await inviteInitialSuperAdmin(body.email);
      return NextResponse.json(inviteRes, { status: inviteRes.success ? 200 : 400 });
    }

    const res = await bootstrapInitialSuperAdmin(undefined, body.email, body.fullName);
    return NextResponse.json(res, { status: res.success ? 200 : res.needsCreation ? 404 : 403 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

