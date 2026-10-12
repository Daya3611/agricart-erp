import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyReportSummary } from '@/types';
import { fetchAttachmentData, FetchedAttachmentData } from './attachment-fetcher';

interface DayMediaGroup {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  dailyActivity: string;
  reportStatus: string;
  items: FetchedAttachmentData[];
}

/**
 * Deterministically generates a monthly activity report PDF on the server
 * with embedded real photos downloaded directly from Firebase Storage or local disk.
 */
export async function generateMonthlyReportPDF(report: MonthlyReportSummary): Promise<Buffer> {
  console.log(`[Monthly PDF Export] Initiating server-side PDF generation for ${report.employee.fullName} (${report.employee.employeeId}), Period: ${report.monthName}`);

  // 1. Preload and fetch real image bytes for all report attachments
  const daysWithAttachments = report.days.filter(
    (d) => Array.isArray(d.attachments) && d.attachments.length > 0
  );

  console.log(`[Monthly PDF Export] Days with evidence attachments: ${daysWithAttachments.length}`);

  const dayMediaGroups: DayMediaGroup[] = [];
  let successfullyEmbeddedCount = 0;
  let unavailableCount = 0;
  let videoCount = 0;

  for (const day of daysWithAttachments) {
    if (!day.attachments) continue;
    const items: FetchedAttachmentData[] = [];
    for (const att of day.attachments) {
      const data = await fetchAttachmentData(att, day.date);
      items.push(data);
      if (data.isVideo) videoCount++;
      else if (data.isUnavailable) unavailableCount++;
      else if (data.base64DataUrl) successfullyEmbeddedCount++;
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

  console.log(
    `[Monthly PDF Export] Attachments preloaded: ${successfullyEmbeddedCount} photos ready, ${videoCount} videos, ${unavailableCount} unavailable.`
  );

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
  doc.setFontSize(15);
  doc.text('AGRICART FARMERS PRODUCER COMPANY LTD', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Monthly Employee Activity & Leave Report — ${report.monthName}`, 14, 18);

  const genDate = new Date(report.generatedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Generated: ${genDate}`, 245, 18);

  // Employee Information Box
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Information:', 14, 31);

  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${report.employee.fullName}`, 14, 36);
  doc.text(`Employee ID: ${report.employee.employeeId}`, 70, 36);
  doc.text(`Department: ${report.employee.departmentName}`, 130, 36);
  doc.text(`Center: ${report.employee.centerName}`, 190, 36);
  doc.text(`Designation: ${report.employee.designation}`, 240, 36);

  // Summary Metrics Bar
  doc.setFillColor(248, 250, 248);
  doc.roundedRect(14, 40, 269, 14, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 40, 269, 14, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(`Calendar Days: ${report.stats.totalCalendarDays}`, 20, 48.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`Submitted Reports: ${report.stats.submittedReportDays}`, 65, 48.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`Approved Reports: ${report.stats.approvedReportDays}`, 120, 48.5);
  doc.setTextColor(147, 51, 234);
  doc.text(`Approved Leaves: ${report.stats.approvedLeaveDays}`, 175, 48.5);
  doc.setTextColor(217, 119, 6);
  doc.text(`Missing Days: ${report.stats.missingReportDays}`, 230, 48.5);

  // Daily Activity Table Data
  const tableHeaders = [
    ['Date', 'Day', 'Daily Activity Summary', 'Report Status', 'Time', 'Review Status', 'Remarks & Evidence'],
  ];

  const tableRows = report.days.map((d) => {
    let remarksText = d.remarks;
    if (d.attachments && d.attachments.length > 0) {
      const photos = d.attachments.filter((a) => !a.mimeType?.startsWith('video/')).length;
      const videos = d.attachments.filter((a) => a.mimeType?.startsWith('video/')).length;
      const tag = `[Evidence: ${photos} photo${photos === 1 ? '' : 's'}${videos > 0 ? `, ${videos} video${videos === 1 ? '' : 's'}` : ''}]`;
      remarksText = remarksText === '—' ? tag : `${remarksText}\n${tag}`;
    }

    return [
      d.date,
      d.dayOfWeek.slice(0, 3),
      d.dailyActivity,
      d.reportStatus,
      d.submissionTime,
      d.reviewStatus,
      remarksText,
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
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
      0: { cellWidth: 22, fontStyle: 'bold' }, // Date
      1: { cellWidth: 14 }, // Day
      2: { cellWidth: 102 }, // Activity summary
      3: { cellWidth: 28, fontStyle: 'bold' }, // Status
      4: { cellWidth: 18 }, // Time
      5: { cellWidth: 38 }, // Review
      6: { cellWidth: 47 }, // Remarks & Evidence
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw);
        if (val === 'Approved') {
          data.cell.styles.textColor = [22, 101, 52];
        } else if (val === 'On Leave') {
          data.cell.styles.textColor = [126, 34, 206];
        } else if (val === 'Missing') {
          data.cell.styles.textColor = [180, 83, 9];
        } else if (val === 'Correction Requested') {
          data.cell.styles.textColor = [190, 18, 60];
        } else if (val === 'Submitted' || val === 'Under Review') {
          data.cell.styles.textColor = [3, 105, 161];
        }
      }
    },
    margin: { top: 20, right: 14, bottom: 15, left: 14 },
  });

  // =========================================================================
  // 3. Daily Photo Evidence Section (Appears after Table)
  // =========================================================================
  if (dayMediaGroups.length > 0) {
    const drawEvidencePageHeader = () => {
      doc.setFillColor(greenPrimary[0], greenPrimary[1], greenPrimary[2]);
      doc.rect(0, 0, 297, 18, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('AGRICART FARMERS PRODUCER COMPANY LTD — DAILY PHOTO EVIDENCE', 14, 9.5);

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

    let currentY = 24;
    const cardW = 84;
    const cardH = 58;
    const gapX = 8.5;
    const gapY = 5;

    for (const group of dayMediaGroups) {
      // Check if day header fits on page
      if (currentY + 12 > 192) {
        doc.addPage();
        drawEvidencePageHeader();
        currentY = 24;
      }

      // Day Header Box
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(14, currentY, 269, 8.5, 1.5, 1.5, 'F');
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(14, currentY, 269, 8.5, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(22, 101, 52);
      doc.text(
        `Date: ${group.date} (${group.dayOfWeek}) — Status: ${group.reportStatus}`,
        18,
        currentY + 5.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const activitySnippet =
        group.dailyActivity.length > 95
          ? group.dailyActivity.slice(0, 92) + '...'
          : group.dailyActivity;
      doc.text(activitySnippet, 130, currentY + 5.5);

      currentY += 11;

      // Group items into rows of 3
      for (let i = 0; i < group.items.length; i += 3) {
        if (currentY + cardH > 192) {
          doc.addPage();
          drawEvidencePageHeader();
          currentY = 24;
        }

        const rowItems = group.items.slice(i, i + 3);

        rowItems.forEach((item, colIndex) => {
          const itemX = 14 + colIndex * (cardW + gapX);
          const itemY = currentY;

          // Card Background
          doc.setFillColor(248, 250, 249);
          doc.roundedRect(itemX, itemY, cardW, cardH, 2, 2, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(itemX, itemY, cardW, cardH, 2, 2, 'S');

          if (!item.isVideo && !item.isUnavailable && item.base64DataUrl) {
            // Photo card with EMBEDDED REAL IMAGE
            const maxImgW = 80;
            const maxImgH = 43;
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
              console.log(
                `[Monthly PDF Export] Embedded image ${item.originalFilename} on page ${doc.getNumberOfPages()} at (${imgX.toFixed(1)}, ${imgY.toFixed(1)})`
              );
            } catch (err: any) {
              console.error(`[Monthly PDF Export] addImage failed for ${item.originalFilename}:`, err.message);
              doc.setFontSize(7.5);
              doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
              doc.text('[Image rendering fallback]', itemX + cardW / 2, itemY + 24, {
                align: 'center',
              });
            }

            // Caption & Filename text below photo
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(15, 23, 42);
            const captionText = item.caption
              ? item.caption.length > 45
                ? item.caption.slice(0, 42) + '...'
                : item.caption
              : item.originalFilename;
            doc.text(captionText, itemX + 3, itemY + 49);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(100, 116, 139);
            const cleanFilename =
              item.originalFilename.length > 45
                ? item.originalFilename.slice(0, 42) + '...'
                : item.originalFilename;
            doc.text(cleanFilename, itemX + 3, itemY + 54);
          } else if (item.isVideo) {
            // Video placeholder card
            doc.setFillColor(238, 242, 255);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 43, 1.5, 1.5, 'F');
            doc.setDrawColor(199, 210, 254);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 43, 1.5, 1.5, 'S');

            doc.setTextColor(79, 70, 229);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('[VIDEO ATTACHMENT]', itemX + cardW / 2, itemY + 16, {
              align: 'center',
            });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(30, 41, 59);
            const vName =
              item.originalFilename.length > 36
                ? item.originalFilename.slice(0, 33) + '...'
                : item.originalFilename;
            doc.text(vName, itemX + cardW / 2, itemY + 23, { align: 'center' });

            const sizeMb = item.fileSize
              ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB`
              : 'Recorded';
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(6.5);
            doc.text(`File Size: ${sizeMb}`, itemX + cardW / 2, itemY + 29, {
              align: 'center',
            });
            doc.text('Securely archived in Agricart ERP', itemX + cardW / 2, itemY + 36, {
              align: 'center',
            });

            if (item.caption) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.5);
              doc.setTextColor(15, 23, 42);
              const vCaption =
                item.caption.length > 45 ? item.caption.slice(0, 42) + '...' : item.caption;
              doc.text(`Caption: ${vCaption}`, itemX + 3, itemY + 53);
            }
          } else {
            // Unavailable image card
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(itemX + 2, itemY + 2, cardW - 4, 43, 1.5, 1.5, 'F');

            doc.setTextColor(217, 119, 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text('[PHOTO UNAVAILABLE]', itemX + cardW / 2, itemY + 17, {
              align: 'center',
            });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            const uName =
              item.originalFilename.length > 36
                ? item.originalFilename.slice(0, 33) + '...'
                : item.originalFilename;
            doc.text(uName, itemX + cardW / 2, itemY + 25, { align: 'center' });
            doc.text('Archived in Agricart ERP storage', itemX + cardW / 2, itemY + 32, {
              align: 'center',
            });

            if (item.caption) {
              doc.setFontSize(6.5);
              doc.setTextColor(15, 23, 42);
              const uCaption =
                item.caption.length > 45 ? item.caption.slice(0, 42) + '...' : item.caption;
              doc.text(`Caption: ${uCaption}`, itemX + 3, itemY + 53);
            }
          }
        });

        currentY += cardH + gapY;
      }

      currentY += 3;
    }
  }

  // Consistent page numbering across all generated pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      `Page ${p} of ${totalPages} | Agricart Farmers Producer Company Ltd`,
      14,
      202
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(arrayBuffer);
  console.log(`[Monthly PDF Export] Completed PDF generation! Total pages: ${totalPages}, Size: ${pdfBuffer.length} bytes.`);
  return pdfBuffer;
}
