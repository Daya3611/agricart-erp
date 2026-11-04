import {
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
} from 'docx';
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
 * Server-side Microsoft Word (.docx) generator with embedded real photos.
 */
export async function generateMonthlyReportDOCX(report: MonthlyReportSummary): Promise<Buffer> {
  console.log(`[Monthly DOCX Export] Initiating DOCX generation for ${report.employee.fullName}`);

  // 1. Preload attachments
  const daysWithAttachments = report.days.filter(
    (d) => Array.isArray(d.attachments) && d.attachments.length > 0
  );

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
        size: 24,
        color: '166534',
      }),
      new TextRun({
        text: `   (Generated: ${new Date(report.generatedAt).toLocaleDateString('en-IN')})`,
        size: 18,
        color: '64748B',
      }),
    ],
    spacing: { after: 200 },
  });

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

  const dailyRows = report.days.map((d, index) => {
    const isEven = index % 2 === 0;
    const bgFill = isEven ? 'FFFFFF' : 'F8FAF9';

    let statusColor = '0F172A';
    if (d.reportStatus === 'Approved') statusColor = '166534';
    else if (d.reportStatus === 'On Leave') statusColor = '7E22CE';
    else if (d.reportStatus === 'Missing') statusColor = 'D97706';
    else if (d.reportStatus === 'Correction Requested') statusColor = 'BE123C';

    const remarksParagraphs = [
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
        if (!item.isVideo && !item.isUnavailable && item.buffer) {
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
                  type: item.format === 'PNG' ? 'png' : 'jpg',
                  data: new Uint8Array(item.buffer),
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
              top: 720,
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

  const docxBuffer = await Packer.toBuffer(doc);
  console.log(`[Monthly DOCX Export] Completed DOCX generation! Size: ${docxBuffer.length} bytes.`);
  return docxBuffer;
}
