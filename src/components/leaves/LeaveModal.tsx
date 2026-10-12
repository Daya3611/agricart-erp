'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, User, Building2, MapPin, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LeaveType, UserProfile } from '@/types';
import { calculateLeaveDays } from '@/lib/utils/leave';

interface LeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  employees: UserProfile[];
  preselectedStaffUid?: string;
  onSuccess?: () => void;
}

export function LeaveModal({
  open,
  onOpenChange,
  currentUser,
  employees,
  preselectedStaffUid,
  onSuccess,
}: LeaveModalProps) {
  const isStaffOnly = currentUser.role === 'staff';

  const [selectedStaffUid, setSelectedStaffUid] = useState<string>(
    preselectedStaffUid || (isStaffOnly ? currentUser.uid : '')
  );
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
  const [reason, setReason] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-select staff user if provided
  useEffect(() => {
    if (preselectedStaffUid) {
      setSelectedStaffUid(preselectedStaffUid);
    } else if (isStaffOnly) {
      setSelectedStaffUid(currentUser.uid);
    } else if (!selectedStaffUid && employees.length > 0) {
      setSelectedStaffUid(employees[0].uid);
    }
  }, [preselectedStaffUid, isStaffOnly, currentUser.uid, employees]);

  // Selected employee metadata
  const selectedEmp = employees.find((e) => e.uid === selectedStaffUid) || (isStaffOnly ? currentUser : null);

  // Auto-set end date equal to start date if half day
  useEffect(() => {
    if (isHalfDay && startDate) {
      setEndDate(startDate);
    }
  }, [isHalfDay, startDate]);

  const daysCount = calculateLeaveDays(startDate, endDate, isHalfDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedStaffUid) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please select both start date and end date.');
      return;
    }
    if (endDate < startDate) {
      setErrorMsg('End date cannot be earlier than start date.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg('Please provide a reason for the leave request (min 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffUid: selectedStaffUid,
          leaveType,
          startDate,
          endDate,
          isHalfDay,
          halfDayType: isHalfDay ? halfDayType : undefined,
          reason,
          attachmentUrl: attachmentUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit leave request.');
      }

      setSuccessMsg('✅ Leave record successfully created and placed in pending queue!');
      setTimeout(() => {
        onOpenChange(false);
        setReason('');
        setStartDate('');
        setEndDate('');
        setIsHalfDay(false);
        setSuccessMsg(null);
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create / Request Leave Record"
      description="Record an official employee absence for approval and monthly report tracking"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Employee Selection */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Select Employee *</label>
          {isStaffOnly ? (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 font-bold text-slate-800">
              <User className="h-4 w-4 text-emerald-600" />
              <span>
                {currentUser.fullName} ({currentUser.employeeId})
              </span>
            </div>
          ) : (
            <Select
              value={selectedStaffUid}
              onChange={(e) => setSelectedStaffUid(e.target.value)}
              className="rounded-xl"
              required
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.uid} value={emp.uid}>
                  {emp.fullName} ({emp.employeeId}) - {emp.departmentName || 'Field Ops'}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Department and Center Auto-populated display */}
        {selectedEmp && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/80">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Department</span>
                <span className="text-xs font-bold text-slate-900">{selectedEmp.departmentName || 'Field Operations'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Assigned Center</span>
                <span className="text-xs font-bold text-slate-900">
                  {selectedEmp.assignedCenterNames?.[0] || 'Nashik Center'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Leave Type */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Leave Type *</label>
          <Select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            className="rounded-xl"
            required
          >
            <option value="casual">Casual Leave (CL)</option>
            <option value="sick">Sick / Medical Leave (SL)</option>
            <option value="earned">Earned / Paid Leave (EL)</option>
            <option value="unpaid">Loss of Pay / Unpaid (LWP)</option>
            <option value="half_day">Half-Day Leave</option>
            <option value="compensatory">Compensatory Off (Comp-Off)</option>
            <option value="maternity">Maternity Leave</option>
            <option value="paternity">Paternity Leave</option>
            <option value="other">Other Official Absence</option>
          </Select>
        </div>

        {/* Half day toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
            <input
              type="checkbox"
              checked={isHalfDay}
              onChange={(e) => setIsHalfDay(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span>Apply as Half-Day Leave (0.5 Day)</span>
          </label>

          {isHalfDay && (
            <select
              value={halfDayType}
              onChange={(e) => setHalfDayType(e.target.value as any)}
              className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800"
            >
              <option value="first_half">First Half (Morning)</option>
              <option value="second_half">Second Half (Afternoon)</option>
            </select>
          )}
        </div>

        {/* 3. Dates & Duration Calculation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Start Date *</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">End Date *</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isHalfDay}
              required
            />
          </div>
        </div>

        {/* Duration badge */}
        {daysCount > 0 && (
          <div className="p-2.5 bg-emerald-100/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-950">
            <span>Calculated Duration:</span>
            <span className="text-sm font-black text-emerald-800">
              {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
            </span>
          </div>
        )}

        {/* 4. Reason */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Reason / Remarks *</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the purpose or medical/personal reason for this leave..."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
        </div>

        {/* 5. Supporting Document URL */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Supporting Document URL (Optional)</label>
          <Input
            type="url"
            placeholder="https://... (medical certificate or permission letter)"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          >
            {submitting ? 'Saving...' : 'Submit Leave for Approval'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
