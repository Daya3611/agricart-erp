import { fetchCollection, fetchDocument, saveDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { DailyReport, ReportStatus, DashboardStats, FilterParams, ReportRevision, UserProfile } from '@/types';
import { checkIfLateSubmission, getTodayDateString } from '@/lib/utils/date-utils';
import { logAuditAction } from '@/lib/services/audit-service';

export async function createOrUpdateReport(
  staffUser: { uid: string; employeeId: string; fullName: string; email: string; departmentId: string; departmentName?: string; assignedCenterIds: string[]; assignedCenterNames?: string[] },
  reportData: {
    id?: string;
    reportDate: string;
    workLocation: string;
    workStartTime?: string;
    workEndTime?: string;
    activities: string;
    completedTasks: string;
    farmersVisited: number;
    meetingsConducted: number;
    achievements?: string;
    challenges?: string;
    pendingWork?: string;
    supportRequired?: string;
    nextDayPlan?: string;
    remarks?: string;
    attachments?: any[];
    submitNow: boolean;
  }
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  try {
    const reportDate = reportData.reportDate || getTodayDateString();
    const docId = reportData.id || `report_${staffUser.uid}_${reportDate}`;
    const existingDoc = (await fetchDocument(ERP_COLLECTIONS.dailyReports, docId)) as DailyReport | null;

    const now = new Date().toISOString();
    const isLate = reportData.submitNow ? checkIfLateSubmission(reportDate, now) : false;

    let previousData: Partial<DailyReport> | null = null;
    let revisionNumber = 1;

    if (existingDoc) {
      previousData = existingDoc;
      if (previousData.status === 'approved') {
        return { success: false, error: 'Cannot modify an approved report.' };
      }
      revisionNumber = (previousData.revisionNumber || 1) + 1;
    }

    const newStatus: ReportStatus = reportData.submitNow ? 'submitted' : 'draft';

    // Check if employee has an approved leave for reportDate to flag potential conflict
    let hasLeaveConflict = false;
    let conflictDetails: string | undefined = undefined;
    try {
      const leaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, [
        { field: 'staffUid', op: '==', value: staffUser.uid },
        { field: 'approvalStatus', op: '==', value: 'approved' },
      ])) as any[];
      const conflictingLeave = leaves.find((l) => l.startDate <= reportDate && l.endDate >= reportDate);
      if (conflictingLeave) {
        hasLeaveConflict = true;
        conflictDetails = `Report submitted on approved leave date (${conflictingLeave.leaveType?.toUpperCase() || 'LEAVE'}, ${conflictingLeave.startDate} to ${conflictingLeave.endDate})`;
      }
    } catch (e) {
      console.warn('Leave check error during report creation:', e);
    }

    const fullReport: DailyReport = {
      id: docId,
      staffUid: staffUser.uid,
      employeeId: staffUser.employeeId,
      staffName: staffUser.fullName,
      staffEmail: staffUser.email,
      departmentId: staffUser.departmentId,
      departmentName: staffUser.departmentName || 'Field Operations',
      centerId: staffUser.assignedCenterIds[0] || 'center_default',
      centerName: staffUser.assignedCenterNames?.[0] || 'Primary Center',
      reportDate,
      workLocation: reportData.workLocation || 'Field',
      workStartTime: reportData.workStartTime || '09:00',
      workEndTime: reportData.workEndTime || '18:00',
      activities: reportData.activities || '',
      completedTasks: reportData.completedTasks || '',
      farmersVisited: Number(reportData.farmersVisited || 0),
      meetingsConducted: Number(reportData.meetingsConducted || 0),
      achievements: reportData.achievements || '',
      challenges: reportData.challenges || '',
      pendingWork: reportData.pendingWork || '',
      supportRequired: reportData.supportRequired || '',
      nextDayPlan: reportData.nextDayPlan || '',
      remarks: reportData.remarks || '',
      attachments: reportData.attachments || [],
      status: newStatus,
      isLate,
      hasLeaveConflict,
      conflictDetails,
      submittedAt: reportData.submitNow ? (existingDoc && previousData?.submittedAt ? previousData.submittedAt : now) : (previousData?.submittedAt || undefined),
      reviewerUid: previousData?.reviewerUid || undefined,
      reviewerName: previousData?.reviewerName || undefined,
      reviewedAt: previousData?.reviewedAt || undefined,
      reviewComments: previousData?.reviewComments || undefined,
      revisionNumber,
      createdAt: previousData?.createdAt || now,
      updatedAt: now,
    };

    await saveDocument(ERP_COLLECTIONS.dailyReports, docId, fullReport);

    // Save attachment metadata to erp_report_attachments
    if (Array.isArray(reportData.attachments) && reportData.attachments.length > 0) {
      for (const att of reportData.attachments) {
        if (att && att.id) {
          await saveDocument(ERP_COLLECTIONS.reportAttachments, att.id, {
            ...att,
            reportId: docId,
            staffUid: staffUser.uid,
            employeeId: staffUser.employeeId,
            updatedAt: now,
          });
        }
      }
    }

    if (existingDoc && previousData) {
      const revisionId = `rev_${docId}_${revisionNumber}`;
      const revisionRecord: ReportRevision = {
        id: revisionId,
        reportId: docId,
        revisionNumber,
        previousData,
        updatedData: fullReport,
        editorUid: staffUser.uid,
        editorName: staffUser.fullName,
        createdAt: now,
      };
      await saveDocument(ERP_COLLECTIONS.reportRevisions, revisionId, revisionRecord);
    }

    await logAuditAction({
      actorUid: staffUser.uid,
      actorName: staffUser.fullName,
      actorRole: 'staff',
      action: reportData.submitNow ? 'submit_report' : 'save_draft',
      resourceType: 'report',
      resourceId: docId,
      details: `${reportData.submitNow ? 'Submitted' : 'Saved draft'} report for ${reportDate}`,
    });

    return { success: true, reportId: docId };
  } catch (err: any) {
    console.error('createOrUpdateReport error:', err);
    return { success: false, error: err.message };
  }
}

