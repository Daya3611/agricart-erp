'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Settings, Save, Clock, Mail, Shield, Sprout, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { UserProfile, SystemSettings } from '@/types';

export default function AdminSettingsPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [companyName, setCompanyName] = useState('Agricart Farmers Producer Company Ltd');
  const [defaultDeadline, setDefaultDeadline] = useState('19:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [maxPhotos, setMaxPhotos] = useState('10');
  const [maxVideos, setMaxVideos] = useState('3');
  const [fromEmail, setFromEmail] = useState('erp@agricartfpc.in');
  const [fromName, setFromName] = useState('Agricart FPC ERP');
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
          if (s.reportingSettings?.defaultDeadline) setDefaultDeadline(s.reportingSettings.defaultDeadline);
          if (s.reminderSettings?.defaultTimezone) setTimezone(s.reminderSettings.defaultTimezone);
          if (s.reportingSettings?.maxPhotosPerReport) setMaxPhotos(String(s.reportingSettings.maxPhotosPerReport));
          if (s.reportingSettings?.maxVideosPerReport) setMaxVideos(String(s.reportingSettings.maxVideosPerReport));
          if (s.emailSettings?.fromEmail) setFromEmail(s.emailSettings.fromEmail);
          if (s.emailSettings?.fromName) setFromName(s.emailSettings.fromName);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setError('Only Super Administrators have permission to modify system configuration.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          reportingSettings: {
            defaultDeadline,
            allowLateSubmissions: true,
            requirePhotos: true,
            maxPhotosPerReport: Number(maxPhotos) || 10,
            maxVideosPerReport: Number(maxVideos) || 3,
            maxPhotoSizeBytes: 10 * 1024 * 1024,
            maxVideoSizeBytes: 100 * 1024 * 1024,
          },
          reminderSettings: {
            enabled: true,
            cronSchedule: '0 19 * * *',
            defaultTimezone: timezone,
            initialReminderDelayMinutes: 0,
            maxAttempts: 3,
            escalateToManager: true,
          },
          emailSettings: {
            fromEmail,
            fromName,
          },
        }),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" /> System & Reporting Settings
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Configure company branding, daily reporting deadlines, Resend sender details, and automatic reminder policies.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Note: System-level configuration editing is restricted to Super Administrators. You are currently viewing in read-only mode.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>System configuration saved successfully to Firestore!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600" /> Company Profile & Branding
            </CardTitle>
            <CardDescription>Agricart FPC organizational profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center gap-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
              <div className="relative h-14 w-14 shrink-0 bg-white rounded-xl border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
                <Image
                  src="/logo.png"
                  alt="Agricart Official Logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Official Organization Logo</p>
                <p className="text-slate-500 text-xs">Agricart Farmers Producer Company Limited (/logo.png)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company Legal Name</label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Operating Timezone</label>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Reporting Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" /> Daily Reporting Rules & Media Limits
            </CardTitle>
            <CardDescription>Set employee report submission deadlines and file attachment rules</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Daily Reporting Deadline</label>
              <Input
                type="time"
                value={defaultDeadline}
                onChange={(e) => setDefaultDeadline(e.target.value)}
                disabled={!isSuperAdmin}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Max Photo Attachments per Report</label>
              <Input
                type="number"
                value={maxPhotos}
                onChange={(e) => setMaxPhotos(e.target.value)}
                disabled={!isSuperAdmin}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Max Video Attachments per Report</label>
              <Input
                type="number"
                value={maxVideos}
                onChange={(e) => setMaxVideos(e.target.value)}
                disabled={!isSuperAdmin}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resend Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-600" /> Resend Transactional Email Settings
            </CardTitle>
            <CardDescription>Configure sender identity for invitation and reminder emails</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
            >
              <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Configuration Settings'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
