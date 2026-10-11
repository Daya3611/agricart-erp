'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, Upload, Image as ImageIcon, Video as VideoIcon, Trash2, CheckCircle2, Save, AlertCircle, ArrowLeft } from 'lucide-react';
import { UserProfile, ReportAttachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getTodayDateString } from '@/lib/utils/date-utils';

function DailyReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);

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
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSaveReport = async (submitNow: boolean) => {
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

      setSuccessMsg(submitNow ? '🎉 Report successfully submitted!' : '💾 Draft report saved.');
      setTimeout(() => {
        router.push('/staff/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="text-xl font-extrabold text-slate-900">Daily Activity Report Form</h1>
          <p className="text-xs text-slate-500 font-medium">
            Agricart Farmers Producer Company Ltd | Staff Reporting Module
          </p>
        </div>
      </div>

      {error && (
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
            <CardTitle className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
              1. Basic Information & Work Details
            </CardTitle>
            <CardDescription>Verified account data automatically attached</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Report Date *</label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Employee Name & ID</label>
              <Input
                value={`${user?.fullName || 'Staff Member'} (${user?.employeeId || 'AGR-104'})`}
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
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work Start Time</label>
              <Input
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Work End Time</label>
              <Input
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Activity Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
              2. Activities & Completed Tasks
            </CardTitle>
            <CardDescription>Detail tasks performed, stakeholders visited, and results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Activities Performed Today *</label>
              <textarea
                rows={4}
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                placeholder="Detailed description of field visits, crop inspection, procurement, moisture testing..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tasks Completed Today *</label>
              <textarea
                rows={3}
                value={completedTasks}
                onChange={(e) => setCompletedTasks(e.target.value)}
                placeholder="Key deliverables completed (e.g. Procured 12 MT Red Onions, Distributed 200 crates)..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Farmers / Stakeholders Visited</label>
                <Input
                  type="number"
                  min={0}
                  value={farmersVisited}
                  onChange={(e) => setFarmersVisited(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Group Meetings Conducted</label>
                <Input
                  type="number"
                  min={0}
                  value={meetingsConducted}
                  onChange={(e) => setMeetingsConducted(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Results & Achievements</label>
              <textarea
                rows={2}
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="Key achievements or milestone targets hit..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-amber-900 block mb-1">Challenges & Issues Faced</label>
                <textarea
                  rows={2}
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  placeholder="Transport bottlenecks, weather delays, quality issues..."
                  className="w-full rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Plan for Next Working Day</label>
                <textarea
                  rows={2}
                  value={nextDayPlan}
                  onChange={(e) => setNextDayPlan(e.target.value)}
                  placeholder="Scheduled field visits, meetings, or procurement targets for tomorrow..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Evidence Uploads (Firebase Cloud Storage) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
              3. Work Evidence (Photos & Videos)
            </CardTitle>
            <CardDescription>Upload real photos/videos to Firebase Cloud Storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
              <label className="font-bold text-slate-800 block">Add Photo or Video Attachment</label>
              <Input
                type="text"
                placeholder="Optional Caption for attachment (e.g. Onion Crate Moisture Test at Dindori)"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                className="bg-white"
              />

              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-2xs">
                  <Upload className="h-4 w-4" />
                  <span>{uploading ? 'Uploading to Firebase Storage...' : 'Choose Photos / Videos'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Max 10MB per photo, 100MB per video</span>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Uploaded Attachments ({attachments.length}):</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                        <span className="truncate">{att.originalFilename}</span>
                        <button
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="text-rose-600 hover:bg-rose-50 p-1 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleSaveReport(false)}
            className="border-amber-300 text-amber-900 hover:bg-amber-50 font-bold"
          >
            <Save className="h-4 w-4 mr-1.5" /> Save as Draft
          </Button>

          <Button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveReport(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8 py-2.5 h-11 text-sm shadow-md shadow-emerald-600/20"
          >
            {submitting ? 'Submitting Report...' : 'Submit Activity Report'}
          </Button>
        </div>
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
