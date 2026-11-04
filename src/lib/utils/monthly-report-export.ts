import { MonthlyReportSummary, ReportAttachment } from '@/types';

/**
 * Downloads a Blob as a file in the browser.
 */
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Returns the authorized server-side access URL for an attachment.
 * Prioritizes the same-origin `/api/uploads/view?path=...` endpoint which enforces
 * role-based security and avoids cross-origin CORS taint during canvas manipulation.
 */
function getAttachmentFetchUrl(att: ReportAttachment): string {
  if (att.storagePath) {
    if (
      att.storagePath.startsWith('http://') ||
      att.storagePath.startsWith('https://') ||
      att.storagePath.startsWith('/')
    ) {
      return att.storagePath;
    }
    return `/api/uploads/view?path=${encodeURIComponent(att.storagePath)}`;
  }
  return att.downloadUrl || '';
}

export interface ProcessedMediaItem {
  id: string;
  reportDate: string;
  originalFilename: string;
  caption?: string;
  fileSize: number;
  uploadedAt: string;
  isVideo: boolean;
  isUnavailable: boolean;
  dataUrl?: string;
  bytes?: Uint8Array;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

/**
 * Concurrency helper to execute async tasks with a maximum pool limit.
 */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fetches an image, downscales it to prevent huge PDF/DOCX sizes,
 * and extracts both a JPEG dataUrl (for jsPDF) and a Uint8Array (for docx).
 */
async function loadAndOptimizeImage(
  att: ReportAttachment,
  reportDate: string,
  maxWidth = 900,
  maxHeight = 675
): Promise<ProcessedMediaItem> {
  const isVideo =
    att.mimeType?.startsWith('video/') ||
    ['.mp4', '.mov', '.webm', '.avi', '.mkv'].some((ext) =>
      att.originalFilename?.toLowerCase().endsWith(ext)
    );

  if (isVideo) {
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'video_attachment.mp4',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      isVideo: true,
      isUnavailable: false,
    };
  }

  const url = getAttachmentFetchUrl(att);
  if (!url) {
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'photo.jpg',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      isVideo: false,
      isUnavailable: true,
    };
  }

  try {
    // 8-second timeout per image to prevent stalled network requests from hanging the export
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        id: att.id,
        reportDate,
        originalFilename: att.originalFilename || 'photo.jpg',
        caption: att.caption,
        fileSize: att.fileSize || 0,
        uploadedAt: att.uploadedAt || new Date().toISOString(),
        isVideo: false,
        isUnavailable: true,
      };
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise<ProcessedMediaItem>((resolve) => {
      const img = new Image();
      img.onload = () => {
        let naturalWidth = img.naturalWidth || img.width || 400;
        let naturalHeight = img.naturalHeight || img.height || 300;
        const aspectRatio = naturalWidth / naturalHeight;

        let drawWidth = naturalWidth;
        let drawHeight = naturalHeight;

        if (drawWidth > maxWidth) {
          drawHeight = Math.round(drawHeight * (maxWidth / drawWidth));
          drawWidth = maxWidth;
        }
        if (drawHeight > maxHeight) {
          drawWidth = Math.round(drawWidth * (maxHeight / drawHeight));
          drawHeight = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({
            id: att.id,
            reportDate,
            originalFilename: att.originalFilename,
            caption: att.caption,
            fileSize: att.fileSize,
            uploadedAt: att.uploadedAt,
            isVideo: false,
            isUnavailable: true,
          });
          return;
        }

        // Fill clean white background before drawing (supports transparent PNGs & SVGs)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, drawWidth, drawHeight);
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
        URL.revokeObjectURL(objectUrl);

        // Compress to 82% quality JPEG to keep total document size modest (~70KB per photo)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64Data = dataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        resolve({
          id: att.id,
          reportDate,
          originalFilename: att.originalFilename,
          caption: att.caption,
          fileSize: att.fileSize,
          uploadedAt: att.uploadedAt,
          isVideo: false,
          isUnavailable: false,
          dataUrl,
          bytes,
          width: drawWidth,
          height: drawHeight,
          aspectRatio,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          id: att.id,
          reportDate,
          originalFilename: att.originalFilename,
          caption: att.caption,
          fileSize: att.fileSize,
          uploadedAt: att.uploadedAt,
          isVideo: false,
          isUnavailable: true,
        });
      };

      img.src = objectUrl;
    });
  } catch {
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename,
      caption: att.caption,
      fileSize: att.fileSize,
      uploadedAt: att.uploadedAt,
      isVideo: false,
      isUnavailable: true,
    };
  }
}

