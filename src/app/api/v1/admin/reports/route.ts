import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { listFieldReports } from '@/lib/services/field-report-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin', 'manager']);
    const { searchParams } = new URL(req.url);

    const reportDate = searchParams.get('date') || searchParams.get('reportDate') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const centerId = searchParams.get('centerId') || undefined;
    const staffUid = searchParams.get('staffUid') || searchParams.get('employeeId') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const reports = await listFieldReports(user, {
      reportDate,
      startDate,
      endDate,
      departmentId,
      centerId,
      staffUid,
      status,
    });

    const total = reports.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedReports = reports.slice(startIndex, startIndex + limit);

    return apiSuccess(paginatedReports, undefined, {
      total,
      page,
      limit,
      totalPages,
      filters: { reportDate, startDate, endDate, departmentId, centerId, status },
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

