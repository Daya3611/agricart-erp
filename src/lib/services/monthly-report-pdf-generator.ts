import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyReportSummary } from '@/types';
import { formatDateTimeIST } from '@/lib/utils/date-utils';
import { getGlobalReportingSettings } from '@/lib/services/settings-service';
import { fetchAttachmentData, FetchedAttachmentData } from './attachment-fetcher';

interface DayMediaGroup {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  dailyActivity: string;
  reportStatus: string;
  items: FetchedAttachmentData[];
}

function formatGpsText(loc?: { latitude?: number; longitude?: number; placeName?: string } | null, includeCoords = true): string {
  if (!loc) return 'Location unavailable';
  const place =
    loc.placeName && loc.placeName.trim() !== '' && loc.placeName !== 'Location name unavailable'
      ? loc.placeName.trim()
      : '';
  const hasCoords =
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number' &&
    !Number.isNaN(loc.latitude) &&
    !Number.isNaN(loc.longitude);

  if (includeCoords && hasCoords) {
    const coord = `${loc.latitude!.toFixed(5)}, ${loc.longitude!.toFixed(5)}`;
    return place ? `${place} (${coord})` : coord;
  }
  return place || 'Location unavailable';
}

/**
 * Deterministically generates a complete monthly activity report PDF on the server:
 * 1. Monthly Attendance, Leave & Statistics Overview
 * 2. Complete Day-by-Day & Activity-by-Activity Field Details (ZERO truncation of text/URLs)
 * 3. Embedded Real Photos & Video Evidence References
 * 4. Respects Asia/Kolkata timestamps and Global Reporting Settings
 */
