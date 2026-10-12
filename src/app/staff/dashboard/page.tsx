'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ArrowRight,
  MapPin,
  Building2,
  FileEdit,
  History,
  User,
  Calendar,
  AlertCircle,
  RotateCcw,
  CalendarOff,
  CalendarDays,
} from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTodayDateString, formatReadableDate } from '@/lib/utils/date-utils';

export default function StaffDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [todayLeave, setTodayLeave] = useState<any | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = getTodayDateString();

  useEffect(() => {
    const loadStaffData = async () => {
      setLoading(true);
      try {
        const sessRes = await fetch('/api/auth/session');
        const sessData = await sessRes.json();
        if (sessData.authenticated) setUser(sessData.user);

        // Fetch reports for this authenticated staff user only
        const repRes = await fetch('/api/reports');
        const repData = await repRes.json();
        if (repData.reports) {
          setReports(repData.reports);
          const foundToday = repData.reports.find((r: DailyReport) => r.reportDate === todayStr);
          if (foundToday) setTodayReport(foundToday);
        }

        // Fetch leaves to see if staff is on approved leave today
        const leavesRes = await fetch('/api/leaves');
        const leavesData = await leavesRes.json();
        if (leavesData.leaves) {
          const activeLeave = leavesData.leaves.find((l: any) =>
            l.approvalStatus === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr
          );
          if (activeLeave) setTodayLeave(activeLeave);
        }
      } catch (err) {
        console.error('Failed to load staff dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStaffData();
  }, [todayStr]);

  // Authenticated user summary metrics
  const draftReports = reports.filter((r) => r.status === 'draft');
  const awaitingReviewReports = reports.filter((r) => r.status === 'submitted' || r.status === 'under_review');
  const correctionsRequired = reports.filter((r) => r.status === 'correction_requested');
  const approvedReports = reports.filter((r) => r.status === 'approved');

  const getTodayStatusCard = () => {
    if (!todayReport) {
      if (todayLeave) {
        return (
          <Card className="border-sky-200 bg-sky-50/60 shadow-xs">
            <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-bold mb-1">On Approved Leave Today</Badge>
                <h2 className="text-base font-extrabold text-sky-950">
                  You are currently on authorized {todayLeave.leaveType.toUpperCase()} leave ({todayStr})
                </h2>
                <p className="text-xs text-slate-600">
                  Leave duration: <span className="font-bold">{todayLeave.daysCount} day(s)</span> ({todayLeave.startDate} to {todayLeave.endDate}). You are exempt from submitting a daily activity report today.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/staff/leaves">
                  <Button variant="outline" size="sm" className="font-bold border-sky-300 text-sky-800 hover:bg-sky-100">
                    <CalendarOff className="h-4 w-4 mr-1.5" /> View My Leaves
                  </Button>
                </Link>
                <Link href="/staff/daily-report">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-800">
                    Submit Report Anyway
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge variant="warning" className="mb-1 font-bold">Today: Not Submitted Yet</Badge>
              <h2 className="text-lg font-extrabold text-slate-900">Today's Daily Activity Report ({todayStr})</h2>
              <p className="text-xs text-slate-600">
                Daily reporting deadline is <span className="font-extrabold text-emerald-800">07:00 PM IST</span>.
                Please log your daily work, visited farmers, meetings conducted, and photo evidence.
              </p>
            </div>
            <Link href="/staff/daily-report" className="w-full md:w-auto">
              <Button size="lg" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/20">
                <PlusCircle className="h-5 w-5 mr-1.5" /> Submit Daily Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    if (todayReport.status === 'draft') {
      return (
        <Card className="border-amber-200 bg-amber-50/60 shadow-xs">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge variant="warning" className="mb-1 font-bold">Saved Draft in Progress</Badge>
              <h2 className="text-base font-extrabold text-amber-950">You have a draft saved for today ({todayStr})</h2>
              <p className="text-xs text-slate-600">
                Finish entering your activities and submit before <span className="font-bold text-amber-900">07:00 PM</span>.
              </p>
            </div>
            <Link href={`/staff/daily-report?id=${todayReport.id}`} className="w-full md:w-auto">
              <Button size="lg" className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm">
                <FileEdit className="h-5 w-5 mr-1.5" /> Continue Draft
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    if (todayReport.status === 'correction_requested') {
      return (
        <Card className="border-rose-200 bg-rose-50/70 shadow-xs">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <Badge variant="destructive" className="mb-1 font-bold">Correction Requested by Reviewer</Badge>
              <h2 className="text-base font-extrabold text-rose-950">Action Needed on Today's Report</h2>
              {todayReport.reviewComments && (
                <div className="p-3 bg-white/90 rounded-xl border border-rose-200 text-xs">
                  <span className="font-bold text-slate-900 block mb-0.5">Reviewer Feedback:</span>
                  <p className="text-slate-800 italic">"{todayReport.reviewComments}"</p>
                </div>
              )}
            </div>
            <Link href={`/staff/daily-report?id=${todayReport.id}`} className="w-full md:w-auto">
              <Button size="lg" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20">
                <RotateCcw className="h-5 w-5 mr-1.5" /> Correct Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    if (todayReport.status === 'approved') {
      return (
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-xs">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-extrabold text-emerald-950">Daily Report Approved ✅</h2>
              </div>
              <p className="text-xs text-slate-600">
                Reviewed by <span className="font-bold">{todayReport.reviewerName || 'Department Reviewer'}</span>. Thank you for completing your daily submission on time!
              </p>
            </div>
            <Link href="/staff/report-history" className="w-full md:w-auto">
              <Button variant="outline" size="sm" className="w-full md:w-auto font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-100">
                <Eye className="h-4 w-4 mr-1.5" /> View Submitted Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      );
    }

    // Default: submitted awaiting review
    return (
      <Card className="border-sky-200 bg-sky-50/60 shadow-xs">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-600" />
              <h2 className="text-base font-extrabold text-sky-950">Report Submitted (Awaiting Review)</h2>
            </div>
            <p className="text-xs text-slate-600">
              Submitted at: <span className="font-bold">{todayReport.submittedAt ? new Date(todayReport.submittedAt).toLocaleTimeString('en-IN') : 'Today'}</span> | Attachments: <span className="font-bold">{todayReport.attachments?.length || 0}</span> files
            </p>
          </div>
          <Link href="/staff/report-history" className="w-full md:w-auto">
            <Button variant="outline" size="sm" className="w-full md:w-auto font-bold border-sky-300 text-sky-800 hover:bg-sky-100">
              <Eye className="h-4 w-4 mr-1.5" /> View Submitted Report
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Staff Welcome Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Agricart Field Operations
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome, {user?.fullName || 'Staff Member'} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-0.5">
            <span className="flex items-center gap-1 font-bold text-emerald-800">
              🆔 {user?.employeeId}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" /> {user?.departmentName || 'Field Operations'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {user?.assignedCenterNames?.[0] || 'Nashik Center'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold text-emerald-700">
              <Clock className="h-3.5 w-3.5" /> Deadline: 07:00 PM Daily
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/staff/daily-report" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <PlusCircle className="h-4 w-4 mr-1.5" /> Submit Daily Report
            </Button>
          </Link>
        </div>
      </div>

      {/* State-aware Today's Status Banner */}
      {getTodayStatusCard()}

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/staff/daily-report">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full group-hover:bg-emerald-100 transition-colors">
                <PlusCircle className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Submit Report</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/staff/report-history">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-sky-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 text-sky-700 rounded-full group-hover:bg-sky-100 transition-colors">
                <History className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">My Reports</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/staff/leaves">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-teal-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-50 text-teal-700 rounded-full group-hover:bg-teal-100 transition-colors">
                <CalendarOff className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">My Leaves</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/staff/reports/monthly">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full group-hover:bg-emerald-100 transition-colors">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Monthly Report</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/staff/corrections">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-rose-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-700 rounded-full group-hover:bg-rose-100 transition-colors">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Corrections</span>
                <span className="text-[10px] text-rose-700 font-bold">{correctionsRequired.length} required</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/staff/profile">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-full group-hover:bg-purple-100 transition-colors">
                <User className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">My Profile</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* Staff Personal Status Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Draft Reports</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700">{draftReports.length}</span>
              <span className="text-xs text-slate-500 font-medium">Unsubmitted</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Awaiting Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-sky-700">{awaitingReviewReports.length}</span>
              <span className="text-xs text-slate-500 font-medium">In Queue</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Corrections Needed</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700">{correctionsRequired.length}</span>
              <span className="text-xs text-slate-500 font-medium">Actionable</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Approved Reports</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">{approvedReports.length}</span>
              <span className="text-xs text-slate-500 font-medium">Verified</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Corrections Alert Section */}
      {correctionsRequired.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" /> Reports Requiring Corrections ({correctionsRequired.length})
              </CardTitle>
              <CardDescription>Your manager has requested changes before these reports can be approved.</CardDescription>
            </div>
            <Link href="/staff/corrections">
              <Button size="sm" variant="outline" className="text-xs font-bold border-rose-300 text-rose-900 hover:bg-rose-100">
                View All Corrections
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {correctionsRequired.slice(0, 2).map((cr) => (
              <div key={cr.id} className="p-3.5 bg-white rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{formatReadableDate(cr.reportDate)}</span>
                    <Badge variant="destructive" className="text-[10px]">Correction Requested</Badge>
                  </div>
                  {cr.reviewComments && (
                    <p className="text-xs text-slate-700 mt-1 italic">"{cr.reviewComments}"</p>
                  )}
                </div>
                <Link href={`/staff/daily-report?id=${cr.id}`} className="shrink-0">
                  <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
                    Edit & Resubmit
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Personal Submissions History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">My Recent Submissions</CardTitle>
            <CardDescription>Track status, submission timestamps, and manager evaluation comments</CardDescription>
          </div>
          <Link href="/staff/report-history">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-emerald-700">
              View All History <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading reporting history...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No report submissions recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 hover:border-emerald-300 transition-all"
                >
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{formatReadableDate(rep.reportDate)}</span>
                      <Badge variant={rep.status === 'approved' ? 'default' : rep.status === 'correction_requested' ? 'destructive' : rep.status === 'draft' ? 'secondary' : 'info'}>
                        {rep.status.toUpperCase()}
                      </Badge>
                      {rep.isLate && <Badge variant="warning">Late</Badge>}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{rep.activities || 'No activities described'}</p>
                    {rep.reviewComments && (
                      <p className="text-[11px] text-slate-500 italic">Reviewer: "{rep.reviewComments}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-emerald-700">📷 {rep.attachments?.length || 0} Files</span>
                    {rep.status === 'correction_requested' || rep.status === 'draft' ? (
                      <Link href={`/staff/daily-report?id=${rep.id}`}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                          <FileEdit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/staff/report-history">
                        <Button size="sm" variant="outline" className="text-xs font-bold">
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
