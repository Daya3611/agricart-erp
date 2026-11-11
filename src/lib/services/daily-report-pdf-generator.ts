import { AttendanceSession, FieldReport } from '@/types';
import { formatDateTimeIST, formatReadableDate, formatTimeIST } from '@/lib/utils/date-utils';
import {
  formatLocationDisplay,
  isSingleFarmerActivity,
  mergeEvidenceUrls,
  normalizeActivityStatus,
  resolveActivityNameLabel,
  resolveSupportText,
} from '@/lib/utils/field-activity-calculations';
import { getGlobalReportingSettings } from '@/lib/services/settings-service';
import { fetchAttachmentData, FetchedAttachmentData } from '@/lib/services/attachment-fetcher';

/**
 * Generates a complete, untruncated Daily Field Activity Report PDF for an employee.
 * - Includes ALL activity slots (1..N) and ALL entered fields without truncation.
 * - Uses Asia/Kolkata timezone consistently across timestamps.
 * - Respects global reporting settings (org header, GPS coordinate visibility, photo embedding).
 * - Embeds activity photos cleanly where available and always lists exact URLs & video links.
 * - Paginates cleanly across pages with consistent Page X of Y footers.
 */
export async function generateDailyFieldReportPDF(
  report: FieldReport,
  attendance?: AttendanceSession | null
): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const reportingConfig = await getGlobalReportingSettings();
  const includeGps = reportingConfig.includeGpsInExports !== false;
  const includePhotos = reportingConfig.includePhotosInExports !== false;
  const showOrgHeader = reportingConfig.pdfSettings?.showOrgHeader !== false;

  const activities = [...(report.activities || [])].sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

  // Preload photos per activity slot when enabled
  const slotPhotosMap = new Map<number, FetchedAttachmentData[]>();
  if (includePhotos) {
    for (const act of activities) {
      const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
      if (photos.length === 0) continue;
      const fetched: FetchedAttachmentData[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = photos[i];
        const data = await fetchAttachmentData(
          {
            id: `daily_${report.id}_${act.slotNumber}_${i}`,
            reportId: report.id,
            staffUid: report.staffUid,
            uploadedByUid: report.staffUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: `Activity_${act.slotNumber}_Photo_${i + 1}.jpg`,
            fileSize: 0,
            mimeType: 'image/jpeg',
            uploadedAt: act.activityEndAt || act.activityStartAt || report.submittedAt || new Date().toISOString(),
          },
          report.reportDate
        );
        fetched.push(data);
      }
      slotPhotosMap.set(act.slotNumber, fetched);
    }
  }

  // Portrait A4: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 10;
  const rightMargin = 200;
  const printableWidth = 190;

  // Forest Green Banner (#166534)
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleText = reportingConfig.pdfSettings?.headerTitle || 'DAILY FIELD ACTIVITY REPORT';
  doc.text(titleText, leftMargin, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const orgSub =
    showOrgHeader && reportingConfig.organization?.companyName
      ? `${reportingConfig.organization.companyName} • Complete Field Activity Submission`
      : 'Official Verified Staff Activity Submission';
  doc.text(orgSub, leftMargin, 15.5);
  doc.text(`Generated (IST): ${formatDateTimeIST(new Date().toISOString())}`, rightMargin, 15.5, { align: 'right' });

  const statusLabel = (report.status || 'draft').replace(/_/g, ' ').toUpperCase();
  const revLabel = (report.revisionNumber || 1) > 1 ? ` (Revision #${report.revisionNumber})` : '';

  // 1. Employee & Operational Header Details
  autoTable(doc, {
    startY: 27,
    theme: 'grid',
    margin: { left: leftMargin, right: leftMargin },
    styles: { fontSize: 7.8, cellPadding: 2, overflow: 'linebreak', textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold', fillColor: [241, 245, 249] },
      1: { cellWidth: 61 },
      2: { cellWidth: 34, fontStyle: 'bold', fillColor: [241, 245, 249] },
      3: { cellWidth: 61 },
    },
    body: [
      [
        'Employee Name',
        `${report.staffName || 'Staff'} (${report.employeeId || 'EMP'})`,
        'Report Date',
        formatReadableDate(report.reportDate),
      ],
      [
        'Department',
        report.departmentName || 'Field Operations',
        'Center',
        report.centerName || 'Main Center',
      ],
      [
        'CRP Code',
        report.crpCode?.trim() || '—',
        'Block / Taluka',
        report.blockTaluka?.trim() || '—',
      ],
      [
        'Report Status',
        `${statusLabel}${revLabel}`,
        'Submission Time (IST)',
        report.submittedAt ? formatDateTimeIST(report.submittedAt) : 'Pending / Draft',
      ],
    ],
  });

  // 2. Attendance & Report Finalization Verification
  const loginTimeDisp = attendance?.loginTimestamp ? formatTimeIST(attendance.loginTimestamp) : '—';
  const logoutTimeDisp = attendance?.logoutTimestamp ? formatTimeIST(attendance.logoutTimestamp) : '—';
  const loginLocDisp = formatLocationDisplay(attendance?.loginGps, includeGps);
  const logoutLocDisp =
    attendance?.logoutType === 'automatic_midnight'
      ? 'Auto-closed at midnight (Location unavailable)'
      : formatLocationDisplay(attendance?.logoutGps, includeGps);
  const finalLocDisp = formatLocationDisplay(report.finalizationGps, includeGps);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 60) + 3,
    theme: 'grid',
    margin: { left: leftMargin, right: leftMargin },
    head: [['ATTENDANCE & GPS VERIFICATION', 'Details (IST Timezone)']],
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 144 },
    },
    body: [
      ['Attendance Clock-In', `${loginTimeDisp} • ${loginLocDisp}`],
      ['Attendance Clock-Out', `${logoutTimeDisp} • ${logoutLocDisp}`],
      [
        'Finalization Location',
        `${finalLocDisp}${report.finalizationLocationStatus ? ` (Capture Status: ${report.finalizationLocationStatus})` : ''}`,
      ],
    ],
  });

  // 3. Daily Summary Metrics
  const completedCount = activities.filter(
    (a) =>
      a.activityStatus === 'COMPLETED' ||
      a.activityStatus === 'completed' ||
      Boolean((a.activityEndAt || a.activityEnd)?.trim())
  ).length;
  const summary = report.summary || {
    totalActivities: activities.length,
    totalActivityMinutes: activities.reduce((acc, a) => acc + (a.activityDurationMinutes ?? a.durationMinutes ?? 0), 0),
    totalActivityHours: 0,
    totalWorkingPeriodMinutes: 0,
    totalWorkingPeriodHours: 0,
    totalDeskJobMinutes: 0,
    totalFieldActivityMinutes: 0,
    totalParticipantContacts: activities.reduce((acc, a) => acc + (a.totalParticipants || 0), 0),
    totalMaleParticipants: activities.reduce((acc, a) => acc + (a.maleParticipants || 0), 0),
    totalFemaleParticipants: activities.reduce((acc, a) => acc + (a.femaleParticipants || 0), 0),
  };

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 95) + 3,
    theme: 'grid',
    margin: { left: leftMargin, right: leftMargin },
    head: [
      [
        'Activities (Done/Total)',
        'Active Duration',
        'Field / Desk Time',
        'Working Period',
        'Total Participants',
        'Male / Female',
      ],
    ],
    headStyles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.8, cellPadding: 2.2, halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] },
    body: [
      [
        `${completedCount} / ${summary.totalActivities ?? activities.length}`,
        `${summary.totalActivityHours} hrs (${summary.totalActivityMinutes} mins)`,
        `Field: ${summary.totalFieldActivityMinutes}m | Desk: ${summary.totalDeskJobMinutes}m`,
        `${summary.totalWorkingPeriodHours} hrs (${summary.totalWorkingPeriodMinutes}m)`,
        String(summary.totalParticipantContacts || 0),
        `M: ${summary.totalMaleParticipants || 0} / F: ${summary.totalFemaleParticipants || 0}`,
      ],
    ],
  });

  // 4. Complete Slot-by-Slot Activity Breakdown (ZERO truncation)
  let currentY = ((doc as any).lastAutoTable?.finalY || 120) + 5;

  if (currentY + 18 > pageHeight - 16) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`COMPLETE FIELD ACTIVITY DETAILS (${activities.length} RECORDED SLOTS)`, leftMargin, currentY);
  currentY += 3;

  if (activities.length === 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: leftMargin, right: leftMargin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      body: [['No field activities recorded for this date.']],
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 12) + 4;
  }

  for (const act of activities) {
    if (currentY + 35 > pageHeight - 16) {
      doc.addPage();
      currentY = 14;
    }

    const title = resolveActivityNameLabel(act);
    const isDesk = act.activityName === 'desk_job';
    const isSingle = isSingleFarmerActivity(act);
    const normStatus = normalizeActivityStatus(act);
    const slotCompleted = normStatus === 'COMPLETED';
    const slotStatusText =
      normStatus === 'COMPLETED'
        ? 'COMPLETED'
        : normStatus === 'IN_PROGRESS'
        ? 'IN PROGRESS'
        : normStatus === 'CANCELLED'
        ? 'CANCELLED'
        : 'NOT STARTED';

    const startTimeStr = formatTimeIST(act.activityStartAt || act.activityStart);
    const endTimeStr = formatTimeIST(act.activityEndAt || act.activityEnd);
    const durMins = act.activityDurationMinutes ?? act.durationMinutes ?? 0;

    const categoryLabel = isDesk
      ? 'Office / Desk Work'
      : isSingle
      ? 'Single Farmer Visit'
      : 'Group / Community Meeting';

    const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
    const videos = mergeEvidenceUrls(act.videoUrl, act.videoEvidence);

    const rows: [string, string][] = [
      [
        'Activity & Category',
        `${title}${act.activityOther?.trim() ? ` — Specified: ${act.activityOther.trim()}` : ''} (${categoryLabel})`,
      ],
      [
        'Village / Wadi',
        isDesk
          ? 'Office / Desk Location'
          : `Village: ${act.village?.trim() || '—'} | Wadi / Hamlet: ${act.wadi?.trim() || '—'}`,
      ],
      [
        isSingle ? 'Farmer Name' : 'Farmer / Group Details',
        isSingle
          ? `${act.farmerName?.trim() || '—'}${act.groupDetails?.trim() ? `\nDetails: ${act.groupDetails.trim()}` : ''}`
          : `Lead / Farmer: ${act.farmerName?.trim() || '—'}\nGroup / Meeting Details: ${act.groupDetails?.trim() || '—'}`,
      ],
      [
        'Participants Count',
        `Total: ${act.totalParticipants ?? 0} | Male: ${act.maleParticipants ?? 0} | Female: ${act.femaleParticipants ?? 0}`,
      ],
      [
        'Timing & Duration (IST)',
        `Start: ${startTimeStr} | End: ${endTimeStr} | Duration: ${durMins} mins`,
      ],
      ['Key Observations / Summary', act.observations?.trim() || 'No observations recorded.'],
      ['Farmer Issues / Challenges', act.farmerIssues?.trim() || 'None reported'],
      ['Support / Guidance Provided', resolveSupportText(act)],
      [
        'Follow-up Required',
        act.followUpRequired
          ? `Yes${act.followUpDate?.trim() ? ` (Target Date: ${act.followUpDate.trim()})` : ''}\nDetails: ${act.followUpDetails?.trim() || 'No additional follow-up notes'}`
          : 'No',
      ],
      [
        'Start Activity GPS',
        `${formatLocationDisplay(act.activityStartLocation || act.activityStartGps, includeGps)}${
          act.activityStartLocationStatus ? ` [${act.activityStartLocationStatus}]` : ''
        }`,
      ],
      [
        'End Activity GPS',
        `${formatLocationDisplay(act.activityEndLocation || act.activityEndGps, includeGps)}${
          act.activityEndLocationStatus ? ` [${act.activityEndLocationStatus}]` : ''
        }`,
      ],
      ['Photo Evidence URLs', photos.length > 0 ? photos.join('\n') : 'No photo evidence attached'],
      ['Video Evidence URLs', videos.length > 0 ? videos.join('\n') : 'No video evidence attached'],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: leftMargin, right: leftMargin },
      theme: 'grid',
      head: [[`Activity #${act.slotNumber || 1}: ${title}`, `Status: ${slotStatusText} • ${startTimeStr} - ${endTimeStr} (${durMins}m)`]],
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top', textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 46, fontStyle: 'bold', fillColor: [248, 250, 252] },
        1: { cellWidth: 144 },
      },
      body: rows,
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 40) + 3;

    // Render embedded photo thumbnails for this activity immediately underneath if preloaded
    const slotPhotos = (slotPhotosMap.get(act.slotNumber) || []).filter(
      (p) => !p.isVideo && !p.isUnavailable && p.base64DataUrl
    );
    if (slotPhotos.length > 0) {
      const thumbW = 58;
      const thumbH = 38;
      const cardH = thumbH + 9;
      const gapX = 6;

      for (let i = 0; i < slotPhotos.length; i += 3) {
        if (currentY + cardH > pageHeight - 16) {
          doc.addPage();
          currentY = 14;
        }

        const chunk = slotPhotos.slice(i, i + 3);
        chunk.forEach((item, colIdx) => {
          const x = leftMargin + colIdx * (thumbW + gapX);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, currentY, thumbW, cardH, 1.5, 1.5, 'FD');

          try {
            const aspect = item.aspectRatio || 4 / 3;
            const maxW = thumbW - 4;
            const maxH = thumbH - 4;
            let drawW = maxW;
            let drawH = drawW / aspect;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = drawH * aspect;
            }
            const imgX = x + (thumbW - drawW) / 2;
            const imgY = currentY + 2 + (maxH - drawH) / 2;
            doc.addImage(item.base64DataUrl!, item.format || 'JPEG', imgX, imgY, drawW, drawH, undefined, 'FAST');
          } catch {
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('Photo preview unavailable', x + thumbW / 2, currentY + thumbH / 2, { align: 'center' });
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(15, 23, 42);
          doc.text(item.originalFilename, x + 2, currentY + thumbH + 5);
        });

        currentY += cardH + 3;
      }
    }

    currentY += 2;
  }

  // 5. Supervisor Review & Approval History Section
  if (currentY + 28 > pageHeight - 16) {
    doc.addPage();
    currentY = 14;
  }

  const reviewRows: [string, string][] = [
    ['Latest Verification Status', `${statusLabel}${revLabel}`],
    [
      'Reviewed By',
      report.reviewerName
        ? `${report.reviewerName}${report.reviewerRole ? ` (${report.reviewerRole})` : ''}${
            report.reviewedAt ? ` on ${formatDateTimeIST(report.reviewedAt)}` : ''
          }`
        : 'Pending Supervisor Verification',
    ],
    ['Reviewer Comments', report.reviewComments?.trim() || '—'],
  ];

  if (report.editRequest) {
    reviewRows.push([
      'Edit / Correction Request',
      `Requested by ${report.editRequest.requesterName} (${formatDateTimeIST(report.editRequest.requestedAt)})\nReason: ${report.editRequest.reason}${
        report.editRequest.instructions ? `\nInstructions: ${report.editRequest.instructions}` : ''
      }`,
    ]);
  }

  if (Array.isArray(report.approvalHistory) && report.approvalHistory.length > 0) {
    const historyLines = report.approvalHistory.map(
      (h, idx) =>
        `${idx + 1}. Revision #${h.revisionNumber} — ${h.decision.replace(/_/g, ' ').toUpperCase()} by ${h.reviewerName} (${h.reviewerRole}) at ${formatDateTimeIST(h.decidedAt)}${
          h.comments ? `: ${h.comments}` : ''
        }`
    );
    reviewRows.push(['Approval History Log', historyLines.join('\n')]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    theme: 'grid',
    head: [['SUPERVISOR REVIEW & VERIFICATION RECORD', 'Details']],
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 142 },
    },
    body: reviewRows,
  });

  // 6. Stamp consistent page footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  const footerBanner =
    reportingConfig.pdfSettings?.footerText ||
    'Confidential Staff Activity Record • Official Verified Submission';
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(footerBanner, leftMargin, pageHeight - 7);
    doc.text(`Page ${p} of ${totalPages}`, rightMargin, pageHeight - 7, { align: 'right' });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