interface DayMediaGroup {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  dailyActivity: string;
  reportStatus: string;
  items: ProcessedMediaItem[];
}

/**
 * Preloads and organizes all attachments grouped by day with caching and concurrency control.
 */
async function preloadReportMedia(report: MonthlyReportSummary): Promise<DayMediaGroup[]> {
  const daysWithAttachments = report.days.filter(
    (d) => Array.isArray(d.attachments) && d.attachments.length > 0
  );

  if (daysWithAttachments.length === 0) return [];

  // Limit total photos embedded to 45 to protect against memory exhaustion
  const MAX_PHOTOS_LIMIT = 45;
  let totalPhotosEncountered = 0;

  const cache = new Map<string, ProcessedMediaItem>();
  const tasks: Array<{ day: typeof daysWithAttachments[0]; att: ReportAttachment }> = [];

  for (const day of daysWithAttachments) {
    if (!day.attachments) continue;
    for (const att of day.attachments) {
      const isVideo =
        att.mimeType?.startsWith('video/') ||
        ['.mp4', '.mov', '.webm', '.avi', '.mkv'].some((ext) =>
          att.originalFilename?.toLowerCase().endsWith(ext)
        );

      if (!isVideo) {
        if (totalPhotosEncountered >= MAX_PHOTOS_LIMIT) continue;
        totalPhotosEncountered++;
      }
      tasks.push({ day, att });
    }
  }

  // Fetch in pool of 4
  const loadedItems = await mapConcurrent(tasks, 4, async (task) => {
    const key = task.att.storagePath || task.att.id || task.att.downloadUrl || '';
    if (key && cache.has(key)) {
      const cached = cache.get(key)!;
      return { ...cached, reportDate: task.day.date };
    }
    const item = await loadAndOptimizeImage(task.att, task.day.date);
    if (key) cache.set(key, item);
    return item;
  });

  // Group items by date
  const dayGroupsMap = new Map<string, ProcessedMediaItem[]>();
  for (const item of loadedItems) {
    const existing = dayGroupsMap.get(item.reportDate) || [];
    existing.push(item);
    dayGroupsMap.set(item.reportDate, existing);
  }

  const result: DayMediaGroup[] = [];
  for (const day of daysWithAttachments) {
    const items = dayGroupsMap.get(day.date);
    if (items && items.length > 0) {
      result.push({
        date: day.date,
        dayNumber: day.dayNumber,
        dayOfWeek: day.dayOfWeek,
        dailyActivity: day.dailyActivity,
        reportStatus: day.reportStatus,
        items,
      });
    }
  }

  return result;
}

/**
 * Exports Monthly Activity Report to a structured, professional PDF document
 * with embedded photo evidence and media documentation.
 */