export async function reviewReport(
  reviewer: { uid: string; fullName: string; role: any },
  reportId: string,
  actionStatus: 'approved' | 'correction_requested' | 'rejected',
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const report = (await fetchDocument(ERP_COLLECTIONS.dailyReports, reportId)) as DailyReport | null;

    if (!report) {
      return { success: false, error: 'Report not found.' };
    }

    const now = new Date().toISOString();

    const updatedFields = {
      status: actionStatus as ReportStatus,
      reviewerUid: reviewer.uid,
      reviewerName: reviewer.fullName,
      reviewedAt: now,
      reviewComments: comment || '',
      updatedAt: now,
    };

    await updateDocument(ERP_COLLECTIONS.dailyReports, reportId, updatedFields);

    if (comment) {
      const commentId = `cmt_${reportId}_${Date.now()}`;
      await saveDocument(ERP_COLLECTIONS.reportComments, commentId, {
        id: commentId,
        reportId,
        authorUid: reviewer.uid,
        authorName: reviewer.fullName,
        authorRole: reviewer.role,
        comment,
        createdAt: now,
      });
    }

    await logAuditAction({
      actorUid: reviewer.uid,
      actorName: reviewer.fullName,
      actorRole: reviewer.role,
      action: `review_${actionStatus}`,
      resourceType: 'report',
      resourceId: reportId,
      details: `Reviewed report for ${report.staffName} (${report.reportDate}): status changed to ${actionStatus}`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('reviewReport error:', err);
    return { success: false, error: err.message };
  }
}

export async function getDashboardStats(params?: FilterParams): Promise<DashboardStats> {
  const today = getTodayDateString();
  try {
    let activeUsers = (await fetchCollection(ERP_COLLECTIONS.employees, [{ field: 'accountStatus', op: '==', value: 'active' }])) as UserProfile[];
    if (params?.departmentId) {
      activeUsers = activeUsers.filter((u) => u.departmentId === params.departmentId);
    }
    if (params?.centerId) {
      activeUsers = activeUsers.filter((u) => Array.isArray(u.assignedCenterIds) && u.assignedCenterIds.includes(params.centerId!));
    }

    const totalActiveStaff = activeUsers.filter((u) => u.role === 'staff').length;

    let reportsToday = (await fetchCollection(ERP_COLLECTIONS.dailyReports, [{ field: 'reportDate', op: '==', value: today }])) as DailyReport[];
    if (params?.departmentId) {
      reportsToday = reportsToday.filter((r) => r.departmentId === params.departmentId);
    }
    if (params?.centerId) {
      reportsToday = reportsToday.filter((r) => r.centerId === params.centerId);
    }

    const submittedToday = reportsToday.filter((r) => r.status !== 'draft').length;
    const awaitingApprovalCount = reportsToday.filter((r) => r.status === 'submitted' || r.status === 'under_review').length;
    const correctionRequestedCount = reportsToday.filter((r) => r.status === 'correction_requested').length;
    const approvedReportsCount = reportsToday.filter((r) => r.status === 'approved').length;

    // Retrieve approved leaves covering today
    let approvedLeaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, [
      { field: 'approvalStatus', op: '==', value: 'approved' },
    ])) as any[];
    if (params?.departmentId) {
      approvedLeaves = approvedLeaves.filter((l) => l.departmentId === params.departmentId);
    }
    if (params?.centerId) {
      approvedLeaves = approvedLeaves.filter((l) => l.centerId === params.centerId);
    }
    const onLeaveStaffUids = new Set<string>();
    approvedLeaves.forEach((l) => {
      if (l.startDate <= today && l.endDate >= today) {
        onLeaveStaffUids.add(l.staffUid);
      }
    });
    const onLeaveToday = onLeaveStaffUids.size;
    const scheduledStaffToday = Math.max(0, totalActiveStaff - onLeaveToday);
    const missingReportsToday = Math.max(0, scheduledStaffToday - submittedToday);

    const dailySubmissionRate = scheduledStaffToday > 0 ? Math.round((submittedToday / scheduledStaffToday) * 100) : 100;

    let depts = (await fetchCollection(ERP_COLLECTIONS.departments, [{ field: 'active', op: '==', value: true }])) as any[];
    if (params?.departmentId) {
      depts = depts.filter((d) => d.id === params.departmentId);
    }

    const deptCompletionRates = depts.map((dept: any) => {
      const deptStaffCount = activeUsers.filter((u) => u.departmentId === dept.id && u.role === 'staff').length;
      const deptSubmitted = reportsToday.filter((r) => r.departmentId === dept.id && r.status !== 'draft').length;
      const rate = deptStaffCount > 0 ? Math.round((deptSubmitted / deptStaffCount) * 100) : 0;
      return { id: dept.id, name: dept.name, total: deptStaffCount, submitted: deptSubmitted, rate };
    });

    let centers = (await fetchCollection(ERP_COLLECTIONS.centers, [{ field: 'active', op: '==', value: true }])) as any[];
    if (params?.centerId) {
      centers = centers.filter((c) => c.id === params.centerId);
    } else if (params?.departmentId) {
      centers = centers.filter((c) => c.departmentId === params.departmentId);
    }

    const centerCompletionRates = centers.map((center: any) => {
      const centerStaffCount = activeUsers.filter(
        (u) => Array.isArray(u.assignedCenterIds) && u.assignedCenterIds.includes(center.id) && u.role === 'staff'
      ).length;
      const centerSubmitted = reportsToday.filter((r) => r.centerId === center.id && r.status !== 'draft').length;
      const rate = centerStaffCount > 0 ? Math.round((centerSubmitted / centerStaffCount) * 100) : 0;
      return { id: center.id, name: center.name, total: centerStaffCount, submitted: centerSubmitted, rate };
    });

    const allAuditLogs = (await fetchCollection(ERP_COLLECTIONS.auditLogs)) as any[];
    const recentActivities = allAuditLogs.slice(0, 8);

    // Calculate real weekly trends for the past 7 days
    const weeklyTrends = [];
    const now = new Date();
    let allReports = (await fetchCollection(ERP_COLLECTIONS.dailyReports)) as DailyReport[];
    if (params?.departmentId) {
      allReports = allReports.filter((r) => r.departmentId === params.departmentId);
    }
    if (params?.centerId) {
      allReports = allReports.filter((r) => r.centerId === params.centerId);
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

      const daySubmitted = allReports.filter((r) => r.reportDate === dateStr && r.status !== 'draft').length;
      const dayMissing = Math.max(0, totalActiveStaff - daySubmitted);

      weeklyTrends.push({
        date: dayLabel,
        submitted: daySubmitted,
        missing: dayMissing,
        expected: totalActiveStaff,
      });
    }

    // Real monthly reporting trends
    const monthlyTrends = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 5; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const yearMonthPrefix = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = monthNames[targetDate.getMonth()];
      const mSubmitted = allReports.filter((r) => r.reportDate.startsWith(yearMonthPrefix) && r.status !== 'draft').length;
      const mExpected = Math.max(1, totalActiveStaff * 24);
      const mRate = Math.min(100, Math.round((mSubmitted / mExpected) * 100));

      monthlyTrends.push({
        month: monthLabel,
        submitted: mSubmitted,
        missing: Math.max(0, mExpected - mSubmitted),
        rate: mRate,
      });
    }

    return {
      totalActiveStaff,
      scheduledStaffToday,
      reportsExpectedToday: scheduledStaffToday,
      reportsSubmittedToday: submittedToday,
      missingReportsToday,
      onLeaveToday,
      overdueReports: missingReportsToday,
      awaitingApprovalCount,
      correctionRequestedCount,
      approvedReportsCount,
      dailySubmissionRate,
      deptCompletionRates,
      centerCompletionRates,
      recentActivities: recentActivities as any[],
      weeklyTrends,
      monthlyTrends,
    };
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return {
      totalActiveStaff: 0,
      scheduledStaffToday: 0,
      reportsExpectedToday: 0,
      reportsSubmittedToday: 0,
      missingReportsToday: 0,
      overdueReports: 0,
      awaitingApprovalCount: 0,
      correctionRequestedCount: 0,
      approvedReportsCount: 0,
      dailySubmissionRate: 0,
      deptCompletionRates: [],
      centerCompletionRates: [],
      recentActivities: [],
      weeklyTrends: [],
      monthlyTrends: [],
    };
  }
}

