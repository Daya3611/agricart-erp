'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Clock,
  Mail,
  Shield,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  MapPin,
  Calendar,
  Eye,
  Sliders,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserProfile, SystemSettings, GlobalReportingConfig } from '@/types';
import { DEFAULT_GLOBAL_REPORTING_CONFIG } from '@/lib/constants/reporting-defaults';
import { MediaUpload } from '@/components/media/media-upload';
import { MediaPreview } from '@/components/media/media-preview';

export default function AdminSettingsPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'reporting' | 'schedule' | 'fields' | 'exports'>('general');

  // Form states
  const [companyName, setCompanyName] = useState('Agricart Farmers Producer Company Ltd');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('/logo.png');
  const [companyLogoKey, setCompanyLogoKey] = useState<string | undefined>(undefined);
  const [companyLogoMediaId, setCompanyLogoMediaId] = useState<string | undefined>(undefined);
  const [companyAddress, setCompanyAddress] = useState('Plot 42, MIDC Dindori Road, Nashik, Maharashtra 422004');
  const [companyPhone, setCompanyPhone] = useState('+91 253 2500000');
  const [companyEmail, setCompanyEmail] = useState('contact@agricartfpc.in');
  const [reportFooterText, setReportFooterText] = useState('Agricart Farmers Producer Company Ltd • All rights reserved.');

  // Reporting configuration
  const [config, setConfig] = useState<GlobalReportingConfig>(DEFAULT_GLOBAL_REPORTING_CONFIG);

  // Email settings
  const [fromEmail, setFromEmail] = useState('erp@agricartfpc.in');
  const [fromName, setFromName] = useState('Agricart FPC ERP');

  // New holiday input state
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) setCurrentUser(data.user);
      });

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const s: SystemSettings = data.settings;
          if (s.companyName) setCompanyName(s.companyName);
          if (s.companyLogoUrl || s.reportingConfig?.organization?.companyLogoUrl) {
            setCompanyLogoUrl(s.companyLogoUrl || s.reportingConfig?.organization?.companyLogoUrl || '/logo.png');
          }
          if (s.companyLogoKey || s.reportingConfig?.organization?.companyLogoKey) {
            setCompanyLogoKey(s.companyLogoKey || s.reportingConfig?.organization?.companyLogoKey);
          }
          if (s.companyLogoMediaId || s.reportingConfig?.organization?.companyLogoMediaId) {
            setCompanyLogoMediaId(s.companyLogoMediaId || s.reportingConfig?.organization?.companyLogoMediaId);
          }
          if (s.emailSettings?.fromEmail) setFromEmail(s.emailSettings.fromEmail);
          if (s.emailSettings?.fromName) setFromName(s.emailSettings.fromName);

          if (s.reportingConfig) {
            setConfig((prev) => ({
              ...prev,
              ...s.reportingConfig,
              pdfSettings: { ...prev.pdfSettings, ...(s.reportingConfig?.pdfSettings || {}) },
              docxSettings: { ...prev.docxSettings, ...(s.reportingConfig?.docxSettings || {}) },
              excelSettings: { ...prev.excelSettings, ...(s.reportingConfig?.excelSettings || {}) },
              requiredActivityFields: { ...prev.requiredActivityFields, ...(s.reportingConfig?.requiredActivityFields || {}) },
              exportPermissions: { ...prev.exportPermissions, ...(s.reportingConfig?.exportPermissions || {}) },
              organization: { ...prev.organization, ...(s.reportingConfig?.organization || {}) },
            }));

            if (s.reportingConfig.organization?.companyName) setCompanyName(s.reportingConfig.organization.companyName);
            if (s.reportingConfig.organization?.address) setCompanyAddress(s.reportingConfig.organization.address);
            if (s.reportingConfig.organization?.phone) setCompanyPhone(s.reportingConfig.organization.phone);
            if (s.reportingConfig.organization?.email) setCompanyEmail(s.reportingConfig.organization.email);
            if (s.reportingConfig.organization?.footerText) setReportFooterText(s.reportingConfig.organization.footerText);
          }
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    setConfig((prev) => ({
      ...prev,
      holidays: [...(prev.holidays || []), { date: newHolidayDate, name: newHolidayName.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    }));
    setNewHolidayDate('');
    setNewHolidayName('');
  };

  const handleRemoveHoliday = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((_, i) => i !== idx),
    }));
  };

  const toggleWorkingDay = (dayNum: number) => {
    setConfig((prev) => {
      const exists = prev.workingDays.includes(dayNum);
      const updated = exists ? prev.workingDays.filter((d) => d !== dayNum) : [...prev.workingDays, dayNum].sort();
      return { ...prev, workingDays: updated };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setError('Only Super Administrators have permission to modify system configuration.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Partial<SystemSettings> = {
        companyName,
        companyLogoUrl,
        ...(companyLogoKey ? { companyLogoKey } : {}),
        ...(companyLogoMediaId ? { companyLogoMediaId } : {}),
        emailSettings: {
          fromEmail,
          fromName,
        },
        reportingSettings: {
          defaultDeadline: config.submissionDeadline || '19:00',
          allowLateSubmissions: config.allowLateSubmissions,
          requirePhotos: config.requiredActivityFields.photoEvidence,
          maxPhotosPerReport: 10,
          maxVideosPerReport: 3,
          maxPhotoSizeBytes: 10 * 1024 * 1024,
          maxVideoSizeBytes: 100 * 1024 * 1024,
        },
        reminderSettings: {
          enabled: true,
          cronSchedule: '0 19 * * *',
          defaultTimezone: config.timezone || 'Asia/Kolkata',
          initialReminderDelayMinutes: 0,
          maxAttempts: 3,
          escalateToManager: true,
        },
        reportingConfig: {
          ...config,
          organization: {
            companyName,
            companyLogoUrl: companyLogoUrl || '/logo.png',
            ...(companyLogoKey ? { companyLogoKey } : {}),
            ...(companyLogoMediaId ? { companyLogoMediaId } : {}),
            address: companyAddress,
            phone: companyPhone,
            email: companyEmail,
            footerText: reportFooterText,
          },
        },
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const dayNames = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 0, label: 'Sun' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" /> Centralized Reporting & ERP Configuration
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Manage system-wide reporting policies, Excel/PDF format settings, GPS privacy controls, and holiday calendars.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Note: System configuration editing is restricted to Super Administrators. You are in read-only mode.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Centralized reporting configuration successfully updated and saved to Firestore!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sprout className="h-3.5 w-3.5" /> Organization & Branding
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reporting')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'reporting'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> Deadlines & Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" /> Working Days & Holidays
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fields')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'fields'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" /> Activity Field Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exports')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'exports'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Export & GPS Privacy
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: Organization & Branding */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sprout className="h-4 w-4 text-emerald-600" /> Organization Details & Export Header
                </CardTitle>
                <CardDescription className="text-xs">
                  Company information rendered on official PDF headers, Excel exports, and email receipts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <MediaPreview
                      src={companyLogoUrl || '/logo.png'}
                      alt={companyName}
                      variant="logo"
                      className="h-14 w-14 rounded-xl bg-white shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-xs">Organization Logo (R2 / Primary Asset)</p>
                      <p className="text-slate-500 text-[11px] truncate">
                        Automatically placed in the sidebar, generated PDF covers, Excel workbooks & DOCX headers
                      </p>
                    </div>
                  </div>
                  <MediaUpload
                    entityType="organization"
                    entityId="global"
                    isPublic={true}
                    setAsPrimary={true}
                    compact={true}
                    disabled={!isSuperAdmin}
                    label="Upload Organization Logo"
                    description="PNG, JPEG or WebP logo (recommended square or landscape high-res)"
                    currentUrl={companyLogoUrl}
                    onUploadSingle={(item) => {
                      setCompanyLogoUrl(item.url);
                      setCompanyLogoKey(item.objectKey);
                      setCompanyLogoMediaId(item.id);
                    }}
                    onError={(msg) => setError(msg)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Company Legal Name</label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="e.g. Agricart Farmers Producer Company Ltd"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Registered Head Office Address</label>
                    <Input
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="e.g. Plot 42, MIDC Dindori Road, Nashik"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Official Support Phone</label>
                    <Input
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="+91 253 2500000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Official Support Email</label>
                    <Input
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="contact@agricartfpc.in"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Report Footer Note</label>
                  <Input
                    value={reportFooterText}
                    onChange={(e) => setReportFooterText(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Agricart Farmers Producer Company Ltd • All rights reserved."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-600" /> Notification & Sender Identity
                </CardTitle>
                <CardDescription className="text-xs">
                  Resend email sender parameters for deadline alerts and invite dispatch
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Resend Verified Sender Email</label>
                  <Input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sender Name</label>
                  <Input
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: Reporting Deadlines & Operating Rules */}
        {activeTab === 'reporting' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" /> Deadlines & Timezone Policies
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage timezone calculations, daily report deadlines, and period cycle definitions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Operating Timezone</label>
                    <Select
                      value={config.timezone}
                      onChange={(e) => setConfig((p) => ({ ...p, timezone: e.target.value }))}
                      disabled={!isSuperAdmin}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Daily Report Submission Deadline</label>
                    <Input
                      type="time"
                      value={config.submissionDeadline}
                      onChange={(e) => setConfig((p) => ({ ...p, submissionDeadline: e.target.value }))}
                      disabled={!isSuperAdmin}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Monthly Reporting Cycle</label>
                    <Select
                      value={config.reportingPeriod}
                      onChange={(e) => setConfig((p) => ({ ...p, reportingPeriod: e.target.value as any }))}
                      disabled={!isSuperAdmin}
                    >
                      <option value="calendar_month">Full Calendar Month (1st to 30/31st)</option>
                      <option value="cut_off_25th">Cycle Cut-off (26th to 25th)</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="allowLate"
                      checked={config.allowLateSubmissions}
                      onChange={(e) => setConfig((p) => ({ ...p, allowLateSubmissions: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <label htmlFor="allowLate" className="font-bold text-slate-900 block cursor-pointer">
                        Allow Late Submissions
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        Staff can still finalize reports after deadline, marked with an audit "LATE" flag
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="reqAttendance"
                      checked={config.requireAttendanceForActivity}
                      onChange={(e) => setConfig((p) => ({ ...p, requireAttendanceForActivity: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <label htmlFor="reqAttendance" className="font-bold text-slate-900 block cursor-pointer">
                        Require Login (Start Day) Before Activity
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        Enforces GPS login check-in before field activity slots can be recorded
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="leaveCountsWorking"
                      checked={config.leaveCountsAsWorkingDay}
                      onChange={(e) => setConfig((p) => ({ ...p, leaveCountsAsWorkingDay: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <label htmlFor="leaveCountsWorking" className="font-bold text-slate-900 block cursor-pointer">
                        Count Approved Leave as Working Day
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        When enabled, approved leave days count towards monthly completed day quotas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="includeLeaveMissing"
                      checked={config.includeLeaveInMissingReports}
                      onChange={(e) => setConfig((p) => ({ ...p, includeLeaveInMissingReports: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <label htmlFor="includeLeaveMissing" className="font-bold text-slate-900 block cursor-pointer">
                        Flag Leave Days as Missing Reports
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        When disabled, approved leave days are clearly marked "On Leave" and excluded from missing metrics
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: Working Days & Holidays */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" /> Standard Working Days
                </CardTitle>
                <CardDescription className="text-xs">
                  Days of the week expected for field operations. Unchecked days are marked as Weekly Off.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {dayNames.map((d) => {
                    const isWorking = config.workingDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleWorkingDay(d.num)}
                        disabled={!isSuperAdmin}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                          isWorking
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {d.label} {isWorking ? '✓' : '(Off)'}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Note: Sundays are designated as Weekly Off by default. Employees are not flagged as Missing on weekly off days.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" /> Official Holidays Calendar ({config.holidays?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">
                  Holidays are automatically marked on monthly reports and excluded from missing report alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {isSuperAdmin && (
                  <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <Input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full sm:w-44 text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Holiday Name (e.g. Republic Day)"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      onClick={handleAddHoliday}
                      disabled={!newHolidayDate || !newHolidayName.trim()}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 px-4 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Holiday
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {config.holidays && config.holidays.length > 0 ? (
                    config.holidays.map((h, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {h.date}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">{h.name}</span>
                        </div>
                        {isSuperAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveHoliday(idx)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic py-2">No official holidays added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: Activity Field Rules */}
        {activeTab === 'fields' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" /> Mandatory Fields for Field Activities
                </CardTitle>
                <CardDescription className="text-xs">
                  Control which activity fields must be filled by employees before completing an activity slot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="reqFarmer"
                      checked={config.requiredActivityFields.farmerName}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          requiredActivityFields: { ...p.requiredActivityFields, farmerName: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="reqFarmer" className="font-bold text-slate-900 block cursor-pointer">
                        Farmer / Beneficiary Name
                      </label>
                      <p className="text-slate-500 text-[11px]">Mandatory for individual farmer visits</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="reqVillage"
                      checked={config.requiredActivityFields.village}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          requiredActivityFields: { ...p.requiredActivityFields, village: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="reqVillage" className="font-bold text-slate-900 block cursor-pointer">
                        Village & Wadi
                      </label>
                      <p className="text-slate-500 text-[11px]">Mandatory for all field-based community activities</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="reqObs"
                      checked={config.requiredActivityFields.observations}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          requiredActivityFields: { ...p.requiredActivityFields, observations: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="reqObs" className="font-bold text-slate-900 block cursor-pointer">
                        Observations & Key Issues
                      </label>
                      <p className="text-slate-500 text-[11px]">Requires staff to summarize what transpired</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="reqPhoto"
                      checked={config.requiredActivityFields.photoEvidence}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          requiredActivityFields: { ...p.requiredActivityFields, photoEvidence: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="reqPhoto" className="font-bold text-slate-900 block cursor-pointer">
                        Geotagged Photo Evidence
                      </label>
                      <p className="text-slate-500 text-[11px]">Mandatory photographic proof before slot completion</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Daily Activity Slot Limit</label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={config.maxDailyActivitySlots}
                        onChange={(e) =>
                          setConfig((p) => ({ ...p, maxDailyActivitySlots: parseInt(e.target.value, 10) || 20 }))
                        }
                        disabled={!isSuperAdmin}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Default: 20 slots maximum per working day</p>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Minimum Activities Expected Per Day</label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={config.minActivitiesPerDay}
                        onChange={(e) =>
                          setConfig((p) => ({ ...p, minActivitiesPerDay: parseInt(e.target.value, 10) || 1 }))
                        }
                        disabled={!isSuperAdmin}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Used to measure daily report completeness</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 5: Export & GPS Privacy */}
        {activeTab === 'exports' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" /> GPS Visibility & Privacy Controls
                </CardTitle>
                <CardDescription className="text-xs">
                  Define how device geolocations are shown to administrators and included in export packages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="gpsVisibleAdmin"
                      checked={config.gpsVisibleToAdmin}
                      onChange={(e) => setConfig((p) => ({ ...p, gpsVisibleToAdmin: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="gpsVisibleAdmin" className="font-bold text-slate-900 block cursor-pointer">
                        Employee GPS Visible to Admin / Managers
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        Allows management to view device coordinates and Google Maps pin locations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="incGpsExport"
                      checked={config.includeGpsInExports}
                      onChange={(e) => setConfig((p) => ({ ...p, includeGpsInExports: e.target.checked }))}
                      disabled={!isSuperAdmin}
                      className="mt-1 h-4 w-4 rounded text-emerald-600"
                    />
                    <div>
                      <label htmlFor="incGpsExport" className="font-bold text-slate-900 block cursor-pointer">
                        Include GPS Data in Excel Workbooks
                      </label>
                      <p className="text-slate-500 text-[11px]">
                        Exports start and end location names and coordinates into Sheet 3 and Sheet 4
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Staff Export Permissions
                </CardTitle>
                <CardDescription className="text-xs">
                  Control which export formats standard staff employees can download directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="staffExcel"
                      checked={config.exportPermissions.allowStaffExcelExport}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          exportPermissions: { ...p.exportPermissions, allowStaffExcelExport: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <label htmlFor="staffExcel" className="font-bold text-slate-800 cursor-pointer text-xs">
                      Allow Excel (.xlsx) Export
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="staffPdf"
                      checked={config.exportPermissions.allowStaffPdfExport}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          exportPermissions: { ...p.exportPermissions, allowStaffPdfExport: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <label htmlFor="staffPdf" className="font-bold text-slate-800 cursor-pointer text-xs">
                      Allow PDF (.pdf) Export
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <input
                      type="checkbox"
                      id="staffDocx"
                      checked={config.exportPermissions.allowStaffDocxExport}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          exportPermissions: { ...p.exportPermissions, allowStaffDocxExport: e.target.checked },
                        }))
                      }
                      disabled={!isSuperAdmin}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <label htmlFor="staffDocx" className="font-bold text-slate-800 cursor-pointer text-xs">
                      Allow Word (.docx) Export
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isSuperAdmin && (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-10 shadow-sm"
            >
              <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Configuration Settings'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
