'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, Department, Center, UserRole } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sparkles, Calendar, Clock, Shield, Building, MapPin } from 'lucide-react';

interface StaffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffToEdit?: UserProfile | null;
  departments: Department[];
  centers: Center[];
  managers: UserProfile[];
  onSuccess: () => void;
}

export function StaffFormModal({
  open,
  onOpenChange,
  staffToEdit,
  departments,
  centers,
  managers,
  onSuccess,
}: StaffFormModalProps) {
  const isEditing = Boolean(staffToEdit);

  const [fullName, setFullName] = useState(staffToEdit?.fullName || '');
  const [employeeId, setEmployeeId] = useState(staffToEdit?.employeeId || '');
  const [email, setEmail] = useState(staffToEdit?.email || '');
  const [phone, setPhone] = useState(staffToEdit?.phone || '');
  const [designation, setDesignation] = useState(staffToEdit?.designation || 'Field Officer');
  const [role, setRole] = useState<UserRole>(staffToEdit?.role || 'staff');
  const [departmentId, setDepartmentId] = useState(staffToEdit?.departmentId || (departments[0]?.id || ''));
  const [selectedCenterId, setSelectedCenterId] = useState(staffToEdit?.assignedCenterIds?.[0] || (centers[0]?.id || ''));
  const [reportingManagerUid, setReportingManagerUid] = useState(staffToEdit?.reportingManagerUid || '');
  const [workScheduleId, setWorkScheduleId] = useState((staffToEdit as any)?.workScheduleId || 'sched_standard');
  const [joiningDate, setJoiningDate] = useState((staffToEdit as any)?.joiningDate || new Date().toISOString().split('T')[0]);
  const [accountStatus, setAccountStatus] = useState(staffToEdit?.accountStatus || 'active');

  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const res = await fetch('/api/work-schedules');
        const data = await res.json();
        if (data.schedules) {
          setWorkSchedules(data.schedules);
        }
      } catch (err) {
        console.warn('Failed to fetch work schedules:', err);
      }
    }
    loadSchedules();
  }, []);

  const handleGenerateId = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setEmployeeId(`AGRI-EMP-${randomSuffix}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      setError('Please fill out all required fields (Full Name, Email).');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      fullName,
      employeeId: employeeId.trim() || undefined,
      email,
      phone,
      designation,
      role,
      departmentId,
      assignedCenterIds: selectedCenterId ? [selectedCenterId] : [],
      reportingManagerUid: reportingManagerUid || undefined,
      workScheduleId: workScheduleId || 'sched_standard',
      joiningDate: joiningDate || null,
      accountStatus,
    };

    try {
      const endpoint = staffToEdit?.uid ? `/api/staff/${staffToEdit.uid}` : '/api/staff';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save employee profile.');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing && staffToEdit ? `Edit Employee - ${staffToEdit.fullName}` : 'Register New Employee (erp_emp)'}
      description={
        isEditing
          ? 'Update employee profile details, assignments, and reporting settings.'
          : 'Creates Firebase Auth account, assigns unique employee ID, stores in erp_emp, and sends email invitation.'
      }
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Verma"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                Employee ID {isEditing ? '(Locked)' : '(Auto or Custom)'}
              </label>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleGenerateId}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5"
                >
                  <Sparkles className="h-3 w-3" /> Auto-Suggest
                </button>
              )}
            </div>
            <Input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              placeholder={isEditing ? employeeId : 'Leave blank for auto AGRI-EMP-XXXX'}
              disabled={isEditing}
              className={isEditing ? 'bg-slate-100 text-slate-500 font-mono' : 'font-mono'}
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Official Email Address *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@agricartfpc.org"
              disabled={isEditing}
              className={isEditing ? 'bg-slate-100 text-slate-500' : ''}
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Mobile Phone Number</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Designation</label>
            <Input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Procurement Officer"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">ERP Role</label>
            <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="staff">Staff</option>
              <option value="manager">Department Head / Manager</option>
              <option value="admin">Administrator</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Assigned Center / Hub</label>
            <Select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)}>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Reporting Manager</label>
            <Select value={reportingManagerUid} onChange={(e) => setReportingManagerUid(e.target.value)}>
              <option value="">None / Self Managed</option>
              {managers
                .filter((m) => m.uid !== staffToEdit?.uid)
                .map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.fullName} ({m.role.toUpperCase()})
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Work Schedule (erp_work_schedules)</label>
            <Select value={workScheduleId} onChange={(e) => setWorkScheduleId(e.target.value)}>
              <option value="sched_standard">Standard Operations (Mon-Sat, 7:00 PM Cutoff)</option>
              {workSchedules
                .filter((s) => s.id !== 'sched_standard')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.dailyCutoffTime})
                  </option>
                ))}
            </Select>
          </div>

          {/* <div>
            <label className="font-bold text-slate-700 block mb-1">Joining Date</label>
            <Input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </div> */}

          {isEditing && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Account Status</label>
              <Select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value as any)}>
                <option value="active">Active (Access Allowed)</option>
                <option value="deactivated">Deactivated (Access Blocked)</option>
              </Select>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {loading ? 'Processing...' : isEditing ? 'Save Changes' : 'Create Employee & Send Invite'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