export async function exportMonthlyReportToPDF(report: MonthlyReportSummary) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

  // Preload and optimize photos first
  const dayMediaGroups = await preloadReportMedia(report);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
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
  doc.text('MONTHLY EMPLOYEE ACTIVITY & LEAVE REPORT', 14, 11);

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
      const tag = `[📷 ${photos} photo${photos === 1 ? '' : 's'}${videos > 0 ? `, 🎥 ${videos} video${videos === 1 ? '' : 's'}` : ''}]`;
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
  // Photo & Video Evidence Section
  // =========================================================================
  if (dayMediaGroups.length > 0) {
    const drawEvidencePageHeader = () => {
      doc.setFillColor(greenPrimary[0], greenPrimary[1], greenPrimary[2]);
      doc.rect(0, 0, 297, 18, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('MONTHLY EMPLOYEE ACTIVITY & LEAVE REPORT — DAILY WORK EVIDENCE', 14, 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `Employee: ${report.employee.fullName} (${report.employee.employeeId}) | Department: ${report.employee.departmentName} | Month: ${report.monthName}`,
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

          if (!item.isVideo && !item.isUnavailable && item.dataUrl) {
            // Photo card
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
              doc.addImage(item.dataUrl, 'JPEG', imgX, imgY, drawW, drawH);
            } catch {
              // Fallback text if rendering fails
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
            doc.text('🎥 Video Attachment', itemX + cardW / 2, itemY + 16, {
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
            doc.text('⚠️ Photo Unavailable', itemX + cardW / 2, itemY + 17, {
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

      currentY += 3; // spacing between days
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
      `Page ${p} of ${totalPages} | Confidential Staff Activity Record`,
      14,
      202
    );
  }

  const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Agricart_Monthly_Report_${cleanEmpId}_${report.year}-${String(report.month).padStart(2, '0')}.pdf`;
  doc.save(filename);
}

/**
 * Exports Monthly Activity Report to a native Microsoft Word (.docx) file
 * with embedded photo evidence and media documentation.
 */
export async function exportMonthlyReportToDOCX(report: MonthlyReportSummary) {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    ImageRun,
    WidthType,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    ShadingType,
  } = await import('docx');

  // Preload and optimize photos for DOCX embedding
  const dayMediaGroups = await preloadReportMedia(report);

  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const borderLight = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  };

  // 1. Header Paragraphs
  const titleParagraph = new Paragraph({
    text: 'MONTHLY EMPLOYEE ACTIVITY & LEAVE REPORT',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    spacing: { after: 120 },
  });

  const subtitleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: `Monthly Employee Activity & Leave Report — ${report.monthName}`,
        bold: true,
        size: 24, // 12pt
        color: '166534',
      }),
      new TextRun({
        text: `   (Generated: ${new Date(report.generatedAt).toLocaleDateString('en-IN')})`,
        size: 18, // 9pt
        color: '64748B',
      }),
    ],
    spacing: { after: 200 },
  });

  // 2. Employee Info Table
  const employeeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Employee Name: ', bold: true, size: 19 }),
                  new TextRun({ text: report.employee.fullName, size: 19 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Employee ID: ', bold: true, size: 19 }),
                  new TextRun({ text: report.employee.employeeId, size: 19 }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Department: ', bold: true, size: 19 }),
                  new TextRun({ text: report.employee.departmentName, size: 19 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Assigned Center: ', bold: true, size: 19 }),
                  new TextRun({ text: report.employee.centerName, size: 19 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3. Metrics Summary Table
  const metricsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderLight,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'F8FAF9' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Calendar Days\n', size: 16, color: '64748B' }),
                  new TextRun({ text: String(report.stats.totalCalendarDays), bold: true, size: 26 }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'F8FAF9' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Submitted Reports\n', size: 16, color: '166534' }),
                  new TextRun({
                    text: String(report.stats.submittedReportDays),
                    bold: true,
                    size: 26,
                    color: '166534',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'F8FAF9' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Approved Reports\n', size: 16, color: '059669' }),
                  new TextRun({
                    text: String(report.stats.approvedReportDays),
                    bold: true,
                    size: 26,
                    color: '059669',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'F8FAF9' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Approved Leaves\n', size: 16, color: '7E22CE' }),
                  new TextRun({
                    text: String(report.stats.approvedLeaveDays),
                    bold: true,
                    size: 26,
                    color: '7E22CE',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'F8FAF9' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Missing Reports\n', size: 16, color: 'D97706' }),
                  new TextRun({
                    text: String(report.stats.missingReportDays),
                    bold: true,
                    size: 26,
                    color: 'D97706',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 4. Activity Table Header Row
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Day', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Daily Activity Summary', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Time', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Review Status', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Remarks & Evidence', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
    ],
  });

  // Daily rows
  const dailyRows = report.days.map((d, index) => {
    const isEven = index % 2 === 0;
    const bgFill = isEven ? 'FFFFFF' : 'F8FAF9';

    let statusColor = '0F172A';
    if (d.reportStatus === 'Approved') statusColor = '166534';
    else if (d.reportStatus === 'On Leave') statusColor = '7E22CE';
    else if (d.reportStatus === 'Missing') statusColor = 'D97706';
    else if (d.reportStatus === 'Correction Requested') statusColor = 'BE123C';

    let remarksParagraphs = [
      new Paragraph({ children: [new TextRun({ text: d.remarks, size: 16 })] }),
    ];

    if (d.attachments && d.attachments.length > 0) {
      const photos = d.attachments.filter((a) => !a.mimeType?.startsWith('video/')).length;
      const videos = d.attachments.filter((a) => a.mimeType?.startsWith('video/')).length;
      remarksParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[📷 ${photos} photo${photos === 1 ? '' : 's'}${videos > 0 ? `, 🎥 ${videos} video${videos === 1 ? '' : 's'}` : ''}]`,
              size: 14,
              color: '166534',
              bold: true,
            }),
          ],
        })
      );
    }

    return new TableRow({
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.date, bold: true, size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.dayOfWeek.slice(0, 3), size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.dailyActivity, size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.reportStatus, bold: true, color: statusColor, size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.submissionTime, size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: [new Paragraph({ children: [new TextRun({ text: d.reviewStatus, size: 16 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: bgFill },
          children: remarksParagraphs,
        }),
      ],
    });
  });

  const mainActivityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderLight,
    rows: [tableHeaderRow, ...dailyRows],
  });

  // Evidence elements to append
  const evidenceChildren: any[] = [];

  if (dayMediaGroups.length > 0) {
    evidenceChildren.push(
      new Paragraph({ text: '', pageBreakBefore: true, spacing: { after: 120 } }),
      new Paragraph({
        text: 'MONTHLY EMPLOYEE ACTIVITY & LEAVE REPORT',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Daily Work Evidence & Photographic Verification — ${report.monthName}`,
            bold: true,
            size: 24,
            color: '166534',
          }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Official photographic field evidence and media documentation submitted by ${report.employee.fullName} (${report.employee.employeeId}) for activity verification during ${report.monthName}.`,
            size: 18,
            color: '64748B',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    for (const group of dayMediaGroups) {
      evidenceChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `📅 Date: ${group.date} (${group.dayOfWeek}) — Status: ${group.reportStatus}`,
              bold: true,
              size: 21,
              color: '166534',
            }),
          ],
          spacing: { before: 200, after: 60 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Daily Activity: ${group.dailyActivity}`,
              italics: true,
              size: 18,
              color: '334155',
            }),
          ],
          spacing: { after: 140 },
        })
      );

      for (const item of group.items) {
        if (!item.isVideo && !item.isUnavailable && item.bytes) {
          const targetWidth = 320;
          const targetHeight = Math.min(
            240,
            Math.round(targetWidth / (item.aspectRatio || 1.33))
          );

          evidenceChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 60 },
              children: [
                new ImageRun({
                  type: 'jpg',
                  data: item.bytes,
                  transformation: {
                    width: targetWidth,
                    height: targetHeight,
                  },
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: item.caption ? `"${item.caption}" ` : '',
                  bold: true,
                  size: 16,
                  color: '0F172A',
                }),
                new TextRun({
                  text: `(${item.originalFilename})`,
                  size: 15,
                  color: '64748B',
                }),
              ],
            })
          );
        } else if (item.isVideo) {
          const sizeMb = item.fileSize
            ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB`
            : 'Recorded';
          evidenceChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 120 },
              children: [
                new TextRun({
                  text: '🎥 Video Evidence: ',
                  bold: true,
                  size: 18,
                  color: '4338CA',
                }),
                new TextRun({
                  text: `${item.originalFilename} (${sizeMb})`,
                  size: 17,
                  color: '1E293B',
                }),
                new TextRun({
                  text: ' — Video file is securely archived in the Agricart ERP system and can be reviewed online.',
                  size: 16,
                  italics: true,
                  color: '64748B',
                }),
              ],
            })
          );
        } else {
          evidenceChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 120 },
              children: [
                new TextRun({
                  text: `⚠️ [Photo Attachment: ${item.originalFilename} — File securely preserved in Agricart ERP storage]`,
                  size: 16,
                  color: 'D97706',
                  italics: true,
                }),
              ],
            })
          );
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          titleParagraph,
          subtitleParagraph,
          employeeTable,
          new Paragraph({ text: '', spacing: { after: 120 } }),
          metricsTable,
          new Paragraph({ text: '', spacing: { after: 160 } }),
          mainActivityTable,
          ...evidenceChildren,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Agricart_Monthly_Report_${cleanEmpId}_${report.year}-${String(report.month).padStart(2, '0')}.docx`;
  triggerBrowserDownload(blob, filename);
}
