import { MonthlyReportSummary } from '@/types';

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
 * Exports Monthly Activity Report to a structured, professional PDF document.
 */
export async function exportMonthlyReportToPDF(report: MonthlyReportSummary) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule;

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
    ['Date', 'Day', 'Daily Activity Summary', 'Report Status', 'Time', 'Review Status', 'Remarks'],
  ];

  const tableRows = report.days.map((d) => [
    d.date,
    d.dayOfWeek.slice(0, 3),
    d.dailyActivity,
    d.reportStatus,
    d.submissionTime,
    d.reviewStatus,
    d.remarks,
  ]);

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
      2: { cellWidth: 105 }, // Activity summary (wide)
      3: { cellWidth: 28, fontStyle: 'bold' }, // Status
      4: { cellWidth: 18 }, // Time
      5: { cellWidth: 38 }, // Review
      6: { cellWidth: 44 }, // Remarks
    },
    didParseCell: (data) => {
      // Custom color badges for status column
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
        } else if (val === 'Submitted') {
          data.cell.styles.textColor = [3, 105, 161];
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | Agricart Farmers Producer Company Ltd`,
        14,
        202
      );
    },
    margin: { top: 20, right: 14, bottom: 15, left: 14 },
  });

  const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Agricart_Monthly_Report_${cleanEmpId}_${report.year}-${String(report.month).padStart(2, '0')}.pdf`;
  doc.save(filename);
}

/**
 * Exports Monthly Activity Report to a native Microsoft Word (.docx) file.
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
    WidthType,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    ShadingType,
  } = await import('docx');

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
    text: 'AGRICART FARMERS PRODUCER COMPANY LTD',
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
                  new TextRun({ text: String(report.stats.submittedReportDays), bold: true, size: 26, color: '166534' }),
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
                  new TextRun({ text: String(report.stats.approvedReportDays), bold: true, size: 26, color: '059669' }),
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
                  new TextRun({ text: String(report.stats.approvedLeaveDays), bold: true, size: 26, color: '7E22CE' }),
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
                  new TextRun({ text: String(report.stats.missingReportDays), bold: true, size: 26, color: 'D97706' }),
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
        width: { size: 40, type: WidthType.PERCENTAGE },
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
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Remarks', bold: true, color: 'FFFFFF', size: 17 })] })],
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
          children: [new Paragraph({ children: [new TextRun({ text: d.remarks, size: 16 })] })],
        }),
      ],
    });
  });

  const mainActivityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderLight,
    rows: [tableHeaderRow, ...dailyRows],
  });

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
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Agricart_Monthly_Report_${cleanEmpId}_${report.year}-${String(report.month).padStart(2, '0')}.docx`;
  triggerBrowserDownload(blob, filename);
}
