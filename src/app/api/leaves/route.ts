import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { createLeaveRecord } from '@/lib/services/leave-service';
import { LeaveRecord } from '@/types';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const staffUid = searchParams.get('staffUid');
    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status');
    const leaveType = searchParams.get('leaveType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: { field: string; op: any; value: any }[] = [];

    // Role-based data scoping
    if (sessionUser.role === 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: sessionUser.uid });
    } else if (sessionUser.role === 'manager' && sessionUser.departmentId) {
      filters.push({ field: 'departmentId', op: '==', value: sessionUser.departmentId });
    }

    if (staffUid && sessionUser.role !== 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: staffUid });
    }
    if (departmentId && sessionUser.role !== 'manager') {
      filters.push({ field: 'departmentId', op: '==', value: departmentId });
    }
    if (centerId) {
      filters.push({ field: 'centerId', op: '==', value: centerId });
    }
    if (status && status !== 'all') {
      filters.push({ field: 'approvalStatus', op: '==', value: status });
    }
    if (leaveType && leaveType !== 'all') {
      filters.push({ field: 'leaveType', op: '==', value: leaveType });
    }

    let leaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, filters)) as LeaveRecord[];

    // In-memory date filtering if requested
    if (startDate) {
      leaves = leaves.filter((l) => l.endDate >= startDate);
    }
    if (endDate) {
      leaves = leaves.filter((l) => l.startDate <= endDate);
    }

    // Sort newest created first
    leaves.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, leaves });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message, leaves: [] }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json();

    const result = await createLeaveRecord(sessionUser, body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, leaveId: result.leaveId }, { status: 201 });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
