import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  MobileLeaveCreateSchema,
} from '@/lib/api/v1-helper';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { LeaveRecord } from '@/types';
import { createLeaveRecord } from '@/lib/services/leave-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    const statusParam = searchParams.get('status')?.toLowerCase();
    const yearParam = searchParams.get('year');
    const targetUid = searchParams.get('staffUid');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let queryFilters: { field: string; op: any; value: any }[] = [];

    // Staff can strictly view only their own leaves
    if (user.role === 'staff') {
      queryFilters.push({ field: 'staffUid', op: '==', value: user.uid });
    } else if (targetUid) {
      queryFilters.push({ field: 'staffUid', op: '==', value: targetUid });
    }

    let leaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, queryFilters)) as LeaveRecord[];

    // Manager scoping
    if (user.role === 'manager' && !targetUid) {
      leaves = leaves.filter(
        (l) =>
          l.staffUid === user.uid ||
          (user.departmentId && l.departmentId === user.departmentId) ||
          user.assignedCenterIds?.includes(l.centerId)
      );
    }

    // Filter by status
    if (statusParam && statusParam !== 'all') {
      leaves = leaves.filter((l) => l.approvalStatus?.toLowerCase() === statusParam);
    }

    // Filter by year
    if (yearParam) {
      leaves = leaves.filter((l) => l.startDate?.startsWith(yearParam));
    }

    // Sort descending by startDate
    leaves.sort((a, b) => b.startDate.localeCompare(a.startDate));

    const total = leaves.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLeaves = leaves.slice(startIndex, startIndex + limit);

    return apiSuccess(paginatedLeaves, undefined, {
      total,
      page,
      limit,
      totalPages,
      role: user.role,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    const { data, errorResponse } = await parseAndValidate(req, MobileLeaveCreateSchema);
    if (errorResponse) return errorResponse;

    const result = await createLeaveRecord(user, {
      staffUid: user.uid,
      leaveType: data!.leaveType,
      startDate: data!.startDate,
      endDate: data!.endDate,
      isHalfDay: data!.isHalfDay,
      halfDayType: data!.halfDayType,
      reason: data!.reason,
      attachmentUrl: data!.attachmentUrl || undefined,
    });

    if (!result.success) {
      return apiError(result.error || 'Failed to submit leave request.', 400);
    }

    return apiSuccess(
      {
        leaveId: result.leaveId,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      },
      'Leave application submitted successfully',
      undefined,
      201
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

