'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { UserProfile, ReportAttachment, DailyReport } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTodayDateString, formatReadableDateTime } from '@/lib/utils/date-utils';

function DailyReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [isLockedApproved, setIsLockedApproved] = useState(false);

  // Form Fields State
  const [reportDate, setReportDate] = useState(getTodayDateString());
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

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) setUser(data.user);
      });

    if (editId) {
      setLoadingExisting(true);
      fetch(`/api/reports/${editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.report) {
            const r = data.report as DailyReport;
            setExistingReport(r);

            // Check if report is approved and locked
            if (r.status === 'approved') {
              setIsLockedApproved(true);
              setError('This report is already approved and locked. Modifications are only permitted if an authorized supervisor requests an edit.');
            }

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLockedApproved) return;
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
    if (isLockedApproved) return;
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSaveReport = async (submitNow: boolean) => {
    if (isLockedApproved) {
      setError('Cannot submit changes to an approved report.');
      return;
    }

    if (submitNow && (!activities.trim() || !completedTasks.trim())) {
      setError('Please fill in required fields: "Activities Performed Today" and "Tasks Completed".');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      id: editId || undefined,
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
        throw new Error(data.error || 'Failed to save daily activity report.');
      }

      setSuccessMsg(
        submitNow
          ? existingReport
            ? '🎉 Revised report successfully resubmitted!'
            : '🎉 Report successfully submitted!'
          : '💾 Draft report saved.'
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-xl font-extrabold text-slate-900">
            {isRevisionMode
              ? `Edit & Resubmit Daily Activity Report (${existingReport?.reportDate})`
              : existingReport
              ? `Daily Activity Report (${existingReport.reportDate})`
              : 'Daily Activity Report Form'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Agricart Farmers Producer Company Ltd | Staff Reporting Module
          </p>
        </div>

        {existingReport && (
          <Badge
            variant={
              existingReport.status === 'approved'
                ? 'default'
                : isRevisionMode
                ? 'destructive'
                : 'info'
            }
            className="text-xs font-bold uppercase"
          >
            {existingReport.status === 'edit_requested'
              ? 'Edit Requested'
              : existingReport.status.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {loadingExisting && (
        <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs font-semibold">
          Loading report details for revision...
        </div>
      )}

      {/* Locked Alert for Approved Reports */}
      {isLockedApproved && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs flex items-start gap-3 shadow-2xs">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-amber-950">Report is Approved & Locked</h3>
            <p className="text-amber-800">
              This report for {existingReport?.reportDate} has already been approved and finalized. You cannot edit it unless an authorized supervisor issues a formal <strong>Request Edit</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Revision Banner for Edit Requested Reports */}
      {isRevisionMode && existingReport && (
        <div className="p-4 sm:p-5 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-950 font-extrabold">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                Revisions Requested by {existingReport.editRequest?.requesterName || existingReport.reviewerName || 'Supervisor'} (Preparing Revision #{existingReport.revisionNumber + 1})
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

      {error && !isLockedApproved && (
        <div className="p-4 bg-rose-100 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" /> {successMsg}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">1. Basic Assignment & Schedule</CardTitle>
            <CardDescription className="text-xs">Location and shift hours for reporting date</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Report Date</label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={Boolean(existingReport)}
                required
              />
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
                disabled={isLockedApproved}
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work Start Time</label>
              <Input
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
                disabled={isLockedApproved}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work End Time</label>
              <Input
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
                disabled={isLockedApproved}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Work Performed & Output */}
        <Card>
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
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isLockedApproved}
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
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isLockedApproved}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Number of Farmers Visited</label>
                <Input
                  type="number"
                  min="0"
                  value={farmersVisited}
                  onChange={(e) => setFarmersVisited(e.target.value)}
                  disabled={isLockedApproved}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Number of Meetings Conducted</label>
                <Input
                  type="number"
                  min="0"
                  value={meetingsConducted}
                  onChange={(e) => setMeetingsConducted(e.target.value)}
                  disabled={isLockedApproved}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Performance, Challenges & Next Day Plan */}
        <Card>
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
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isLockedApproved}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Challenges & Issues Encountered</label>
              <textarea
                rows={2}
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder="Logistics delays, equipment faults, payment issues, climate problems..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isLockedApproved}
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
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  disabled={isLockedApproved}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Support or Approval Required</label>
                <textarea
                  rows={2}
                  value={supportRequired}
                  onChange={(e) => setSupportRequired(e.target.value)}
                  placeholder="Need transport, budget sanction, manager consultation..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  disabled={isLockedApproved}
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
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isLockedApproved}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">General Remarks / Notes</label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any other relevant details or observations..."
                disabled={isLockedApproved}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Attachments (Preserved from Previous Submissions) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">4. Field Evidence & Media Attachments</CardTitle>
            <CardDescription className="text-xs">
              Upload geo-tagged farmer meeting photos, weighing receipts, or field survey videos. Existing attachments are preserved unless deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {!isLockedApproved && (
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
                        {!isLockedApproved && (
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

        {/* Action Buttons */}
        {!isLockedApproved && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleSaveReport(false)}
              className="rounded-full border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs"
            >
              <Save className="h-4 w-4 mr-1.5" /> Save as Draft
            </Button>

            <Button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveReport(true)}
              className={`rounded-full font-extrabold px-8 py-2.5 h-11 text-sm shadow-md ${
                isRevisionMode
                  ? 'bg-purple-700 hover:bg-purple-800 text-white shadow-purple-700/20'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
              }`}
            >
              {submitting ? (
                'Submitting...'
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
