import { FieldReport, AttendanceSession } from '@/types';
import { formatReadableDate } from '@/lib/utils/date-utils';

/**
 * Extracts a human-readable location placeName.
 * Never displays raw latitude, longitude, or accuracy values.
 * If unavailable, outputs "Location unavailable".
 */
function getHumanReadablePlaceName(loc?: { placeName?: string } | null): string {
  if (!loc || !loc.placeName || loc.placeName.trim() === '' || loc.placeName === 'Location name unavailable') {
    return 'Location unavailable';
  }
  return loc.placeName.trim();
}

/**
 * Generate a professional Daily Field Activity Report PDF for an individual employee.
 * Strictly adheres to:
 * 1. Complete activity details with NO truncation of observations.
 * 2. Human-readable location names (e.g. "Diva, Thane, Maharashtra, India").
 * 3. NO raw coordinates (latitude/longitude) or accuracy values anywhere.
 * 4. Fits cleanly on one page whenever possible, and gracefully multi-pages if activities overflow.
 */
export async function generateDailyFieldReportPDF(
  report: FieldReport,
  attendance?: AttendanceSession | null
): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as any).default || autoTableModule;

  // Portrait A4: 210mm wide x 297mm high
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 10;
  const rightMargin = 200;
  const printableWidth = 190;

  // Header Banner: Forest Green (#166534)
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Title & Subtitle (No hardcoded company name per user instruction)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DAILY FIELD ACTIVITY REPORT', leftMargin, 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Official Verified Staff Submission', leftMargin, 14);

  doc.setFontSize(7.5);
  const genStr = `Generated: ${new Date().toLocaleDateString('en-IN')}`;
  doc.text(genStr, rightMargin, 14, { align: 'right' });

  // Employee & Report Metadata Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(leftMargin, 25, printableWidth, 18, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  // Row 1
  doc.text(`Employee: ${report.staffName || 'Staff'} (${report.employeeId || 'EMP'})`, leftMargin + 3, 30);
  doc.text(`Department: ${report.departmentName || 'Field Operations'}`, leftMargin + 85, 30);
  doc.text(`Report Date: ${formatReadableDate(report.reportDate)}`, rightMargin - 3, 30, { align: 'right' });

  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Center: ${report.centerName || 'Nashik Center'}`, leftMargin + 3, 35);
  const subTimeStr = report.submittedAt
    ? new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : 'Pending';
  doc.text(`Submission Time: ${subTimeStr}`, leftMargin + 85, 35);

  const statusLabel = (report.status || 'draft').replace(/_/g, ' ').toUpperCase();
  doc.setFont('helvetica', 'bold');
  if (report.status === 'approved') {
    doc.setTextColor(22, 101, 52);
  } else if (report.status === 'rejected') {
    doc.setTextColor(225, 29, 72);
  } else {
    doc.setTextColor(30, 64, 175);
  }
  doc.text(`Status: ${statusLabel}`, rightMargin - 3, 35, { align: 'right' });
  doc.setTextColor(15, 23, 42);

  // Table Columns:
  // # | Activity & Type | Village/Wadi | Timing & Dur | Pts | Observations & Support | Location (Human Place Name)
  const tableHeaders = [
    ['#', 'Activity Name', 'Village / Wadi', 'Timing', 'Dur', 'Pts', 'Complete Observations & Issues', 'Location Name'],
  ];

  const tableData = (report.activities || []).map((act) => {
    const timeRange = `${act.activityStart ? act.activityStart.split('T')[1]?.slice(0, 5) : '—'} - ${act.activityEnd ? act.activityEnd.split('T')[1]?.slice(0, 5) : '—'}`;
    const villageWadi = act.activityName === 'desk_job'
      ? 'Office / Desk'
      : (act.village ? `${act.village}${act.wadi ? ` (${act.wadi})` : ''}` : 'Field');
    const participants = act.activityName === 'desk_job' ? '—' : `${act.totalParticipants || 0}`;

    // Full, untruncated observations and issues
    let fullObs = act.observations || '—';
    if (act.farmerIssues && act.farmerIssues.trim()) {
      fullObs += `\nIssues: ${act.farmerIssues.trim()}`;
    }
    if (Array.isArray(act.supportProvided) && act.supportProvided.length > 0) {
      fullObs += `\nSupport: ${act.supportProvided.join(', ')}`;
    }
    if (act.farmerName && act.farmerName.trim()) {
      fullObs = `Farmer: ${act.farmerName.trim()} | ` + fullObs;
    }

    // Human-readable location only — NEVER raw lat/lng
    const startLoc = getHumanReadablePlaceName(act.activityStartLocation || act.activityStartGps);
    const endLoc = getHumanReadablePlaceName(act.activityEndLocation || act.activityEndGps);
    let locationDisplay = 'Location unavailable';
    if (startLoc !== 'Location unavailable' && endLoc !== 'Location unavailable') {
      locationDisplay = startLoc === endLoc ? startLoc : `Start: ${startLoc}\nEnd: ${endLoc}`;
    } else if (startLoc !== 'Location unavailable') {
      locationDisplay = startLoc;
    } else if (endLoc !== 'Location unavailable') {
      locationDisplay = endLoc;
    }

    return [
      String(act.slotNumber || 1),
      act.activityNameLabel || act.activityName?.replace(/_/g, ' ') || 'Activity',
      villageWadi,
      timeRange,
      `${act.durationMinutes || 0}m`,
      participants,
      fullObs,
      locationDisplay,
    ];
  });

  const activityCount = report.activities?.length || 0;
  const isCompact = activityCount > 8;
  const tableFontSize = isCompact ? 6.5 : 7.2;

  autoTable(doc, {
    startY: 46,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    margin: { left: leftMargin, right: leftMargin },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: tableFontSize + 0.5,
      halign: 'center',
      cellPadding: 1.8,
    },
    styles: {
      fontSize: tableFontSize,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 9, halign: 'center' },
      6: { cellWidth: 55 },
      7: { cellWidth: 40 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  let currentY = (doc as any).lastAutoTable?.finalY || 160;

  // Check if summary cards fit on this page (needs ~60mm), otherwise add new page cleanly
  if (currentY + 62 > pageHeight - 12) {
    doc.addPage();
    currentY = 15;
  } else {
    currentY += 4;
  }

  // Daily Summary Metrics Card
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(leftMargin, currentY, printableWidth, 23, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.text('DAILY ACTIVITY SUMMARY & METRICS', leftMargin + 3, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);

  const summary = report.summary || {
    totalActivities: report.activities?.length || 0,
    totalActivityMinutes: 0,
    totalActivityHours: 0,
    totalWorkingPeriodHours: 0,
    totalDeskJobMinutes: 0,
    totalFieldActivityMinutes: 0,
    totalParticipantContacts: 0,
    totalMaleParticipants: 0,
    totalFemaleParticipants: 0,
  };

  doc.text(`Total Activities: ${summary.totalActivities}`, leftMargin + 3, currentY + 11);
  doc.text(`Active Task Time: ${summary.totalActivityHours} hrs (${summary.totalActivityMinutes} mins)`, leftMargin + 50, currentY + 11);
  doc.text(`Working Period: ${summary.totalWorkingPeriodHours} hrs`, leftMargin + 120, currentY + 11);
  doc.text(`Desk Job Time: ${summary.totalDeskJobMinutes} mins`, rightMargin - 3, currentY + 11, { align: 'right' });

  doc.text(`Field Activity Time: ${summary.totalFieldActivityMinutes} mins`, leftMargin + 3, currentY + 17);
  doc.text(`Farmer Contacts: ${summary.totalParticipantContacts}`, leftMargin + 50, currentY + 17);
  doc.text(`Male Participants: ${summary.totalMaleParticipants}`, leftMargin + 120, currentY + 17);
  doc.text(`Female Participants: ${summary.totalFemaleParticipants}`, rightMargin - 3, currentY + 17, { align: 'right' });

  // Attendance & Location Verification Box
  currentY += 26;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, currentY, printableWidth, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ATTENDANCE & LOCATION VERIFICATION', leftMargin + 3, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  const loginTimeDisplay = attendance?.loginTimestamp
    ? new Date(attendance.loginTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';
  const logoutTimeDisplay = attendance?.logoutTimestamp
    ? new Date(attendance.logoutTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';

  // Human place name only, strictly NO lat/long coordinates
  const loginLocDisplay = getHumanReadablePlaceName(attendance?.loginGps);
  const logoutLocDisplay = attendance?.logoutType === 'automatic_midnight'
    ? 'Auto-closed at midnight (Location unavailable)'
    : getHumanReadablePlaceName(attendance?.logoutGps);
  const finalLocDisplay = getHumanReadablePlaceName(report.finalizationGps);

  doc.text(`Login: ${loginTimeDisplay} • Location: ${loginLocDisplay}`, leftMargin + 3, currentY + 10.5);
  doc.text(`Logout: ${logoutTimeDisplay} • Location: ${logoutLocDisplay}`, leftMargin + 3, currentY + 14.5);
  doc.text(`Report Finalization: ${finalLocDisplay}`, leftMargin + 3, currentY + 18.5);

  // Footer: Reviewer & Page info
  currentY += 25;
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);

  const revText = report.reviewerName
    ? `Reviewed by: ${report.reviewerName} on ${report.reviewedAt ? new Date(report.reviewedAt).toLocaleDateString('en-IN') : 'N/A'}`
    : 'Review: Pending Supervisor Verification';
  doc.text(revText, leftMargin, currentY);

  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageStr = pageCount > 1 ? `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}` : 'Single Page Official Record';
  doc.text(`Confidential Field Activity Record • ${pageStr}`, rightMargin, currentY, { align: 'right' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
