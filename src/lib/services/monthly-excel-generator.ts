import ExcelJS from 'exceljs';
import { MonthlyReportsDataset } from '@/types';
import { getGlobalReportingSettings } from '@/lib/services/settings-service';
import { createReportMediaResolver, mapConcurrent } from '@/lib/reports/media-resolver';

function extractCleanMediaUrls(urls?: string[], fallbackStr?: string): string[] {
  if (Array.isArray(urls) && urls.length > 0) {
    return urls.map((u) => String(u || '').trim()).filter((u) => u && u !== 'None' && u !== '—');
  }
  if (!fallbackStr || fallbackStr === 'None' || fallbackStr === '—') return [];
  return fallbackStr
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter((u) => u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')));
}

function getColumnLetter(colNum: number): string {
  let n = colNum;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter || 'A';
}

function estimateWrappedRowHeight(
  columns: Array<{ key?: string; width?: number }>,
  rowData: Record<string, unknown>,
  minHeight = 22
): number {
  let maxLines = 1;
  for (const col of columns) {
    if (!col.key) continue;
    const raw = rowData[col.key];
    if (raw === null || raw === undefined) continue;
    const str = String(raw);
    if (!str) continue;
    const effectiveCharsPerLine = Math.max((col.width || 16) - 3, 10);
    const segments = str.split('\n');
    let totalLinesForCell = 0;
    for (const seg of segments) {
      totalLinesForCell += Math.max(1, Math.ceil(seg.length / effectiveCharsPerLine));
    }
    if (totalLinesForCell > maxLines) {
      maxLines = totalLinesForCell;
    }
  }
  return Math.max(minHeight, maxLines * 14 + 8);
}

/**
 * Generate a professional multi-sheet Excel workbook (.xlsx) for monthly reports.
 * - Styled with Agricart Forest-Green branding (#166534)
 * - Frozen headers, auto-filters, wrapText enabled, and dynamic row heights so long text never clips
 * - Includes ALL Field Activity fields (including Group Details, Support Other, Follow-up Date, Video URLs, CRP Code, Block/Taluka, Review History)
 *
 * Sheet 1: Monthly Summary
 * Sheet 2: Daily Attendance
 * Sheet 3: Field Activities (Complete Breakdown)
 * Sheet 4: Leave Records
 * Sheet 5: Review History
 */
export async function generateMonthlyReportsWorkbook(dataset: MonthlyReportsDataset): Promise<Buffer> {
  const reportingConfig = await getGlobalReportingSettings();
  const mediaResolver = createReportMediaResolver();

  const excelCfg = reportingConfig.excelSettings || {
    freezePanes: true,
    autoFilter: true,
    highlightMissingDays: true,
    includeReviewHistory: true,
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Monthly Reporting System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const brandGreen = '166534'; // Forest green (#166534)
  const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: brandGreen },
  };

  function styleHeaderRow(row: ExcelJS.Row) {
    row.height = 30;
    row.eachCell((cell) => {
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F3F1E' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3F1E' } },
        left: { style: 'thin', color: { argb: 'FF1F7A3E' } },
        right: { style: 'thin', color: { argb: 'FF1F7A3E' } },
      };
    });
  }

  const sheetViews = excelCfg.freezePanes !== false ? [{ state: 'frozen' as const, ySplit: 1, xSplit: 0 }] : [];

  // ==========================================
  // SHEET 1: Monthly Summary
  // ==========================================
  const sheet1 = workbook.addWorksheet('Monthly Summary', { views: sheetViews });
  const sheet1Cols = [
    { header: 'Employee Name', key: 'employeeName', width: 24 },
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Department', key: 'departmentName', width: 22 },
    { header: 'Center', key: 'centerName', width: 22 },
    { header: 'Reporting Month', key: 'reportingMonth', width: 18 },
    { header: 'Total Working Days', key: 'totalWorkingDays', width: 18 },
    { header: 'Elapsed Working Days', key: 'elapsedWorkingDays', width: 20 },
    { header: 'Days Attended', key: 'presentDays', width: 15 },
    { header: 'Leave Days', key: 'leaveDays', width: 14 },
    { header: 'Missing Attendance Days', key: 'missingAttendanceDays', width: 22 },
    { header: 'Attendance %', key: 'attendancePercentage', width: 15 },
    { header: 'Days With Activities', key: 'daysWithActivities', width: 20 },
    { header: 'Total Activities', key: 'totalActivities', width: 16 },
    { header: 'Completed Activities', key: 'completedActivities', width: 20 },
    { header: 'Total Activity Hours', key: 'totalActivityHours', width: 18 },
    { header: 'Total Working Hours', key: 'totalWorkingHours', width: 18 },
    { header: 'Total Farmer Contacts', key: 'totalFarmerContacts', width: 20 },
    { header: 'Total Male Participants', key: 'totalMaleParticipants', width: 20 },
    { header: 'Total Female Participants', key: 'totalFemaleParticipants', width: 22 },
    { header: 'Approved Reports', key: 'reportsApproved', width: 17 },
    { header: 'Reports Requiring Correction', key: 'reportsRequiringCorrection', width: 24 },
    { header: 'Pending Review', key: 'reportsPendingReview', width: 16 },
    { header: 'Missing Reports', key: 'daysReportMissing', width: 16 },
  ];
  sheet1.columns = sheet1Cols;

  styleHeaderRow(sheet1.getRow(1));
  if (excelCfg.autoFilter !== false) {
    sheet1.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet1Cols.length)}1` };
  }

  dataset.employeeSummaries.forEach((emp, idx) => {
    const rowData = {
      employeeName: emp.employeeName,
      employeeId: emp.employeeId,
      departmentName: emp.departmentName,
      centerName: emp.centerName,
      reportingMonth: emp.reportingMonth || dataset.monthName,
      totalWorkingDays: emp.totalWorkingDays ?? emp.totalDaysWorked,
      elapsedWorkingDays: emp.elapsedWorkingDays ?? emp.totalWorkingDays ?? 0,
      presentDays: emp.presentDays ?? emp.daysAttended ?? emp.totalAttendanceSessions,
      leaveDays: emp.leaveDays,
      missingAttendanceDays: emp.missingAttendanceDays ?? emp.absentDays ?? 0,
      attendancePercentage:
        emp.attendancePercentage !== null && emp.attendancePercentage !== undefined
          ? `${emp.attendancePercentage}%`
          : '—',
      daysWithActivities: emp.daysWithActivities ?? 0,
      totalActivities: emp.totalActivities,
      completedActivities: emp.completedActivities ?? 0,
      totalActivityHours: emp.totalActivityHours,
      totalWorkingHours: emp.totalWorkingHours,
      totalFarmerContacts: emp.totalFarmerContacts,
      totalMaleParticipants: emp.totalMaleParticipants,
      totalFemaleParticipants: emp.totalFemaleParticipants,
      reportsApproved: emp.reportsApproved,
      reportsRequiringCorrection: emp.reportsRequiringCorrection ?? emp.reportsRejected,
      reportsPendingReview: emp.reportsPendingReview ?? 0,
      daysReportMissing: emp.daysReportMissing,
    };
    const row = sheet1.addRow(rowData);
    row.height = estimateWrappedRowHeight(sheet1Cols, rowData, 22);
    row.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 6 ? 'right' : 'left', wrapText: true };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  if (dataset.employeeSummaries.length > 1) {
    const lastDataRow = dataset.employeeSummaries.length + 1;
    const totalRowData: Record<string, any> = {
      employeeName: 'Total / Summary',
      employeeId: `(${dataset.employeeSummaries.length} Employees)`,
      departmentName: '—',
      centerName: '—',
      reportingMonth: dataset.monthName,
    };
    sheet1Cols.slice(5).forEach((col, i) => {
      const colLetter = getColumnLetter(i + 6);
      if (col.key === 'attendancePercentage') {
        const attendedSum = dataset.employeeSummaries.reduce(
          (sum, e) => sum + (e.presentDays ?? e.daysAttended ?? 0),
          0
        );
        const missingSum = dataset.employeeSummaries.reduce(
          (sum, e) => sum + (e.missingAttendanceDays ?? e.absentDays ?? 0),
          0
        );
        const denom = attendedSum + missingSum;
        totalRowData[col.key] = denom > 0 ? `${Math.round((attendedSum / denom) * 1000) / 10}%` : '—';
      } else {
        totalRowData[col.key!] = { formula: `SUM(${colLetter}2:${colLetter}${lastDataRow})` };
      }
    });

    const summaryRow = sheet1.addRow(totalRowData);
    summaryRow.height = 24;
    summaryRow.eachCell((cell, colNum) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 6 ? 'right' : 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    });
  }

  // ==========================================
  // SHEET 2: Daily Attendance
  // ==========================================
  const sheet2 = workbook.addWorksheet('Daily Attendance', { views: sheetViews });
  const sheet2Cols = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 22 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'dayOfWeek', width: 10 },
    { header: 'Login Time (IST)', key: 'loginTime', width: 16 },
    { header: 'Login Location', key: 'loginLocation', width: 36 },
    { header: 'Logout Time (IST)', key: 'logoutTime', width: 16 },
    { header: 'Logout Location', key: 'logoutLocation', width: 36 },
    { header: 'Attendance Status', key: 'attendanceStatus', width: 18 },
    { header: 'Working Duration', key: 'workingDuration', width: 18 },
    { header: 'Report Status', key: 'reportStatus', width: 20 },
  ];
  sheet2.columns = sheet2Cols;

  styleHeaderRow(sheet2.getRow(1));
  if (excelCfg.autoFilter !== false) {
    sheet2.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet2Cols.length)}1` };
  }

  dataset.dailyRecords.forEach((rec, idx) => {
    const rowData = {
      employeeId: rec.employeeId,
      employeeName: rec.employeeName,
      date: rec.date,
      dayOfWeek: rec.dayOfWeek,
      loginTime: rec.attendanceLogin,
      loginLocation: rec.loginLocation || '—',
      logoutTime: rec.attendanceLogout,
      logoutLocation: rec.logoutLocation || '—',
      attendanceStatus: rec.attendanceStatus || (rec.attendanceLogin !== '—' ? 'Present' : 'Upcoming'),
      workingDuration: rec.workingPeriodFormatted || '—',
      reportStatus: rec.reportStatus || '—',
    };
    const row = sheet2.addRow(rowData);
    row.height = estimateWrappedRowHeight(sheet2Cols, rowData, 22);
    row.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: [3, 4, 5, 7, 9, 10].includes(colNum) ? 'center' : 'left',
        wrapText: true,
      };
      if (excelCfg.highlightMissingDays !== false && (rec.attendanceStatus === 'Absent' || rec.isMissing)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
      } else if (rec.attendanceStatus === 'In Progress' || rec.attendanceStatus === 'Active') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      } else if (rec.attendanceStatus === 'Upcoming') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        if (colNum === 9) {
          cell.font = { color: { argb: 'FF64748B' }, italic: true };
        }
      } else if (rec.attendanceStatus === 'On Leave') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      } else if (rec.attendanceStatus === 'Weekly Off' || rec.attendanceStatus === 'Holiday') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      } else if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // ==========================================
  // SHEET 3: Field Activities (Complete Breakdown)
  // ==========================================
  const sheet3 = workbook.addWorksheet('Field Activities', { views: sheetViews });
  const sheet3Cols = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Employee Name', key: 'employeeName', width: 22 },
    { header: 'Department', key: 'departmentName', width: 22 },
    { header: 'Center', key: 'centerName', width: 22 },
    { header: 'CRP Code', key: 'crpCode', width: 14 },
    { header: 'Block / Taluka', key: 'blockTaluka', width: 18 },
    { header: 'Activity Date', key: 'reportDate', width: 14 },
    { header: 'Slot #', key: 'slotNumber', width: 10 },
    { header: 'Activity Status', key: 'activityStatus', width: 15 },
    { header: 'Activity Name', key: 'activityName', width: 26 },
    { header: 'Other Activity', key: 'activityOther', width: 22 },
    { header: 'Activity Type', key: 'activityType', width: 16 },
    { header: 'Village', key: 'village', width: 18 },
    { header: 'Wadi / Hamlet', key: 'wadi', width: 18 },
    { header: 'Farmer Name', key: 'farmerName', width: 22 },
    { header: 'Group / Meeting Details', key: 'groupDetails', width: 32 },
    { header: 'Participant Totals', key: 'participants', width: 16 },
    { header: 'Male Participants', key: 'maleParticipants', width: 16 },
    { header: 'Female Participants', key: 'femaleParticipants', width: 16 },
    { header: 'Observations (Complete)', key: 'observations', width: 44 },
    { header: 'Farmer Issues / Challenges', key: 'issues', width: 34 },
    { header: 'Support Provided', key: 'supportProvided', width: 30 },
    { header: 'Support Other', key: 'supportOther', width: 24 },
    { header: 'Follow-up Required', key: 'followUpRequiredText', width: 16 },
    { header: 'Follow-up Target Date', key: 'followUpDate', width: 18 },
    { header: 'Follow-up Details', key: 'followUpDetails', width: 32 },
    { header: 'Start Time (IST)', key: 'startTime', width: 16 },
    { header: 'End Time (IST)', key: 'endTime', width: 16 },
    { header: 'Start Timestamp (ISO)', key: 'startTimeIso', width: 24 },
    { header: 'End Timestamp (ISO)', key: 'endTimeIso', width: 24 },
    { header: 'Duration (Min)', key: 'durationMinutes', width: 14 },
    { header: 'Start Location Name', key: 'startGpsLocationName', width: 32 },
    { header: 'Start GPS Coordinates', key: 'startGpsCoords', width: 22 },
    { header: 'End Location Name', key: 'endGpsLocationName', width: 32 },
    { header: 'End GPS Coordinates', key: 'endGpsCoords', width: 22 },
    { header: 'Photo Evidence URLs', key: 'photoEvidenceRefs', width: 42 },
    { header: 'Video Evidence URLs', key: 'videoEvidenceRefs', width: 42 },
    { header: 'Report Review Status', key: 'reviewStatus', width: 20 },
    { header: 'Reviewer Name', key: 'reviewerName', width: 22 },
    { header: 'Reviewer Comments', key: 'reviewComments', width: 34 },
    { header: 'Correction History', key: 'correctionHistory', width: 28 },
  ];
  sheet3.columns = sheet3Cols;

  styleHeaderRow(sheet3.getRow(1));
  if (excelCfg.autoFilter !== false) {
    sheet3.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet3Cols.length)}1` };
  }

  const numericColsSheet3 = new Set([8, 17, 18, 19, 31]);
  const evidenceLinksRows: Array<{
    employeeId: string;
    employeeName: string;
    reportDate: string;
    slotNumber: number;
    activityName: string;
    mediaType: 'Photo' | 'Video';
    label: string;
    url: string;
  }> = [];

  // Preload media IDs and resolve permanent public URLs or fresh 7-day signed R2 URLs for Excel hyperlinks
  await mediaResolver.preloadMediaIds(
    dataset.allActivities.flatMap((act) => [
      ...(act.photoMediaIds || []),
      ...(act.videoMediaIds || []),
    ])
  );

  const resolvedMediaByActivity = await mapConcurrent(dataset.allActivities, 6, async (act) => {
    const rawPhotos = extractCleanMediaUrls(act.photoUrls, act.photoEvidenceRefs);
    const rawVideos = extractCleanMediaUrls(act.videoUrls, act.videoEvidenceRefs);

    const photoCount = Math.max(
      rawPhotos.length,
      act.photoObjectKeys?.length || 0,
      act.photoMediaIds?.length || 0
    );
    const photoUrls: string[] = [];
    for (let i = 0; i < photoCount; i++) {
      const resolved = await mediaResolver.resolveExportUrl({
        url: rawPhotos[i],
        objectKey: act.photoObjectKeys?.[i],
        mediaId: act.photoMediaIds?.[i],
      });
      if (resolved) photoUrls.push(resolved);
    }

    const videoCount = Math.max(
      rawVideos.length,
      act.videoObjectKeys?.length || 0,
      act.videoMediaIds?.length || 0
    );
    const videoUrls: string[] = [];
    for (let i = 0; i < videoCount; i++) {
      const resolved = await mediaResolver.resolveExportUrl({
        url: rawVideos[i],
        objectKey: act.videoObjectKeys?.[i],
        mediaId: act.videoMediaIds?.[i],
      });
      if (resolved) videoUrls.push(resolved);
    }

    return { photoUrls, videoUrls };
  });

  dataset.allActivities.forEach((act, idx) => {
    const { photoUrls, videoUrls } = resolvedMediaByActivity[idx] || {
      photoUrls: extractCleanMediaUrls(act.photoUrls, act.photoEvidenceRefs),
      videoUrls: extractCleanMediaUrls(act.videoUrls, act.videoEvidenceRefs),
    };
    const photoDisplayText =
      photoUrls.length > 0 ? photoUrls.map((_, i) => `View Photo ${i + 1}`).join(', ') : 'None';
    const videoDisplayText =
      videoUrls.length > 0 ? videoUrls.map((_, i) => `View Video ${i + 1}`).join(', ') : 'None';

    photoUrls.forEach((url, i) => {
      evidenceLinksRows.push({
        employeeId: act.employeeId,
        employeeName: act.employeeName,
        reportDate: act.reportDate,
        slotNumber: act.slotNumber,
        activityName: act.activityName,
        mediaType: 'Photo',
        label: `View Photo ${i + 1}`,
        url,
      });
    });
    videoUrls.forEach((url, i) => {
      evidenceLinksRows.push({
        employeeId: act.employeeId,
        employeeName: act.employeeName,
        reportDate: act.reportDate,
        slotNumber: act.slotNumber,
        activityName: act.activityName,
        mediaType: 'Video',
        label: `View Video ${i + 1}`,
        url,
      });
    });

    const rowData = {
      employeeId: act.employeeId,
      employeeName: act.employeeName,
      departmentName: act.departmentName || 'Field Operations',
      centerName: act.centerName || 'Main Center',
      crpCode: act.crpCode || '—',
      blockTaluka: act.blockTaluka || '—',
      reportDate: act.reportDate,
      slotNumber: act.slotNumber,
      activityStatus: act.activityStatus || 'Completed',
      activityName: act.activityName,
      activityOther: act.activityOther || '—',
      activityType: act.activityType,
      village: act.village,
      wadi: act.wadi,
      farmerName: act.farmerName || '—',
      groupDetails: act.groupDetails || '—',
      participants: act.participants,
      maleParticipants: act.maleParticipants,
      femaleParticipants: act.femaleParticipants,
      observations: act.observations,
      issues: act.issues || '—',
      supportProvided: act.supportProvided || 'None',
      supportOther: act.supportOther || '—',
      followUpRequiredText: act.followUpRequired ? 'Yes' : 'No',
      followUpDate: act.followUpDate || '—',
      followUpDetails: act.followUpDetails || '—',
      startTime: act.startTime,
      endTime: act.endTime,
      startTimeIso: act.startTimeIso || '—',
      endTimeIso: act.endTimeIso || '—',
      durationMinutes: act.durationMinutes,
      startGpsLocationName: act.startGpsLocationName || 'Location unavailable',
      startGpsCoords: act.startGpsCoords || act.startGps || '—',
      endGpsLocationName: act.endGpsLocationName || 'Location unavailable',
      endGpsCoords: act.endGpsCoords || act.endGps || '—',
      photoEvidenceRefs: photoDisplayText,
      videoEvidenceRefs: videoDisplayText,
      reviewStatus: act.reviewStatus || '—',
      reviewerName: act.reviewerName || '—',
      reviewComments: act.reviewComments || '—',
      correctionHistory: act.correctionHistory || '—',
    };

    const row = sheet3.addRow(rowData);
    row.height = estimateWrappedRowHeight(sheet3Cols, rowData, 24);
    row.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: 'top',
        horizontal: numericColsSheet3.has(colNum) ? 'right' : 'left',
        wrapText: true,
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });

    if (photoUrls.length > 0) {
      const photoCell = row.getCell('photoEvidenceRefs');
      photoCell.value = {
        text: photoDisplayText,
        hyperlink: photoUrls[0],
        tooltip:
          photoUrls.length === 1
            ? photoUrls[0]
            : `Opens Photo 1 of ${photoUrls.length} — see Photo & Video Links sheet for individual links`,
      };
      photoCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D4ED8' }, underline: true };
    }

    if (videoUrls.length > 0) {
      const videoCell = row.getCell('videoEvidenceRefs');
      videoCell.value = {
        text: videoDisplayText,
        hyperlink: videoUrls[0],
        tooltip:
          videoUrls.length === 1
            ? videoUrls[0]
            : `Opens Video 1 of ${videoUrls.length} — see Photo & Video Links sheet for individual links`,
      };
      videoCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D4ED8' }, underline: true };
    }
  });

  if (dataset.allActivities.length === 0) {
    const emptyRow = sheet3.addRow({
      employeeId: '—',
      employeeName: 'No field activities recorded in this reporting period',
    });
    emptyRow.height = 22;
    emptyRow.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  // ==========================================
  // SHEET 4: Leave Records
  // ==========================================
  const sheet4 = workbook.addWorksheet('Leave Records', { views: sheetViews });
  const sheet4Cols = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 24 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Leave Type', key: 'leaveType', width: 18 },
    { header: 'Leave Reason', key: 'reason', width: 42 },
    { header: 'Approval Status', key: 'approvalStatus', width: 18 },
    { header: 'Approved By', key: 'approvedBy', width: 22 },
  ];
  sheet4.columns = sheet4Cols;

  styleHeaderRow(sheet4.getRow(1));
  if (excelCfg.autoFilter !== false) {
    sheet4.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet4Cols.length)}1` };
  }

  dataset.leaveRecords.forEach((l, idx) => {
    const row = sheet4.addRow({
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      date: l.date,
      leaveType: l.leaveType,
      reason: l.reason,
      approvalStatus: l.approvalStatus,
      approvedBy: l.approvedBy,
    });
    row.height = estimateWrappedRowHeight(sheet4Cols, l, 22);
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  if (dataset.leaveRecords.length === 0) {
    const row = sheet4.addRow({
      employeeId: '—',
      employeeName: 'No approved leaves recorded in this period',
      date: '—',
      leaveType: '—',
      reason: '—',
      approvalStatus: '—',
      approvedBy: '—',
    });
    row.height = 22;
    row.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  // ==========================================
  // SHEET 5: Review History
  // ==========================================
  if (excelCfg.includeReviewHistory !== false) {
    const sheet5 = workbook.addWorksheet('Review History', { views: sheetViews });
    const sheet5Cols = [
      { header: 'Employee ID', key: 'employeeId', width: 16 },
      { header: 'Employee Name', key: 'employeeName', width: 24 },
      { header: 'Activity/Report Date', key: 'reportDate', width: 18 },
      { header: 'Submission Timestamp (IST)', key: 'submittedTimestamp', width: 24 },
      { header: 'Review Timestamp (IST)', key: 'reviewTimestamp', width: 24 },
      { header: 'Reviewer', key: 'reviewer', width: 22 },
      { header: 'Review Status', key: 'reviewStatus', width: 20 },
      { header: 'Review Remarks / Edit Instructions', key: 'remarks', width: 44 },
      { header: 'Correction History', key: 'correctionHistory', width: 28 },
    ];
    sheet5.columns = sheet5Cols;

    styleHeaderRow(sheet5.getRow(1));
    if (excelCfg.autoFilter !== false) {
      sheet5.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet5Cols.length)}1` };
    }

    dataset.reviewHistory.forEach((r, idx) => {
      const row = sheet5.addRow({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        reportDate: r.reportDate,
        submittedTimestamp: r.submittedTimestamp,
        reviewTimestamp: r.reviewTimestamp,
        reviewer: r.reviewer,
        reviewStatus: r.reviewStatus,
        remarks: r.remarks,
        correctionHistory: r.correctionHistory,
      });

      row.height = estimateWrappedRowHeight(sheet5Cols, r, 22);
      row.eachCell((cell, colNum) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        if (colNum === 7) {
          if (r.reviewStatus === 'APPROVED') {
            cell.font = { bold: true, color: { argb: 'FF166534' } };
          } else if (r.reviewStatus.includes('CORRECTION') || r.reviewStatus.includes('EDIT') || r.reviewStatus === 'REJECTED') {
            cell.font = { bold: true, color: { argb: 'FFE11D48' } };
          }
        }
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
      });
    });

    if (dataset.reviewHistory.length === 0) {
      const row = sheet5.addRow({
        employeeId: '—',
        employeeName: 'No supervisor reviews recorded in this period',
        reportDate: '—',
        submittedTimestamp: '—',
        reviewTimestamp: '—',
        reviewer: '—',
        reviewStatus: '—',
        remarks: '—',
        correctionHistory: '—',
      });
      row.height = 22;
      row.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
    }
  }

  // ==========================================
  // SHEET 6: Photo & Video Evidence Hyperlinks (Individual 1-click links for every image/video)
  // ==========================================
  if (evidenceLinksRows.length > 0) {
    const sheet6 = workbook.addWorksheet('Photo & Video Links', { views: sheetViews });
    const sheet6Cols = [
      { header: 'Employee ID', key: 'employeeId', width: 16 },
      { header: 'Employee Name', key: 'employeeName', width: 22 },
      { header: 'Activity Date', key: 'reportDate', width: 14 },
      { header: 'Slot #', key: 'slotNumber', width: 10 },
      { header: 'Activity Name', key: 'activityName', width: 28 },
      { header: 'Media Type', key: 'mediaType', width: 14 },
      { header: 'Evidence Link', key: 'label', width: 20 },
      { header: 'Original URL', key: 'url', width: 64 },
    ];
    sheet6.columns = sheet6Cols;
    styleHeaderRow(sheet6.getRow(1));
    if (excelCfg.autoFilter !== false) {
      sheet6.autoFilter = { from: 'A1', to: `${getColumnLetter(sheet6Cols.length)}1` };
    }

    evidenceLinksRows.forEach((ev, idx) => {
      const row = sheet6.addRow(ev);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 4 ? 'right' : 'left',
          wrapText: true,
        };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
      });

      const labelCell = row.getCell('label');
      labelCell.value = { text: ev.label, hyperlink: ev.url, tooltip: ev.url };
      labelCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D4ED8' }, underline: true, bold: true };

      const urlCell = row.getCell('url');
      urlCell.value = { text: ev.url, hyperlink: ev.url, tooltip: ev.label };
      urlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1D4ED8' }, underline: true };
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
