'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PlusCircle,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  CheckCircle2,
  Save,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  Lock,
  Clock,
  Eye,
  FileText,
  Calendar,
  AlertTriangle,
  X,
} from 'lucide-react';
import { UserProfile, ReportAttachment, DailyReport } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportDetailsDialog } from '@/components/reports/ReportDetailsDialog';
import {
  getTodayDateString,
  getOperationalDateString,
  normalizeReportDate,
  formatReadableDate,
  formatReadableDateTime,
} from '@/lib/utils/date-utils';

function DailyReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [isLockedApproved, setIsLockedApproved] = useState(false);

  // Duplicate Check & Status State
  const [isCheckingReport, setIsCheckingReport] = useState(false);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form Fields State
  const [reportDate, setReportDate] = useState(getOperationalDateString());
  const [workLocation, setWorkLocation] = useState('Field Procurement & Farming Clusters');
  const [workStartTime, setWorkStartTime] = useState('08:30');
  const [workEndTime, setWorkEndTime] = useState('18:00');

  const [activities, setActivities] = useState('');
  const [completedTasks, setCompletedTasks] = useState('');
  const [farmersVisited, setFarmersVisited] = useState<number | string>(0);
  const [meetingsConducted, setMeetingsConducted] = useState<number | string>(0);

  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [pendingWork, setPendingWork] = useState('');
  const [supportRequired, setSupportRequired] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [remarks, setRemarks] = useState('');

  // Media Attachment Uploads State
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const populateFormFromReport = (r: DailyReport) => {
    if (r.reportDate) setReportDate(r.reportDate);
    if (r.workLocation) setWorkLocation(r.workLocation);
    if (r.workStartTime) setWorkStartTime(r.workStartTime);
    if (r.workEndTime) setWorkEndTime(r.workEndTime);
    if (r.activities) setActivities(r.activities);
    if (r.completedTasks) setCompletedTasks(r.completedTasks);
    if (r.farmersVisited !== undefined) setFarmersVisited(r.farmersVisited);
    if (r.meetingsConducted !== undefined) setMeetingsConducted(r.meetingsConducted);
    if (r.achievements) setAchievements(r.achievements);
    if (r.challenges) setChallenges(r.challenges);
    if (r.pendingWork) setPendingWork(r.pendingWork);
    if (r.supportRequired) setSupportRequired(r.supportRequired);
    if (r.nextDayPlan) setNextDayPlan(r.nextDayPlan);
    if (r.remarks) setRemarks(r.remarks);
    if (Array.isArray(r.attachments)) setAttachments(r.attachments);
  };

  const resetFormToDefaults = () => {
    setWorkLocation('Field Procurement & Farming Clusters');
    setWorkStartTime('08:30');
    setWorkEndTime('18:00');
    setActivities('');
    setCompletedTasks('');
    setFarmersVisited(0);
    setMeetingsConducted(0);
    setAchievements('');
    setChallenges('');
    setPendingWork('');
    setSupportRequired('');
    setNextDayPlan('');
    setRemarks('');
    setAttachments([]);
  };

  // Check if a report exists for the selected date
  const checkReportForDate = async (targetDate: string, isInitial = false) => {
    if (editId) return; // If specifically editing a report ID via query param, skip date duplicate check
    setIsCheckingReport(true);
    setCheckError(null);
    setError(null);

    try {
      const res = await fetch(`/api/reports/check?reportDate=${encodeURIComponent(targetDate)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify daily report status.');
      }

      if (data.exists && data.report) {
        const r = data.report as DailyReport;
        setExistingReport(r);

        if (data.isSubmitted) {
          setIsAlreadySubmitted(true);
          setIsDraftLoaded(false);
          setIsLockedApproved(r.status === 'approved');
        } else if (data.isRevisionRequired) {
          setIsAlreadySubmitted(false);
          setIsDraftLoaded(false);
          setIsLockedApproved(false);
          populateFormFromReport(r);
        } else if (data.isDraft) {
          setIsAlreadySubmitted(false);
          setIsDraftLoaded(true);
          setIsLockedApproved(false);
          populateFormFromReport(r);
        }
      } else {
        // No report exists for this date
        setIsAlreadySubmitted(false);
        setIsDraftLoaded(false);
        setIsLockedApproved(false);
        setExistingReport(null);
        if (!isInitial) {
          resetFormToDefaults();
        }
      }
    } catch (err: any) {
      setCheckError(err.message || 'Unable to check daily report status. Please check your connection or retry.');
      setIsAlreadySubmitted(false);
      setExistingReport(null);
    } finally {
      setIsCheckingReport(false);
    }
  };

  // 1. Initial Load: Auth Session & Initial Check or editId Fetch
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) setUser(data.user);
      })
      .catch((err) => console.error('Failed to load session:', err));

    if (editId) {
      setLoadingExisting(true);
      fetch(`/api/reports/${editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.report) {
            const r = data.report as DailyReport;
            setExistingReport(r);
            populateFormFromReport(r);

            // Check if report is approved and locked
            if (r.status === 'approved') {
              setIsLockedApproved(true);
              setIsAlreadySubmitted(true);
              setError('This report is already approved and locked. Modifications are only permitted if an authorized supervisor requests an edit.');
            } else if (['submitted', 'under_review', 'resubmitted', 'rejected'].includes(r.status)) {
              setIsAlreadySubmitted(true);
            }
          } else {
            setError(data.error || 'Failed to load report for editing.');
          }
        })
        .catch((err) => {
          setError(err.message || 'Error fetching report.');
        })
        .finally(() => setLoadingExisting(false));
    }
  }, [editId]);

  // Initial duplicate check when user is ready (if not editId)
  useEffect(() => {
    if (!editId && user) {
      checkReportForDate(reportDate, true);
    }
  }, [user?.uid]);

  // 2. Date Change Handler
  const handleDateChange = (newDateStr: string) => {
    const normalized = normalizeReportDate(newDateStr);
    setReportDate(normalized);
    checkReportForDate(normalized, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLockedApproved || isAlreadySubmitted) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', uploadCaption || file.name);

        const res = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        setAttachments((prev) => [...prev, data.attachment]);
      }
      setUploadCaption('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    if (isLockedApproved || isAlreadySubmitted) return;
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSaveReport = async (submitNow: boolean) => {
    if (isAlreadySubmitted) {
      setError(`A daily activity report has already been submitted for ${reportDate}. Duplicate submissions are not permitted.`);
      return;
    }

    if (isLockedApproved) {
      setError('Cannot submit changes to an approved report.');
      return;
    }

    if (isCheckingReport) {
      setError('Please wait while existing submissions are being verified for this date.');
      return;
    }

    if (checkError) {
      setError('Cannot proceed while submission verification is unresolved. Please retry verification.');
      return;
    }

    if (submitNow && (!activities.trim() || !completedTasks.trim())) {
      setError('Please fill in required fields: "Activities Performed Today" and "Tasks Completed".');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      id: editId || (existingReport?.id) || undefined,
      reportDate,
      workLocation,
      workStartTime,
      workEndTime,
      activities,
      completedTasks,
      farmersVisited: Number(farmersVisited || 0),
      meetingsConducted: Number(meetingsConducted || 0),
      achievements,
      challenges,
      pendingWork,
      supportRequired,
      nextDayPlan,
      remarks,
      attachments,
      submitNow,
    };

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error && data.error.includes('already been submitted')) {
          setIsAlreadySubmitted(true);
          checkReportForDate(reportDate, false);
        }
        throw new Error(data.error || 'Failed to save daily activity report.');
      }

      setSuccessMsg(
        submitNow
          ? existingReport
            ? 'Revised report successfully resubmitted!'
            : 'Report successfully submitted!'
          : 'Draft report saved.'
      );
      setTimeout(() => {
        router.push('/staff/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isRevisionMode = Boolean(
    existingReport &&
      (existingReport.status === 'edit_requested' || existingReport.status === 'correction_requested')
  );

  const isFormDisabled = isAlreadySubmitted || isLockedApproved || isCheckingReport;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'submitted':
      case 'under_review':
      case 'resubmitted':
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-bold text-xs">
            <Clock className="h-3 w-3 mr-1" /> {status === 'resubmitted' ? 'Resubmitted' : 'Awaiting Review'}
          </Badge>
        );
      case 'correction_requested':
      case 'edit_requested':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-bold text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> {status === 'edit_requested' ? 'Edit Requested' : 'Correction Required'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 font-bold text-xs">
            <X className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="text-slate-600 font-bold text-xs">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isRevisionMode
              ? `Edit & Resubmit Daily Activity Report (${existingReport?.reportDate})`
              : isAlreadySubmitted && existingReport
              ? `Daily Activity Report (${existingReport.reportDate})`
              : 'Submit Daily Activity Report'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Agricart Farmers Producer Company Ltd | Staff Field Reporting
          </p>
        </div>

        {existingReport && (
          <div className="self-start sm:self-auto flex items-center gap-2">
            {getStatusBadge(existingReport.status)}
            {existingReport.revisionNumber > 1 && (
              <Badge variant="purple" className="text-[10px] font-bold">
                Rev #{existingReport.revisionNumber}
              </Badge>
            )}
          </div>
        )}
      </div>

      {loadingExisting && (
        <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-slate-600" />
          <span>Loading report details for revision...</span>
        </div>
      )}

      {/* 2. Checking State Indicator */}
      {isCheckingReport && (
        <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-3 shadow-2xs">
          <Clock className="h-5 w-5 text-emerald-600 animate-spin shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              Checking submission record for {formatReadableDate(reportDate)}...
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Verifying whether an activity report has already been logged for this date.
            </p>
          </div>
        </div>
      )}

      {/* 3. Existing Report State Banner (Already Submitted) */}
      {!isCheckingReport && isAlreadySubmitted && existingReport && (
        <div className="p-4 sm:p-5 bg-white border border-emerald-300 rounded-2xl shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-emerald-100 pb-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  Daily report already submitted
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  You have already submitted your activity report for{' '}
                  <strong className="text-slate-900">{formatReadableDate(reportDate)}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto pl-12 sm:pl-0">
              {getStatusBadge(existingReport.status)}
              {existingReport.revisionNumber > 1 && (
                <Badge variant="purple" className="text-[10px] font-bold">
                  Revision #{existingReport.revisionNumber}
                </Badge>
              )}
            </div>
          </div>

          {/* Existing Report Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Submission Timestamp
              </span>
              <span className="font-bold text-slate-900">
                {existingReport.submittedAt || existingReport.createdAt
                  ? formatReadableDateTime(existingReport.submittedAt || existingReport.createdAt)
                  : 'Recorded'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Report Status
              </span>
              <span className="font-bold text-slate-900 capitalize">
                {existingReport.status.replace('_', ' ')}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Evidence Attachments
              </span>
              <span className="font-bold text-slate-900">
                {existingReport.attachments?.length || 0} file(s) attached
              </span>
            </div>
          </div>

          {/* Review Comments Callout if present */}
          {(existingReport.reviewComments || existingReport.editRequest?.reason) && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
              <span className="font-bold text-amber-900 block mb-0.5">Supervisor Review Comments:</span>
              <p className="text-slate-800 italic">"{existingReport.reviewComments || existingReport.editRequest?.reason}"</p>
            </div>
          )}

          {/* Banner Actions */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Duplicate submissions are blocked to maintain compliance integrity.</span>
            </div>

            <Button
              type="button"
              onClick={() => setIsDetailModalOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 min-h-[44px] rounded-xl shadow-xs w-full sm:w-auto"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              <span>View Submitted Report</span>
            </Button>
          </div>
        </div>
      )}

      {/* 4. Check Query Error State */}
      {!isCheckingReport && checkError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-950">Unable to verify submission status</h3>
              <p className="text-rose-800 mt-0.5">{checkError}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => checkReportForDate(reportDate, false)}
            className="border-rose-300 text-rose-900 hover:bg-rose-100 font-bold text-xs shrink-0 h-9 min-h-[44px] sm:min-h-0"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry Check
          </Button>
        </div>
      )}

      {/* 5. Draft Loaded Notification */}
      {!isCheckingReport && !isAlreadySubmitted && isDraftLoaded && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-amber-900">
            <Clock className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              Saved draft found and loaded for <strong>{formatReadableDate(reportDate)}</strong>. You can continue editing below.
            </span>
          </div>
          <Badge variant="warning" className="text-[10px] font-bold shrink-0">Unsubmitted Draft</Badge>
        </div>
      )}

      {/* 6. Locked Alert for Approved Reports */}
      {isLockedApproved && !isAlreadySubmitted && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs flex items-start gap-3 shadow-2xs">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-amber-950">Report is Approved & Locked</h3>
            <p className="text-amber-800">
              This report for {formatReadableDate(reportDate)} has already been approved and finalized. You cannot edit it unless an authorized supervisor issues a formal <strong>Request Edit</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 7. Revision Banner for Edit Requested Reports */}
      {isRevisionMode && existingReport && (
        <div className="p-4 sm:p-5 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-950 font-extrabold">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                Revisions Requested by {existingReport.editRequest?.requesterName || existingReport.reviewerName || 'Supervisor'} (Preparing Revision #{(existingReport.revisionNumber || 1) + 1})
              </span>
            </div>
            <Badge variant="destructive" className="text-[10px]">Action Required</Badge>
          </div>

          <div className="p-3 bg-white/95 rounded-xl border border-rose-200/80 text-rose-950 space-y-1">
            <p className="font-semibold text-rose-900">
              Reason: <span className="font-normal italic text-slate-800">"{existingReport.editRequest?.reason || existingReport.reviewComments}"</span>
            </p>
            {existingReport.editRequest?.instructions && (
              <p className="font-semibold text-rose-900">
                Instructions: <span className="font-normal text-slate-800">{existingReport.editRequest.instructions}</span>
              </p>
            )}
          </div>

          <p className="text-slate-600 text-[11px]">
            Your previous content and attachments have been preserved below. Make the required edits and click <strong>Resubmit Revised Report</strong>.
          </p>
        </div>
      )}

      {error && !isLockedApproved && !isAlreadySubmitted && (
        <div className="p-4 bg-rose-100 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" /> {successMsg}
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="border border-slate-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">1. Basic Assignment & Schedule</CardTitle>
            <CardDescription className="text-xs">Location and shift hours for reporting date</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="report-date" className="font-bold text-slate-700 block mb-1">
                Report Date *
              </label>
              <Input
                id="report-date"
                type="date"
                value={reportDate}
                onChange={(e) => handleDateChange(e.target.value)}
                disabled={Boolean(editId) || isCheckingReport}
                className="bg-white font-medium"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Select reporting date. Changing date verifies submission history automatically.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Employee Name & ID</label>
              <Input
                value={`${user?.fullName || 'Staff'} (${user?.employeeId || 'AGR-104'})`}
                disabled
                className="bg-slate-50 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
              <Input
                value={user?.departmentName || 'Field Operations & Procurement'}
                disabled
                className="bg-slate-50 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work Location *</label>
              <Input
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                placeholder="e.g. Dindori Farmers Cluster / APMC Market"
                disabled={isFormDisabled}
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work Start Time</label>
              <Input
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
                disabled={isFormDisabled}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work End Time</label>
              <Input
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
                disabled={isFormDisabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Work Performed & Output */}
        <Card className="border border-slate-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">2. Daily Activities & Field Engagement</CardTitle>
            <CardDescription className="text-xs">Detail operational execution and metrics achieved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Activities Performed Today * <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <textarea
                rows={3}
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                placeholder="Comprehensive breakdown of field visits, collection, verification, or procurement tasks handled..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                disabled={isFormDisabled}
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Tasks Completed * <span className="text-slate-400 font-normal">(Required)</span>
              </label>
              <textarea
                rows={2}
                value={completedTasks}
                onChange={(e) => setCompletedTasks(e.target.value)}
                placeholder="List completed deliverables and goals accomplished..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                disabled={isFormDisabled}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Number of Farmers Visited</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  value={farmersVisited}
                  onChange={(e) => setFarmersVisited(e.target.value)}
                  disabled={isFormDisabled}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Number of Meetings Conducted</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  value={meetingsConducted}
                  onChange={(e) => setMeetingsConducted(e.target.value)}
                  disabled={isFormDisabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Performance, Challenges & Next Day Plan */}
        <Card className="border border-slate-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">3. Operational Challenges & Forward Planning</CardTitle>
            <CardDescription className="text-xs">Escalate roadblocks, highlight milestones, and set tomorrow's agenda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Key Achievements & Outcomes</label>
              <textarea
                rows={2}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="Major breakthroughs, collection targets met, farmer onboardings..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                disabled={isFormDisabled}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Challenges & Issues Encountered</label>
              <textarea
                rows={2}
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder="Logistics delays, equipment faults, payment issues, climate problems..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                disabled={isFormDisabled}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pending / Incomplete Work</label>
                <textarea
                  rows={2}
                  value={pendingWork}
                  onChange={(e) => setPendingWork(e.target.value)}
                  placeholder="Tasks rolling over to next shift..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  disabled={isFormDisabled}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Support or Approval Required</label>
                <textarea
                  rows={2}
                  value={supportRequired}
                  onChange={(e) => setSupportRequired(e.target.value)}
                  placeholder="Need transport, budget sanction, manager consultation..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Plan for Next Working Day</label>
              <textarea
                rows={2}
                value={nextDayPlan}
                onChange={(e) => setNextDayPlan(e.target.value)}
                placeholder="Scheduled visits, route plan, targets for next day..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                disabled={isFormDisabled}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">General Remarks / Notes</label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any other relevant details or observations..."
                disabled={isFormDisabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Attachments */}
        <Card className="border border-slate-200 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">4. Field Evidence & Media Attachments</CardTitle>
            <CardDescription className="text-xs">
              Upload geo-tagged farmer meeting photos, weighing receipts, or field survey videos. Existing attachments are preserved unless deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {!isFormDisabled && (
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-2 text-center">
                <Upload className="h-8 w-8 text-slate-400" />
                <div>
                  <label className="cursor-pointer text-emerald-700 font-extrabold hover:underline">
                    <span>Click to choose photos or videos to upload</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, WebP, MP4 up to 50MB</p>
                </div>
                {uploading && <p className="text-xs font-bold text-emerald-600 animate-pulse">Uploading file evidence...</p>}
              </div>
            )}

            {/* List of Attached Evidence */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-800 block text-xs">
                  Attached Files ({attachments.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          {att.mimeType.startsWith('video') ? (
                            <VideoIcon className="h-4 w-4 text-purple-600 shrink-0" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[120px]">
                            {att.originalFilename}
                          </span>
                        </div>
                        {!isFormDisabled && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors"
                            title="Remove attachment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {att.caption && (
                        <p className="text-[10px] text-emerald-800 font-semibold italic truncate">"{att.caption}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons Section */}
        {isAlreadySubmitted ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="font-semibold">
                Report for {formatReadableDate(reportDate)} is already recorded. Select another date to submit a different day's report.
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDetailModalOpen(true)}
                className="font-bold text-xs rounded-xl h-10 w-full sm:w-auto"
              >
                <Eye className="h-4 w-4 mr-1.5" /> View Submitted Report
              </Button>
            </div>
          </div>
        ) : !isLockedApproved && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <Button
              type="button"
              variant="outline"
              disabled={submitting || isCheckingReport || Boolean(checkError)}
              onClick={() => handleSaveReport(false)}
              className="w-full sm:w-auto h-11 rounded-xl border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs"
            >
              <Save className="h-4 w-4 mr-1.5" /> Save as Draft
            </Button>

            <Button
              type="button"
              disabled={submitting || isCheckingReport || Boolean(checkError)}
              onClick={() => handleSaveReport(true)}
              className={`w-full sm:w-auto rounded-xl font-extrabold px-6 h-11 text-sm shadow-md ${
                isRevisionMode
                  ? 'bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/20'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
              }`}
            >
              {submitting ? (
                'Submitting...'
              ) : isCheckingReport ? (
                'Checking Date...'
              ) : isRevisionMode ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Resubmit Revised Report (Revision #{(existingReport?.revisionNumber || 1) + 1})
                </>
              ) : (
                'Submit Activity Report'
              )}
            </Button>
          </div>
        )}
      </form>

      {/* Detail Dialog Modal */}
      <ReportDetailsDialog
        report={existingReport}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        showHistoryLink={true}
      />
    </div>
  );
}

export default function DailyReportFormPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading form...</div>}>
      <DailyReportFormContent />
    </Suspense>
  );
}
