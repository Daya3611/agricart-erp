import { DailyReport } from '@/types';

export function downloadCSV(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell ?? '').replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportReportsToCSV(reports: DailyReport[], filename = 'agricart_daily_reports.csv') {
  const headers = [
    'Report Date',
    'Employee ID',
    'Staff Name',
    'Department',
    'Center',
    'Work Location',
    'Status',
    'Farmers Visited',
    'Meetings Conducted',
    'Activities',
    'Tasks Completed',
    'Challenges',
    'Submitted At',
    'Reviewer',
    'Reviewer Comments',
  ];

  const rows = [
    headers,
    ...reports.map((r) => [
      r.reportDate,
      r.employeeId,
      r.staffName,
      r.departmentName,
      r.centerName,
      r.workLocation,
      r.status.toUpperCase(),
      String(r.farmersVisited || 0),
      String(r.meetingsConducted || 0),
      r.activities || '',
      r.completedTasks || '',
      r.challenges || '',
      r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN') : 'N/A',
      r.reviewerName || 'N/A',
      r.reviewComments || '',
    ]),
  ];

  downloadCSV(filename, rows);
}

export async function exportReportsToPDF(reports: DailyReport[], title = 'Agricart FPC - Daily Activity Reports Summary') {
  try {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header banner
    doc.setFillColor(6, 78, 59); // Deep agricultural green
    doc.rect(0, 0, 297, 24, 'F');

    let bannerTextX = 14;
    try {
      const settingsRes = await fetch('/api/settings');
      const settingsJson = settingsRes.ok ? await settingsRes.json() : null;
      const logoUrl =
        settingsJson?.settings?.companyLogoUrl ||
        settingsJson?.settings?.reportingConfig?.organization?.companyLogoUrl ||
        '/logo.png';
      const imgRes = await fetch(logoUrl);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/jpeg')) {
          const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(14, 4, 16, 16, 2, 2, 'F');
          doc.addImage(dataUrl, fmt, 15, 5, 14, 14, undefined, 'FAST');
          bannerTextX = 34;
        }
      }
    } catch {
      // Optional logo load failure never blocks export
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), bannerTextX, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Official Verified Report Submission', bannerTextX, 18);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 240, 18);

    doc.setTextColor(15, 23, 42);

    const tableHeaders = [
      ['Date', 'EMP ID', 'Staff Name', 'Department', 'Center', 'Status', 'Farmers', 'Meetings', 'Submitted At'],
    ];

    const tableData = reports.map((r) => [
      r.reportDate,
      r.employeeId,
      r.staffName,
      r.departmentName,
      r.centerName,
      r.status.toUpperCase(),
      String(r.farmersVisited || 0),
      String(r.meetingsConducted || 0),
      r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : 'Draft/Pending',
    ]);

    (autoTable as any)(doc, {
      startY: 28,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [22, 163, 74], // Primary agricultural green
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
    });

    doc.save(`agricart_reports_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err) {
    console.error('PDF generation error:', err);
    alert('Failed to generate PDF. Downloading CSV instead.');
    exportReportsToCSV(reports);
  }
}
