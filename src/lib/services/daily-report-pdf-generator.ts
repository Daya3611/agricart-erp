import { AttendanceSession, Center, FieldReport, UserProfile } from '@/types';
import { formatDateTimeIST, formatReadableDate, formatTimeIST } from '@/lib/utils/date-utils';
import {
  formatLocationDisplay,
  isSingleFarmerActivity,
  mergeEvidenceUrls,
  normalizeActivityStatus,
  resolveActivityNameLabel,
  resolveSupportText,
} from '@/lib/utils/field-activity-calculations';
import { getGlobalReportingSettings, getSystemSettings } from '@/lib/services/settings-service';
import { fetchAttachmentData, FetchedAttachmentData } from '@/lib/services/attachment-fetcher';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  createReportMediaResolver,
  mapConcurrent,
  ResolvedReportMediaAsset,
} from '@/lib/reports/media-resolver';

function drawFitImage(
  doc: any,
  asset: ResolvedReportMediaAsset,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  if (!asset.pdfFormat) return;
  const aspect = asset.aspectRatio || 1;
  let drawW = boxW;
  let drawH = drawW / aspect;
  if (drawH > boxH) {
    drawH = boxH;
    drawW = drawH * aspect;
  }
  const x = boxX + (boxW - drawW) / 2;
  const y = boxY + (boxH - drawH) / 2;
  doc.addImage(asset.base64DataUrl, asset.pdfFormat, x, y, drawW, drawH, undefined, 'FAST');
}

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

  const [reportingConfig, systemSettings, employeeDoc] = await Promise.all([
    getGlobalReportingSettings(),
    getSystemSettings(),
    report.staffUid
      ? (fetchDocument(ERP_COLLECTIONS.employees, report.staffUid) as Promise<UserProfile | null>)
      : Promise.resolve(null),
  ]);
  const centerId = report.centerId || employeeDoc?.assignedCenterIds?.[0];
  const centerDoc = centerId
    ? ((await fetchDocument(ERP_COLLECTIONS.centers, centerId)) as Center | null)
    : null;

  const mediaResolver = createReportMediaResolver();
  await mediaResolver.preloadMediaIds([
    employeeDoc?.avatarMediaId,
    centerDoc?.photoMediaId,
  ]);

  const [employeeAvatarAsset, centerPhotoAsset] = await Promise.all([
    mediaResolver.resolveEmployeeAvatar(employeeDoc),
    mediaResolver.resolveCenterPhoto(centerDoc),
  ]);

  const includeGps = reportingConfig.includeGpsInExports !== false;
  const includePhotos = reportingConfig.includePhotosInExports !== false;

  const activities = [...(report.activities || [])].sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

  // Preload photos per activity slot with bounded concurrency (deduped via shared mediaResolver cache)
  const slotPhotosMap = new Map<number, FetchedAttachmentData[]>();
  if (includePhotos) {
    const photoTasks: Array<{
      slotNumber: number;
      index: number;
      url: string;
      objectKey?: string;
      mediaId?: string;
      uploadedAt: string;
      caption: string;
    }> = [];

    for (const act of activities) {
      const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
      const actLabel = resolveActivityNameLabel(act);
      const capturedAt = act.activityEndAt || act.activityStartAt || report.submittedAt || new Date().toISOString();
      const metaList = Array.isArray(act.photoMetadata) ? act.photoMetadata : [];
      const keyList = Array.isArray(act.photoObjectKeys) ? act.photoObjectKeys : [];
      const mediaIdList = Array.isArray(act.photoMediaIds) ? act.photoMediaIds : [];

      if (photos.length > 0) {
        photos.forEach((url, i) => {
          const matchedMeta = metaList.find((m) => m.url === url) || metaList[i];
          photoTasks.push({
            slotNumber: act.slotNumber,
            index: i,
            url,
            objectKey: matchedMeta?.objectKey || keyList[i],
            mediaId: matchedMeta?.mediaId || mediaIdList[i],
            uploadedAt: matchedMeta?.uploadedAt || capturedAt,
            caption: `Activity #${act.slotNumber}: ${actLabel} — Photo ${i + 1}`,
          });
        });
      } else if (keyList.length > 0 || mediaIdList.length > 0 || metaList.length > 0) {
        const count = Math.max(metaList.length, keyList.length, mediaIdList.length);
        for (let i = 0; i < count; i++) {
          const matchedMeta = metaList[i];
          const fallbackKey = matchedMeta?.objectKey || keyList[i];
          const fallbackMediaId = matchedMeta?.mediaId || mediaIdList[i];
          if (!fallbackKey && !fallbackMediaId) continue;
          photoTasks.push({
            slotNumber: act.slotNumber,
            index: i,
            url: fallbackMediaId ? `/api/v1/media/${fallbackMediaId}` : fallbackKey || '',
            objectKey: fallbackKey,
            mediaId: fallbackMediaId,
            uploadedAt: matchedMeta?.uploadedAt || capturedAt,
            caption: `Activity #${act.slotNumber}: ${actLabel} — Photo ${i + 1}`,
          });
        }
      }
    }

    await mediaResolver.preloadMediaIds(photoTasks.map((t) => t.mediaId));

    const fetchedAll = await mapConcurrent(photoTasks, 4, async (task) => {
      const data = await fetchAttachmentData(
        {
          id: `daily_${report.id}_${task.slotNumber}_${task.index}`,
          reportId: report.id,
          staffUid: report.staffUid,
          uploadedByUid: report.staffUid,
          storagePath: task.objectKey || task.url,
          downloadUrl: task.url,
          objectKey: task.objectKey,
          r2ObjectKey: task.objectKey,
          mediaId: task.mediaId,
          originalFilename: `Activity_${task.slotNumber}_Photo_${task.index + 1}.jpg`,
          caption: task.caption,
          fileSize: 0,
          mimeType: 'image/jpeg',
          uploadedAt: task.uploadedAt,
        },
        report.reportDate,
        mediaResolver
      );
      return { slotNumber: task.slotNumber, data };
    });

    for (const entry of fetchedAll) {
      const existing = slotPhotosMap.get(entry.slotNumber) || [];
      existing.push(entry.data);
      slotPhotosMap.set(entry.slotNumber, existing);
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

  // Forest Green Banner (#166534) — Report heading only (no organization name or logo)
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DAILY FIELD ACTIVITY REPORT', leftMargin, 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Complete Field Activity Submission', leftMargin, 16);
  doc.text(`Generated (IST): ${formatDateTimeIST(new Date().toISOString())}`, rightMargin, 16, { align: 'right' });

  let headerStartY = 27;
  const hasAvatar = Boolean(employeeAvatarAsset?.pdfFormat);
  const hasCenterPhoto = Boolean(centerPhotoAsset?.pdfFormat);

  if (hasAvatar || hasCenterPhoto) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftMargin, headerStartY, printableWidth, 16, 1.5, 1.5, 'FD');

    if (hasAvatar && employeeAvatarAsset) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(leftMargin + 2, headerStartY + 1.5, 13, 13, 1.5, 1.5, 'FD');
        drawFitImage(doc, employeeAvatarAsset, leftMargin + 2.5, headerStartY + 2, 12, 12);
      } catch {
        // non-fatal
      }
    }
    const empLabelX = hasAvatar ? leftMargin + 18 : leftMargin + 4;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(report.staffName || 'Field Staff', empLabelX, headerStartY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`${report.employeeId || 'EMP'} • ${report.departmentName || 'Field Operations'}`, empLabelX, headerStartY + 11.5);

    if (hasCenterPhoto && centerPhotoAsset) {
      try {
        const cBoxX = rightMargin - 15;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(cBoxX, headerStartY + 1.5, 13, 13, 1.5, 1.5, 'FD');
        drawFitImage(doc, centerPhotoAsset, cBoxX + 0.5, headerStartY + 2, 12, 12);
      } catch {
        // non-fatal
      }
    }
    const centerTextRightX = hasCenterPhoto ? rightMargin - 18 : rightMargin - 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text(report.centerName || centerDoc?.name || 'Main Center', centerTextRightX, headerStartY + 6.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(centerDoc?.code ? `Center Code: ${centerDoc.code}` : 'Assigned Operations Hub', centerTextRightX, headerStartY + 11.5, { align: 'right' });

    headerStartY += 18.5;
  }

  const statusLabel = (report.status || 'draft').replace(/_/g, ' ').toUpperCase();
  const revLabel = (report.revisionNumber || 1) > 1 ? ` (Revision #${report.revisionNumber})` : '';

  // 1. Employee & Operational Header Details
  autoTable(doc, {
    startY: headerStartY,
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
      [
        'Photo Evidence',
        photos.length > 0
          ? includePhotos
            ? `${photos.length} photo(s) attached (embedded below)`
            : `${photos.length} photo(s) attached (embedding disabled)`
          : 'No photo evidence attached',
      ],
      ['Video Evidence Links', videos.length > 0 ? videos.join('\n') : 'No video evidence attached'],
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

    // Render responsive 2-per-row embedded Photo Evidence Gallery (including graceful expired/missing cards)
    const slotPhotos = (slotPhotosMap.get(act.slotNumber) || []).filter((p) => !p.isVideo);
    if (includePhotos && slotPhotos.length > 0) {
      const cardW = 92;
      const thumbW = 86;
      const thumbH = 54;
      const cardH = thumbH + 14;
      const gapX = 6;

      if (currentY + 10 + cardH > pageHeight - 16) {
        doc.addPage();
        currentY = 14;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(22, 101, 52);
      doc.text(`Photo Evidence (${slotPhotos.length})`, leftMargin, currentY + 2);
      currentY += 5;

      for (let i = 0; i < slotPhotos.length; i += 2) {
        if (currentY + cardH > pageHeight - 16) {
          doc.addPage();
          currentY = 14;
        }

        const chunk = slotPhotos.slice(i, i + 2);
        chunk.forEach((item, colIdx) => {
          const x = leftMargin + colIdx * (cardW + gapX);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, currentY, cardW, cardH, 1.5, 1.5, 'FD');

          const boxX = x + (cardW - thumbW) / 2;
          const boxY = currentY + 3;

          if (!item.isUnavailable && item.base64DataUrl && item.format) {
            try {
              const aspect = item.aspectRatio || 4 / 3;
              let drawW = thumbW;
              let drawH = drawW / aspect;
              if (drawH > thumbH) {
                drawH = thumbH;
                drawW = drawH * aspect;
              }
              const imgX = boxX + (thumbW - drawW) / 2;
              const imgY = boxY + (thumbH - drawH) / 2;
              doc.addImage(item.base64DataUrl, item.format, imgX, imgY, drawW, drawH, undefined, 'FAST');
            } catch {
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(boxX, boxY, thumbW, thumbH, 1, 1, 'F');
              doc.setFontSize(7.2);
              doc.setTextColor(100, 116, 139);
              doc.text('Photo preview unavailable', x + cardW / 2, boxY + thumbH / 2, { align: 'center' });
            }
          } else {
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(boxX, boxY, thumbW, thumbH, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(180, 83, 9);
            const reasonMsg =
              item.failureReason === 'expired'
                ? 'Photo unavailable (File missing or link expired)'
                : item.failureReason === 'too_large'
                ? 'Photo unavailable (Exceeds size limit)'
                : item.failureReason === 'invalid_format'
                ? 'Photo unavailable (Unsupported image format)'
                : 'Photo unavailable (Could not be loaded)';
            doc.text(reasonMsg, x + cardW / 2, boxY + thumbH / 2 - 1, { align: 'center' });
          }

          const captionStr = item.caption || item.originalFilename || `Photo ${i + colIdx + 1}`;
          const safeCap = doc.splitTextToSize(captionStr, cardW - 6) as string[];
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(15, 23, 42);
          doc.text(safeCap[0] || captionStr, x + 3, currentY + thumbH + 7);

          const tsLabel = item.uploadedAt ? `Captured (IST): ${formatDateTimeIST(item.uploadedAt)}` : '';
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          doc.text(tsLabel, x + 3, currentY + thumbH + 11.2);
        });

        currentY += cardH + 3.5;
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
  const footerBanner = 'Confidential Staff Activity Record';
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
