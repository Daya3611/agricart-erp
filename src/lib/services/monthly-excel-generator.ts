import ExcelJS from 'exceljs';
import { MonthlyReportsDataset } from '@/types';

/**
 * Generate a professional 5-sheet Excel workbook (.xlsx) for monthly reports.
 * Fully styled with Agricart Forest-Green branding, frozen headers, auto-filters,
 * status conditional highlights, and proper column widths.
 *
 * Sheet 1: Monthly Summary
 * Sheet 2: Daily Attendance
 * Sheet 3: Daily Activities
 * Sheet 4: Leave Records
 * Sheet 5: Review History
 */
export async function generateMonthlyReportsWorkbook(dataset: MonthlyReportsDataset): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agricart ERP';
  workbook.created = new Date();
  workbook.modified = new Date();

  const brandGreen = '166534'; // Forest green (#166534)
  const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: brandGreen },
  };

  function styleHeaderRow(row: ExcelJS.Row) {
    row.height = 28;
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

  // ==========================================
  // SHEET 1: Monthly Summary
  // ==========================================
  const sheet1 = workbook.addWorksheet('Monthly Summary', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  sheet1.columns = [
    { header: 'Employee Name', key: 'employeeName', width: 24 },
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Department', key: 'departmentName', width: 22 },
    { header: 'Center', key: 'centerName', width: 20 },
    { header: 'Reporting Month', key: 'reportingMonth', width: 18 },
    { header: 'Total Working Days', key: 'totalWorkingDays', width: 18 },
    { header: 'Present Days', key: 'presentDays', width: 15 },
    { header: 'Leave Days', key: 'leaveDays', width: 14 },
    { header: 'Missing Attendance Days', key: 'missingAttendanceDays', width: 22 },
    { header: 'Total Activities', key: 'totalActivities', width: 16 },
    { header: 'Total Activity Hours', key: 'totalActivityHours', width: 18 },
    { header: 'Total Working Hours', key: 'totalWorkingHours', width: 18 },
    { header: 'Total Farmer Contacts', key: 'totalFarmerContacts', width: 20 },
    { header: 'Total Male Participants', key: 'totalMaleParticipants', width: 20 },
    { header: 'Total Female Participants', key: 'totalFemaleParticipants', width: 22 },
    { header: 'Approved Reports', key: 'reportsApproved', width: 17 },
    { header: 'Reports Requiring Correction', key: 'reportsRequiringCorrection', width: 24 },
    { header: 'Missing Reports', key: 'daysReportMissing', width: 16 },
  ];

  styleHeaderRow(sheet1.getRow(1));
  sheet1.autoFilter = { from: 'A1', to: 'R1' };

  dataset.employeeSummaries.forEach((emp, idx) => {
    const row = sheet1.addRow({
      employeeName: emp.employeeName,
      employeeId: emp.employeeId,
      departmentName: emp.departmentName,
      centerName: emp.centerName,
      reportingMonth: emp.reportingMonth || dataset.monthName,
      totalWorkingDays: emp.totalWorkingDays ?? emp.totalDaysWorked,
      presentDays: emp.presentDays ?? emp.totalAttendanceSessions,
      leaveDays: emp.leaveDays,
      missingAttendanceDays: emp.missingAttendanceDays ?? emp.daysReportMissing,
      totalActivities: emp.totalActivities,
      totalActivityHours: emp.totalActivityHours,
      totalWorkingHours: emp.totalWorkingHours,
      totalFarmerContacts: emp.totalFarmerContacts,
      totalMaleParticipants: emp.totalMaleParticipants,
      totalFemaleParticipants: emp.totalFemaleParticipants,
      reportsApproved: emp.reportsApproved,
      reportsRequiringCorrection: emp.reportsRequiringCorrection ?? emp.reportsRejected,
      daysReportMissing: emp.daysReportMissing,
    });

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 6 ? 'right' : 'left' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // Total summary row at bottom if multiple employees
  if (dataset.employeeSummaries.length > 1) {
    const totalRowIndex = dataset.employeeSummaries.length + 2;
    const summaryRow = sheet1.addRow({
      employeeName: 'Total / Average',
      employeeId: `(${dataset.employeeSummaries.length} Employees)`,
      departmentName: '—',
      centerName: '—',
      reportingMonth: dataset.monthName,
      totalWorkingDays: { formula: `SUM(F2:F${totalRowIndex - 1})` },
      presentDays: { formula: `SUM(G2:G${totalRowIndex - 1})` },
      leaveDays: { formula: `SUM(H2:H${totalRowIndex - 1})` },
      missingAttendanceDays: { formula: `SUM(I2:I${totalRowIndex - 1})` },
      totalActivities: { formula: `SUM(J2:J${totalRowIndex - 1})` },
      totalActivityHours: { formula: `SUM(K2:K${totalRowIndex - 1})` },
      totalWorkingHours: { formula: `SUM(L2:L${totalRowIndex - 1})` },
      totalFarmerContacts: { formula: `SUM(M2:M${totalRowIndex - 1})` },
      totalMaleParticipants: { formula: `SUM(N2:N${totalRowIndex - 1})` },
      totalFemaleParticipants: { formula: `SUM(O2:O${totalRowIndex - 1})` },
      reportsApproved: { formula: `SUM(P2:P${totalRowIndex - 1})` },
      reportsRequiringCorrection: { formula: `SUM(Q2:Q${totalRowIndex - 1})` },
      daysReportMissing: { formula: `SUM(R2:R${totalRowIndex - 1})` },
    });

    summaryRow.height = 24;
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    });
  }

  // ==========================================
  // SHEET 2: Daily Attendance
  // ==========================================
  const sheet2 = workbook.addWorksheet('Daily Attendance', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  sheet2.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 22 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Login Time', key: 'loginTime', width: 16 },
    { header: 'Login Location', key: 'loginLocation', width: 34 },
    { header: 'Logout Time', key: 'logoutTime', width: 16 },
    { header: 'Logout Location', key: 'logoutLocation', width: 34 },
    { header: 'Attendance Status', key: 'attendanceStatus', width: 18 },
    { header: 'Working Duration', key: 'workingDuration', width: 18 },
  ];

  styleHeaderRow(sheet2.getRow(1));
  sheet2.autoFilter = { from: 'A1', to: 'I1' };

  dataset.dailyRecords.forEach((rec, idx) => {
    const row = sheet2.addRow({
      employeeId: rec.employeeId,
      employeeName: rec.employeeName,
      date: rec.date,
      loginTime: rec.attendanceLogin,
      loginLocation: rec.loginLocation || '—',
      logoutTime: rec.attendanceLogout,
      logoutLocation: rec.logoutLocation || '—',
      attendanceStatus: rec.attendanceStatus || (rec.attendanceLogin !== '—' ? 'Present' : 'Absent'),
      workingDuration: rec.workingPeriodFormatted || '—',
    });

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: [3, 4, 6, 8, 9].includes(colNum) ? 'center' : 'left' };
      if (rec.attendanceStatus === 'Absent' || rec.isMissing) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; // Soft light red
      } else if (rec.attendanceStatus === 'On Leave') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }; // Soft purple
      } else if (rec.attendanceStatus === 'Weekly Off' || rec.attendanceStatus === 'Holiday') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Soft slate
      } else if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // ==========================================
  // SHEET 3: Field Activities
  // ==========================================
  const sheet3 = workbook.addWorksheet('Field Activities', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  sheet3.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 22 },
    { header: 'Activity Date', key: 'reportDate', width: 14 },
    { header: 'Activity #', key: 'slotNumber', width: 12 },
    { header: 'Activity Name', key: 'activityName', width: 28 },
    { header: 'Activity Type', key: 'activityType', width: 16 },
    { header: 'Village', key: 'village', width: 18 },
    { header: 'Wadi', key: 'wadi', width: 16 },
    { header: 'Farmer Name', key: 'farmerName', width: 22 },
    { header: 'Participant Totals', key: 'participants', width: 18 },
    { header: 'Male Participants', key: 'maleParticipants', width: 17 },
    { header: 'Female Participants', key: 'femaleParticipants', width: 18 },
    { header: 'Observations', key: 'observations', width: 38 },
    { header: 'Farmer Issues', key: 'issues', width: 28 },
    { header: 'Support Provided', key: 'supportProvided', width: 26 },
    { header: 'Follow-up', key: 'followUp', width: 22 },
    { header: 'Activity Start Time', key: 'startTime', width: 18 },
    { header: 'Activity End Time', key: 'endTime', width: 18 },
    { header: 'Duration (Min)', key: 'durationMinutes', width: 15 },
    { header: 'Start Location Name', key: 'startGpsLocationName', width: 32 },
    { header: 'Start GPS Coordinates', key: 'startGpsCoords', width: 22 },
    { header: 'End Location Name', key: 'endGpsLocationName', width: 32 },
    { header: 'End GPS Coordinates', key: 'endGpsCoords', width: 22 },
    { header: 'Photo Evidence References', key: 'photoEvidenceRefs', width: 24 },
  ];

  styleHeaderRow(sheet3.getRow(1));
  sheet3.autoFilter = { from: 'A1', to: 'X1' };

  dataset.allActivities.forEach((act, idx) => {
    const row = sheet3.addRow({
      employeeId: act.employeeId,
      employeeName: act.employeeName,
      reportDate: act.reportDate,
      slotNumber: act.slotNumber,
      activityName: act.activityName,
      activityType: act.activityType,
      village: act.village,
      wadi: act.wadi,
      farmerName: act.farmerName || '—',
      participants: act.participants,
      maleParticipants: act.maleParticipants,
      femaleParticipants: act.femaleParticipants,
      observations: act.observations,
      issues: act.issues || '—',
      supportProvided: act.supportProvided,
      followUp: act.followUp,
      startTime: act.startTime,
      endTime: act.endTime,
      durationMinutes: act.durationMinutes,
      startGpsCoords: act.startGpsCoords || act.startGps || '—',
      startGpsLocationName: act.startGpsLocationName || 'Location unavailable',
      endGpsCoords: act.endGpsCoords || act.endGps || '—',
      endGpsLocationName: act.endGpsLocationName || 'Location unavailable',
      photoEvidenceRefs: act.photoEvidenceRefs || 'None',
    });

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: [4, 10, 11, 12, 17, 18, 19].includes(colNum) ? 'right' : 'left',
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // ==========================================
  // SHEET 4: Leave Records
  // ==========================================
  const sheet4 = workbook.addWorksheet('Leave Records', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  sheet4.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 24 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Leave Type', key: 'leaveType', width: 18 },
    { header: 'Leave Reason', key: 'reason', width: 34 },
    { header: 'Approval Status', key: 'approvalStatus', width: 18 },
    { header: 'Approved By', key: 'approvedBy', width: 22 },
  ];

  styleHeaderRow(sheet4.getRow(1));
  sheet4.autoFilter = { from: 'A1', to: 'G1' };

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

    row.height = 20;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // If no leave records in month, add placeholder row
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
    row.height = 20;
    row.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  // ==========================================
  // SHEET 5: Review History
  // ==========================================
  const sheet5 = workbook.addWorksheet('Review History', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  });

  sheet5.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 16 },
    { header: 'Employee Name', key: 'employeeName', width: 24 },
    { header: 'Activity/Report Date', key: 'reportDate', width: 18 },
    { header: 'Submission Timestamp', key: 'submittedTimestamp', width: 22 },
    { header: 'Review Timestamp', key: 'reviewTimestamp', width: 22 },
    { header: 'Reviewer', key: 'reviewer', width: 22 },
    { header: 'Review Status', key: 'reviewStatus', width: 18 },
    { header: 'Review Remarks', key: 'remarks', width: 36 },
    { header: 'Correction History', key: 'correctionHistory', width: 22 },
  ];

  styleHeaderRow(sheet5.getRow(1));
  sheet5.autoFilter = { from: 'A1', to: 'I1' };

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

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (colNum === 7) {
        if (r.reviewStatus === 'APPROVED') {
          cell.font = { bold: true, color: { argb: 'FF166534' } };
        } else if (r.reviewStatus.includes('CORRECTION') || r.reviewStatus === 'REJECTED') {
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
    row.height = 20;
    row.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