export async function generateMonthlyReportPDF(report: MonthlyReportSummary): Promise<Buffer> {
  console.log(
    `[Monthly PDF Export] Initiating server-side PDF generation for ${report.employee.fullName} (${report.employee.employeeId}), Period: ${report.monthName}`
  );

  const reportingConfig = await getGlobalReportingSettings();
  const includePhotos = reportingConfig.includePhotosInExports !== false;
  const includeGps = reportingConfig.includeGpsInExports !== false;
  const showOrgHeader = reportingConfig.pdfSettings?.showOrgHeader !== false;

  // 1. Preload and fetch real image bytes & video metadata for all report attachments
  const daysWithAttachments = includePhotos
    ? report.days.filter((d) => Array.isArray(d.attachments) && d.attachments.length > 0)
    : [];

  const dayMediaGroups: DayMediaGroup[] = [];
  for (const day of daysWithAttachments) {
    if (!day.attachments) continue;
    const items: FetchedAttachmentData[] = [];
    for (const att of day.attachments) {
      const data = await fetchAttachmentData(att, day.date);
      items.push(data);
    }
    if (items.length > 0) {
      dayMediaGroups.push({
        date: day.date,
        dayNumber: day.dayNumber,
        dayOfWeek: day.dayOfWeek,
        dailyActivity: day.dailyActivity,
        reportStatus: day.reportStatus,
        items,
      });
    }
  }

  // 2. Initialize jsPDF document (Landscape A4: 297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const greenPrimary = [22, 101, 52]; // #166534
  const slateDark = [15, 23, 42]; // #0f172a
  const slateMuted = [100, 116, 139]; // #64748b

  // Top Brand Header Banner
  doc.setFillColor(greenPrimary[0], greenPrimary[1], greenPrimary[2]);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MONTHLY EMPLOYEE FIELD ACTIVITY & LEAVE REPORT', 14, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const orgSub =
    showOrgHeader && reportingConfig.organization?.companyName
      ? `${reportingConfig.organization.companyName} • Reporting Period: ${report.monthName}`
      : `Reporting Period: ${report.monthName} • Official Verified Submission`;
  doc.text(orgSub, 14, 17.5);
  doc.text(`Generated (IST): ${formatDateTimeIST(report.generatedAt)}`, 283, 17.5, { align: 'right' });

  // Employee Information Box
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Employee: ${report.employee.fullName} (${report.employee.employeeId})`, 14, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(`Department: ${report.employee.departmentName}`, 120, 31);
  doc.text(`Center: ${report.employee.centerName}`, 195, 31);
  doc.text(`Designation: ${report.employee.designation}`, 283, 31, { align: 'right' });

  // Summary Metrics Table (clean wrapping metrics strip)
  const statsAny = report.stats as any;
  autoTable(doc, {
    startY: 35,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [
      [
        'Calendar Days',
        'Attended',
        'Days w/ Act.',
        'Activities (Done/Tot)',
        'Active Hrs',
        'Work Hrs',
        'Approved',
        'Corrections Req.',
        'Leaves',
        'Missing',
        'Farmer Contacts (M / F)',
      ],
    ],
    headStyles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] },
    body: [
      [
        String(report.stats.totalCalendarDays),
        String(statsAny.daysAttended ?? statsAny.presentDays ?? 0),
        String(statsAny.daysWithActivities ?? 0),
        `${statsAny.completedActivities ?? 0} / ${statsAny.totalActivities ?? report.stats.submittedReportDays}`,
        `${statsAny.totalActivityDuration ?? 0}h`,
        `${statsAny.totalWorkingPeriod ?? 0}h`,
        String(report.stats.approvedReportDays),
        String(statsAny.daysRequiringCorrection ?? 0),
        String(report.stats.approvedLeaveDays),
        String(report.stats.missingReportDays),
        `${statsAny.totalFarmerContacts ?? report.stats.totalFarmersVisited ?? 0} (M:${statsAny.maleParticipants ?? 0} / F:${statsAny.femaleParticipants ?? 0})`,
      ],
    ],
  });

  // 3. Daily Calendar Attendance, Leave & Overview Table
  const tableHeaders = [
    ['Date', 'Day', 'Attendance & Locations (IST)', 'Field Activities Summary', 'Dur', 'Pts (M/F)', 'Status', 'Review & Remarks'],
  ];

  const tableRows = report.days.map((d: any) => {
    let attendanceText = 'Absent';
    if (d.attendanceStatus === 'Present' || d.attendanceStatus === 'Active' || d.loginTime !== '—') {
      const inLoc = d.loginLocationName && d.loginLocationName !== 'Location unavailable' ? ` (${d.loginLocationName})` : '';
      const outLoc = d.logoutLocationName && d.logoutLocationName !== 'Location unavailable' ? ` (${d.logoutLocationName})` : '';
      attendanceText = `In: ${d.loginTime || '—'}${inLoc}\nOut: ${d.logoutTime || '—'}${outLoc}`;
    } else if (d.reportStatus === 'On Leave') {
      attendanceText = `On Leave (${d.leaveType || 'Leave'})`;
    } else if (d.reportStatus === 'Holiday') {
      attendanceText = 'Official Holiday';
    } else if (d.reportStatus === 'Weekly Off') {
      attendanceText = 'Weekly Off';
    }

    const metaParts: string[] = [];
    if (d.crpCode) metaParts.push(`CRP: ${d.crpCode}`);
    if (d.blockTaluka) metaParts.push(`Block: ${d.blockTaluka}`);
    if (d.reviewStatus && d.reviewStatus !== '—') metaParts.push(`Review: ${d.reviewStatus}`);
    if (d.remarks && d.remarks !== '—') metaParts.push(`Remarks: ${d.remarks}`);
    if (d.attachments && d.attachments.length > 0) {
      const photos = d.attachments.filter((a: any) => !a.mimeType?.startsWith('video/')).length;
      const videos = d.attachments.filter((a: any) => a.mimeType?.startsWith('video/')).length;
      metaParts.push(`[Media: ${photos} photo(s), ${videos} video(s)]`);
    }

    const durationText =
      d.activityDurationMinutes > 0
        ? `${Math.floor(d.activityDurationMinutes / 60)}h ${d.activityDurationMinutes % 60}m`
        : '—';
    const totalPts = d.participantCount || d.farmersVisited || 0;
    const ptsText = totalPts > 0 ? `${totalPts}\n(${d.maleParticipants || 0}/${d.femaleParticipants || 0})` : '0';

    return [
      d.date,
      d.dayOfWeek.slice(0, 3),
      attendanceText,
      d.dailyActivity,
      durationText,
      ptsText,
      d.reportStatus,
      metaParts.length > 0 ? metaParts.join('\n') : '—',
    ];
  });

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 50) + 4,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 249],
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 11 },
      2: { cellWidth: 46 },
      3: { cellWidth: 78 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 23, fontStyle: 'bold' },
      7: { cellWidth: 60 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw);
        if (val === 'Approved') {
          data.cell.styles.textColor = [22, 101, 52];
        } else if (val === 'On Leave') {
          data.cell.styles.textColor = [126, 34, 206];
        } else if (val === 'Missing' || val.includes('Missing')) {
          data.cell.styles.textColor = [180, 83, 9];
        } else if (val.includes('Correction') || val === 'Rejected') {
          data.cell.styles.textColor = [190, 18, 60];
        } else if (val === 'Submitted' || val === 'Under Review' || val === 'In Progress') {
          data.cell.styles.textColor = [3, 105, 161];
        }
      }
    },
    margin: { top: 20, right: 14, bottom: 15, left: 14 },
  });

  // 4. Complete Day-by-Day & Activity-by-Activity Field Details (ZERO truncation)
  const daysWithDetailedActivities = report.days.filter(
    (d: any) => Array.isArray(d.activitiesList) && d.activitiesList.length > 0
  );

  if (daysWithDetailedActivities.length > 0) {
    doc.addPage();
    doc.setFillColor(greenPrimary[0], greenPrimary[1], greenPrimary[2]);
    doc.rect(0, 0, 297, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('MONTHLY REPORT — COMPLETE DAY-BY-DAY FIELD ACTIVITY DETAILS', 14, 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Employee: ${report.employee.fullName} (${report.employee.employeeId}) | Department: ${report.employee.departmentName} | Reporting Month: ${report.monthName}`,
      14,
      15
    );

    const activityRows: string[][] = [];
    for (const day of daysWithDetailedActivities as any[]) {
      for (const act of day.activitiesList) {
        const dateSlotCol = [
          `${day.date} (${day.dayOfWeek.slice(0, 3)})`,
          `Slot #${act.slotNumber}`,
          `Slot: ${act.activityStatus || 'Completed'}`,
          `Report: ${day.reportStatus}`,
          day.crpCode ? `CRP: ${day.crpCode}` : '',
          day.blockTaluka ? `Block: ${day.blockTaluka}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const activityLocCol = [
          `${act.activityNameLabel || act.activityName}`,
          act.activityOther ? `Specified: ${act.activityOther}` : '',
          `Category: ${act.activityType || 'Field'}`,
          `Village: ${act.village || '—'}`,
          `Wadi: ${act.wadi || '—'}`,
          `Time (IST): ${act.startTime || '—'} - ${act.endTime || '—'}`,
          `Duration: ${act.durationMinutes || 0} mins`,
        ]
          .filter(Boolean)
          .join('\n');

        const participantCol = [
          `Farmer / Lead: ${act.farmerName || '—'}`,
          act.groupDetails ? `Group Details: ${act.groupDetails}` : '',
          `Total: ${act.participants ?? 0}`,
          `Male: ${act.maleParticipants ?? 0} | Female: ${act.femaleParticipants ?? 0}`,
        ]
          .filter(Boolean)
          .join('\n');

        const supportStr =
          Array.isArray(act.supportProvided) && act.supportProvided.length > 0
            ? act.supportProvided.join(', ')
            : 'None';
        const followUpStr = act.followUpRequired
          ? `Yes${act.followUpDate ? ` (${act.followUpDate})` : ''}: ${act.followUpDetails || 'Required'}`
          : 'No';

        const narrativeCol = [
          `Observations: ${act.observations || '—'}`,
          `Farmer Issues: ${act.issues || 'None reported'}`,
          `Support Provided: ${supportStr}`,
          act.supportOther ? `Other Support: ${act.supportOther}` : '',
          `Follow-up: ${followUpStr}`,
        ]
          .filter(Boolean)
          .join('\n');

        const gpsCol = [
          `Start: ${formatGpsText(act.startLocation, includeGps) || act.startLocationName || 'Location unavailable'}`,
          `End: ${formatGpsText(act.endLocation, includeGps) || act.endLocationName || 'Location unavailable'}`,
        ].join('\n\n');

        const photos = Array.isArray(act.photoUrls) ? act.photoUrls : [];
        const videos = Array.isArray(act.videoUrls) ? act.videoUrls : [];
        const mediaReviewCol = [
          photos.length > 0 ? `Photos:\n${photos.join('\n')}` : 'Photos: None',
          videos.length > 0 ? `Videos:\n${videos.join('\n')}` : 'Videos: None',
          day.reviewerName ? `Reviewer: ${day.reviewerName}` : '',
          day.remarks && day.remarks !== '—' ? `Remarks: ${day.remarks}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        activityRows.push([
          dateSlotCol,
          activityLocCol,
          participantCol,
          narrativeCol,
          gpsCol,
          mediaReviewCol,
        ]);
      }
    }

    autoTable(doc, {
      startY: 22,
      head: [
        [
          'Date & Slot',
          'Activity, Location & Time',
          'Farmer / Group & Counts',
          'Full Observations, Issues, Support & Follow-up',
          'Start & End GPS Locations',
          'Photo/Video URLs & Review',
        ],
      ],
      body: activityRows,
      theme: 'grid',
      margin: { top: 22, right: 14, bottom: 15, left: 14 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 7.2 },
      styles: { fontSize: 6.8, cellPadding: 2, overflow: 'linebreak', valign: 'top', textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 249] },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 78 },
        4: { cellWidth: 44 },
        5: { cellWidth: 55 },
      },
    });
  }

  // 5. Daily Photo & Video Evidence Gallery
  if (dayMediaGroups.length > 0) {
    const drawEvidencePageHeader = () => {
      doc.setFillColor(greenPrimary[0], greenPrimary[1], greenPrimary[2]);
      doc.rect(0, 0, 297, 18, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('MONTHLY REPORT — PHOTO & VIDEO EVIDENCE', 14, 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `Employee: ${report.employee.fullName} (${report.employee.employeeId}) | Department: ${report.employee.departmentName} | Reporting Month: ${report.monthName}`,
        14,
        15
      );
    };

    doc.addPage();
    drawEvidencePageHeader();

    let currentY = 23;
    const cardW = 84;
    const cardH = 66;
    const gapX = 8.5;
    const gapY = 5;

    for (const group of dayMediaGroups) {
      const wrappedSummaryLines = doc.splitTextToSize(`Activities: ${group.dailyActivity}`, 261) as string[];
      const headerBoxH = 8 + wrappedSummaryLines.length * 3.8;

      if (currentY + headerBoxH + 10 > 192) {
        doc.addPage();
        drawEvidencePageHeader();
        currentY = 23;
      }

      doc.setFillColor(236, 253, 245);
      doc.roundedRect(14, currentY, 269, headerBoxH, 1.5, 1.5, 'F');
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(14, currentY, 269, headerBoxH, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(22, 101, 52);
      doc.text(`Date: ${group.date} (${group.dayOfWeek}) — Status: ${group.reportStatus}`, 18, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedSummaryLines, 18, currentY + 9.5);

      currentY += headerBoxH + 3;

      for (let i = 0; i < group.items.length; i += 3) {
        if (currentY + cardH > 192) {
          doc.addPage();
          drawEvidencePageHeader();
          currentY = 23;
        }

        const rowItems = group.items.slice(i, i + 3);

        rowItems.forEach((item, colIndex) => {
          const itemX = 14 + colIndex * (cardW + gapX);
          const itemY = currentY;

          doc.setFillColor(248, 250, 249);
          doc.roundedRect(itemX, itemY, cardW, cardH, 2, 2, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(itemX, itemY, cardW, cardH, 2, 2, 'S');

          if (!item.isVideo && !item.isUnavailable && item.base64DataUrl) {
            const maxImgW = 80;
            const maxImgH = 42;
            const aspect = item.aspectRatio || 4 / 3;

            let drawW = maxImgW;
            let drawH = drawW / aspect;
            if (drawH > maxImgH) {
              drawH = maxImgH;
              drawW = drawH * aspect;
            }

            const imgX = itemX + (cardW - drawW) / 2;
            const imgY = itemY + 2 + (maxImgH - drawH) / 2;

            try {
              doc.addImage(item.base64DataUrl, item.format || 'JPEG', imgX, imgY, drawW, drawH, undefined, 'FAST');
            } catch {
              doc.setFontSize(7.5);
              doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
              doc.text('[Image preview unavailable]', itemX + cardW / 2, itemY + 22, { align: 'center' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(15, 23, 42);
            const capLines = doc.splitTextToSize(item.caption || item.originalFilename, cardW - 6) as string[];
            doc.text(capLines.slice(0, 2), itemX + 3, itemY + 48);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.8);
            doc.setTextColor(100, 116, 139);
            const fileLines = doc.splitTextToSize(item.originalFilename, cardW - 6) as string[];
            doc.text(fileLines.slice(0, 2), itemX + 3, itemY + 56.5);
          } else if (item.isVideo) {
            doc.setFillColor(238, 242, 255);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 42, 1.5, 1.5, 'F');
            doc.setDrawColor(199, 210, 254);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 42, 1.5, 1.5, 'S');

            doc.setTextColor(79, 70, 229);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('[VIDEO ATTACHMENT]', itemX + cardW / 2, itemY + 13, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.8);
            doc.setTextColor(30, 41, 59);
            const nameLines = doc.splitTextToSize(item.originalFilename, cardW - 10) as string[];
            doc.text(nameLines.slice(0, 2), itemX + cardW / 2, itemY + 20, { align: 'center' });

            const sizeMb = item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Recorded';
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(6.2);
            doc.text(`Size: ${sizeMb}`, itemX + cardW / 2, itemY + 30, { align: 'center' });

            if (item.downloadUrl) {
              const urlLines = doc.splitTextToSize(item.downloadUrl, cardW - 6) as string[];
              doc.text(urlLines.slice(0, 3), itemX + 3, itemY + 48);
            } else if (item.caption) {
              const vCapLines = doc.splitTextToSize(item.caption, cardW - 6) as string[];
              doc.text(vCapLines.slice(0, 2), itemX + 3, itemY + 49);
            }
          } else {
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 42, 1.5, 1.5, 'F');

            doc.setTextColor(217, 119, 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.2);
            doc.text('[PHOTO FILE REFERENCE]', itemX + cardW / 2, itemY + 15, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            const uNameLines = doc.splitTextToSize(item.originalFilename, cardW - 8) as string[];
            doc.text(uNameLines.slice(0, 2), itemX + cardW / 2, itemY + 23, { align: 'center' });

            if (item.downloadUrl) {
              const uUrlLines = doc.splitTextToSize(item.downloadUrl, cardW - 6) as string[];
              doc.text(uUrlLines.slice(0, 3), itemX + 3, itemY + 48);
            }
          }
        });

        currentY += cardH + gapY;
      }

      currentY += 3;
    }
  }

  // Consistent page numbering across all generated pages
  const footerBanner =
    reportingConfig.pdfSettings?.footerText || 'Confidential Staff Activity Record';
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(`Page ${p} of ${totalPages} | ${footerBanner}`, 14, 203);
  }

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(arrayBuffer);
  console.log(
    `[Monthly PDF Export] Completed PDF generation! Total pages: ${totalPages}, Size: ${pdfBuffer.length} bytes.`
  );
  return pdfBuffer;
}
