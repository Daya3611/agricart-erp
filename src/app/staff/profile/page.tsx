'use client';

import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, Building2, MapPin, Calendar, Clock, Shield, Save, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function StaffProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/staff/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setPhone(data.user.phone || '');
          setEmergencyContact(data.user.emergencyContact || '');
          setBio(data.user.bio || '');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleUpdatePermittedProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, emergencyContact, bio }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile information.');
      }

      setUser(data.user);
      setSuccessMsg('✅ Profile contact information updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading user profile...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-emerald-600" /> My Employee Profile
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Verified Agricart FPC staff account credentials and department assignments.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xl shadow-md shadow-emerald-600/20">
            {user.fullName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">{user.fullName}</CardTitle>
            <CardDescription className="text-xs text-emerald-700 font-bold">
              {user.designation} • {user.employeeId}
            </CardDescription>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-[10px]">
                ACCOUNT {user.accountStatus.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-700">
                ROLE: {user.role}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Editable Permitted Profile Fields Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-slate-900">Contact Information (Editable)</CardTitle>
          <CardDescription>You can update your personal contact and biographical details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePermittedProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Phone Number</label>
                <Input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency Contact Number</label>
                <Input
                  type="text"
                  placeholder="+91 98765 00000"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Personal Bio & Notes</label>
              <textarea
                rows={3}
                placeholder="Optional notes or cluster details..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Saving...' : 'Update Contact Information'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Protected Administrative Profile Fields */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-slate-500" /> Administrative & Operational Assignments
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] font-bold text-slate-600">
              Admin Protected
            </Badge>
          </div>
          <CardDescription>
            These official assignments are managed directly by your system administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs divide-y divide-slate-200/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-slate-500 font-medium block">Official Email Address</span>
              <span className="font-bold text-slate-900">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Employee Identification</span>
              <span className="font-bold text-slate-900">{user.employeeId}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Department Assignment</span>
              <span className="font-bold text-slate-900">{user.departmentName || 'Field Operations'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Assigned Center / Hub</span>
              <span className="font-bold text-slate-900">{user.assignedCenterNames?.[0] || 'Nashik Center'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div>
              <span className="text-slate-500 font-medium block">Reporting Manager</span>
              <span className="font-bold text-slate-900">{user.reportingManagerName || 'Operations Head'}</span>
            </div>
            {/* <div>
              <span className="text-slate-500 font-medium block">Official Joining Date</span>
              <span className="font-bold text-slate-900">{user.joiningDate}</span>
            </div> */}
            <div>
              <span className="text-slate-500 font-medium block">Daily Reporting Deadline</span>
              <span className="font-bold text-emerald-700">07:00 PM Daily (Asia/Kolkata)</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Account Status</span>
              <span className="font-bold text-slate-900 capitalize">{user.accountStatus}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
