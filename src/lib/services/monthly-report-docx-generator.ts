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

/**
 * Server-side Microsoft Word (.docx) generator with complete untruncated field details and embedded real photos.
 */
export async function generateMonthlyReportDOCX(report: MonthlyReportSummary): Promise<Buffer> {
  console.log(`[Monthly DOCX Export] Initiating DOCX generation for ${report.employee.fullName}`);

  const reportingConfig = await getGlobalReportingSettings();
  const includePhotos = reportingConfig.includePhotosInExports !== false;

  // 1. Preload attachments
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
    text: reportingConfig.docxSettings?.headerTitle || 'MONTHLY FIELD ACTIVITY & ATTENDANCE REPORT',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    spacing: { after: 120 },
  });

  const subtitleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: `${report.monthName} — Complete Official Report`,
        bold: true,
        size: 24,
        color: '166534',
      }),
      new TextRun({
        text: `   (Generated IST: ${formatDateTimeIST(report.generatedAt)})`,
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

  const statsAny = report.stats as any;
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
                  new TextRun({ text: 'Calendar Days / Attended\n', size: 15, color: '64748B' }),
                  new TextRun({
                    text: `${report.stats.totalCalendarDays} / ${statsAny.daysAttended ?? 0}`,
                    bold: true,
                    size: 24,
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
                  new TextRun({ text: 'Activities (Done/Total)\n', size: 15, color: '166534' }),
                  new TextRun({
                    text: `${statsAny.completedActivities ?? 0} / ${statsAny.totalActivities ?? 0}`,
                    bold: true,
                    size: 24,
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
                  new TextRun({ text: 'Approved / Corrections\n', size: 15, color: '059669' }),
                  new TextRun({
                    text: `${report.stats.approvedReportDays} / ${statsAny.daysRequiringCorrection ?? 0}`,
                    bold: true,
                    size: 24,
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
                  new TextRun({ text: 'Leaves / Missing\n', size: 15, color: '7E22CE' }),
                  new TextRun({
                    text: `${report.stats.approvedLeaveDays} / ${report.stats.missingReportDays}`,
                    bold: true,
                    size: 24,
                    color: '7E22CE',
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
        children: [new Paragraph({ children: [new TextRun({ text: 'Time (IST)', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Review Status', bold: true, color: 'FFFFFF', size: 17 })] })],
      }),
      new TableCell({
        width: { size: 12, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: '166534' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Remarks & Media', bold: true, color: 'FFFFFF', size: 17 })] })],
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
              text: `[Photos: ${photos}, Videos: ${videos}]`,
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

  // Complete Day-by-Day Activity Details section (no truncation)
  const detailedActivityChildren: any[] = [];
  const daysWithActivities = report.days.filter(
    (d: any) => Array.isArray(d.activitiesList) && d.activitiesList.length > 0
  );

  if (daysWithActivities.length > 0) {
    detailedActivityChildren.push(
      new Paragraph({ text: '', pageBreakBefore: true, spacing: { after: 100 } }),
      new Paragraph({
        text: 'COMPLETE DAY-BY-DAY FIELD ACTIVITY DETAILS',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
      })
    );

    for (const day of daysWithActivities as any[]) {
      detailedActivityChildren.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              text: `${day.date} (${day.dayOfWeek}) — Status: ${day.reportStatus}${day.crpCode ? ` | CRP: ${day.crpCode}` : ''}${day.blockTaluka ? ` | Block: ${day.blockTaluka}` : ''}`,
              bold: true,
              size: 20,
              color: '166534',
            }),
          ],
        })
      );

      for (const act of day.activitiesList) {
        const supportList = Array.isArray(act.supportProvided) ? act.supportProvided.join(', ') : 'None';
        const lines = [
          `Slot #${act.slotNumber}: ${act.activityNameLabel || act.activityName}${act.activityOther ? ` (${act.activityOther})` : ''} | Category: ${act.activityType}`,
          `Village: ${act.village || '—'} | Wadi: ${act.wadi || '—'} | Timing (IST): ${act.startTime || '—'} - ${act.endTime || '—'} (${act.durationMinutes || 0} mins)`,
          `Farmer / Lead: ${act.farmerName || '—'} | Participants: ${act.participants ?? 0} (M: ${act.maleParticipants ?? 0}, F: ${act.femaleParticipants ?? 0})${act.groupDetails ? ` | Group Details: ${act.groupDetails}` : ''}`,
          `Observations: ${act.observations || '—'}`,
          `Farmer Issues: ${act.issues || 'None reported'}`,
          `Support Provided: ${supportList}${act.supportOther ? ` | Other: ${act.supportOther}` : ''}`,
          `Follow-up: ${act.followUpRequired ? `Yes${act.followUpDate ? ` (${act.followUpDate})` : ''} — ${act.followUpDetails || ''}` : 'No'}`,
          `Start Location: ${act.startLocationName || 'Location unavailable'} | End Location: ${act.endLocationName || 'Location unavailable'}`,
          act.photoUrls?.length ? `Photo URLs: ${act.photoUrls.join(', ')}` : '',
          act.videoUrls?.length ? `Video URLs: ${act.videoUrls.join(', ')}` : '',
        ].filter(Boolean);

        detailedActivityChildren.push(
          ...lines.map(
            (txt, lineIdx) =>
              new Paragraph({
                spacing: { after: lineIdx === lines.length - 1 ? 120 : 30 },
                children: [
                  new TextRun({
                    text: txt,
                    bold: lineIdx === 0,
                    size: lineIdx === 0 ? 18 : 16,
                    color: lineIdx === 0 ? '0F172A' : '334155',
                  }),
                ],
              })
          )
        );
      }
    }
  }

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
      })
    );

    for (const group of dayMediaGroups) {
      evidenceChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Date: ${group.date} (${group.dayOfWeek}) — Status: ${group.reportStatus}`,
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
          const targetHeight = Math.min(240, Math.round(targetWidth / (item.aspectRatio || 1.33)));

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
          const sizeMb = item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Recorded';
          evidenceChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 120 },
              children: [
                new TextRun({
                  text: 'Video Evidence: ',
                  bold: true,
                  size: 18,
                  color: '4338CA',
                }),
                new TextRun({
                  text: `${item.originalFilename} (${sizeMb})${item.downloadUrl ? ` — ${item.downloadUrl}` : ''}`,
                  size: 17,
                  color: '1E293B',
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
                  text: `[Photo Attachment: ${item.originalFilename}${item.downloadUrl ? ` — ${item.downloadUrl}` : ''}]`,
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
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
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
          ...detailedActivityChildren,
          ...evidenceChildren,
        ],
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  console.log(`[Monthly DOCX Export] Completed DOCX generation! Size: ${docxBuffer.length} bytes.`);
  return docxBuffer;
}
