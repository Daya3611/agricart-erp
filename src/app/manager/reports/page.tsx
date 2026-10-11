'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Eye, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { formatReadableDate } from '@/lib/utils/date-utils';
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';

export default function ManagerReportsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      r.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.activities.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusBadges: Record<string, { label: string; variant: any }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Submitted', variant: 'info' },
    under_review: { label: 'Under Review', variant: 'info' },
    correction_requested: { label: 'Correction Requested', variant: 'destructive' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-purple-600" /> Department Activity Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Review and evaluate daily activity submissions from field staff in your assigned department.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReportsToCSV(filteredReports)}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportsToPDF(filteredReports)}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="text"
              placeholder="Search staff, ID, activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 text-xs"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted (Awaiting Review)</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="correction_requested">Correction Requested</option>
            </select>
          </div>

          <Badge variant="outline" className="text-xs font-bold">
            {filteredReports.length} Reports Found
          </Badge>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Submitted Reports</CardTitle>
          <CardDescription>Click Review to evaluate activities and attachments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading department reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No reports found matching criteria.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Work Location</TableHead>
                  <TableHead>Farmers / Meetings</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                      {formatReadableDate(r.reportDate)}
                      {r.isLate && <Badge variant="warning" className="ml-1 text-[10px]">Late</Badge>}
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-900">{r.staffName}</p>
                      <p className="text-[11px] text-slate-500">{r.employeeId}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">{r.workLocation}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-800">
                      👨‍🌾 {r.farmersVisited || 0} visited | 🤝 {r.meetingsConducted || 0} meetings
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-700">
                      📷 {r.attachments?.length || 0} Files
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadges[r.status]?.variant || 'secondary'}>
                        {statusBadges[r.status]?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(r)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={Boolean(selectedReport)}
          onOpenChange={() => setSelectedReport(null)}
          currentUser={user}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
