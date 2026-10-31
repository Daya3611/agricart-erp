'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  KeyRound,
  Copy,
  Check,
  FileText,
  Edit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';

interface EmployeeInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: UserProfile | null;
  canEdit?: boolean;
  onEdit?: (staff: UserProfile) => void;
  onViewReports?: (staff: UserProfile) => void;
}

export function EmployeeInfoModal({
  open,
  onOpenChange,
  staff: initialStaff,
  canEdit = false,
  onEdit,
  onViewReports,
}: EmployeeInfoModalProps) {
  const [employee, setEmployee] = useState<UserProfile | null>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync state with prop and fetch fresh profile from API
  useEffect(() => {
    if (!initialStaff || !open) return;
    setEmployee(initialStaff);

    let isMounted = true;
    setLoading(true);

    fetch(`/api/staff/${initialStaff.uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.user) {
          setEmployee(data.user);
        }
      })
      .catch((err) => {
        console.warn('Failed to load fresh employee details:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialStaff?.uid, open]);

  if (!employee) return null;

  const roleBadges: Record<UserRole, { label: string; variant: 'default' | 'info' | 'purple' | 'secondary' }> = {
    super_admin: { label: 'Super Admin', variant: 'default' },
    admin: { label: 'Administrator', variant: 'info' },
    manager: { label: 'Dept Head', variant: 'purple' },
    staff: { label: 'Staff Officer', variant: 'secondary' },
  };

  const badgeInfo = roleBadges[employee.role] || { label: employee.role, variant: 'secondary' };
  const initials = employee.fullName
    ? employee.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AG';

  const isDeactivated = employee.accountStatus === 'deactivated';
  const invitationStatus = (employee as any).invitationStatus || 'pending';
  const lastLogin = (employee as any).lastLogin;
  const authCreatedAt = (employee as any).authCreatedAt || employee.createdAt;
  const photoURL = (employee as any).photoURL;
  const address = (employee as any).address;
  const employmentType = (employee as any).employmentType || 'Regular / Full-time';
  const workScheduleName = (employee as any).workScheduleName || (employee as any).workScheduleId || 'Standard Field Shift';

  const handleCopyUid = () => {
    if (!employee.uid) return;
    navigator.clipboard.writeText(employee.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Employee Information"
      description={`Official personnel record for ${employee.fullName}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* Header Hero Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {photoURL ? (
              <img
                src={photoURL}
                alt={employee.fullName}
                className="h-14 w-14 rounded-full object-cover border-2 border-emerald-600 shadow-2xs shrink-0"
              />
            ) : (
              <Avatar className="h-14 w-14 bg-emerald-700 text-white font-black text-base shadow-2xs shrink-0">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  {employee.fullName}
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                  {employee.employeeId || 'ID Pending'}
                </span>
              </div>

              <p className="text-slate-500 font-medium text-xs mt-0.5 truncate">
                {employee.designation || 'Staff Member'} • {employee.departmentName || 'Field Operations'}
              </p>
            </div>
          </div>

          {/* Badges Stack */}
          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
            <div className="flex items-center gap-1.5">
              <Badge variant={badgeInfo.variant} className="text-[10px] font-bold uppercase">
                {badgeInfo.label}
              </Badge>
              <Badge
                variant={isDeactivated ? 'destructive' : 'default'}
                className="text-[10px] font-bold uppercase"
              >
                {isDeactivated ? (
                  <>
                    <XCircle className="h-3 w-3 mr-1" /> Deactivated
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                  </>
                )}
              </Badge>
            </div>

            <Badge
              variant={
                invitationStatus === 'accepted'
                  ? 'default'
                  : invitationStatus === 'sent'
                  ? 'info'
                  : 'secondary'
              }
              className="text-[10px] font-medium"
            >
              Invite: {invitationStatus.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Section 1: Profile & Personal Details */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600 shrink-0" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Profile & Personal Details
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Full Legal Name
              </span>
              <span className="font-bold text-slate-900 text-xs">{employee.fullName}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Employee Identification
              </span>
              <span className="font-mono font-bold text-emerald-800 text-xs">{employee.employeeId}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Designation / Position
              </span>
              <span className="font-semibold text-slate-800 text-xs">{employee.designation || 'Not provided'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                System Role
              </span>
              <span className="font-semibold text-slate-800 capitalize text-xs">
                {employee.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Employment & Operational Assignment */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Employment & Organizational Assignment
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Assigned Department
              </span>
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{employee.departmentName || 'Field Operations & Procurement'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Assigned Center / Hub
              </span>
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>
                  {employee.assignedCenterNames && employee.assignedCenterNames.length > 0
                    ? employee.assignedCenterNames.join(', ')
                    : 'Nashik Main Operations Center'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Joining Date
              </span>
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>
                  {employee.joiningDate ? formatReadableDate(employee.joiningDate) : 'Not provided'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Employment Type
              </span>
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{employmentType}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Reporting Manager
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {employee.reportingManagerName || 'Executive Administration'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Work Schedule Policy
              </span>
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{workScheduleName}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 3: Contact Details */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-emerald-600 shrink-0" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Contact Information
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Official Email Address
              </span>
              <a
                href={`mailto:${employee.email}`}
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1.5 text-xs truncate"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </a>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Mobile / Contact Number
              </span>
              {employee.phone ? (
                <a
                  href={`tel:${employee.phone}`}
                  className="font-bold text-slate-900 hover:text-emerald-700 flex items-center gap-1.5 text-xs"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>{employee.phone}</span>
                </a>
              ) : (
                <span className="text-slate-400 font-medium text-xs">Not provided</span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Emergency Contact
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {employee.emergencyContact || 'Not provided'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Residential / Operational Address
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {address || 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 4: Account & Security Information */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-600 shrink-0" />
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Account & Security Information
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Firebase Account UID
              </span>
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <code className="font-mono text-[11px] text-slate-800 truncate select-all">
                  {employee.uid}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors shrink-0"
                  title="Copy UID"
                  aria-label="Copy UID"
                >
                  {copiedUid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Account Created Date
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {authCreatedAt ? formatReadableDateTime(authCreatedAt) : 'Not available'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Profile Last Updated
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {employee.updatedAt ? formatReadableDateTime(employee.updatedAt) : 'Not recorded'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Last Portal Sign-In
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>
                  {lastLogin ? formatReadableDateTime(lastLogin) : 'No recorded sign-in session'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Account Status
              </span>
              <span className="font-bold text-slate-800 uppercase text-xs">
                {employee.accountStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Additional Notes / Bio if present */}
        {employee.bio && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Additional Notes / Profile Bio
              </span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 italic text-xs leading-relaxed">
                "{employee.bio}"
              </div>
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div>
            {onViewReports ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onViewReports(employee);
                }}
                className="w-full sm:w-auto h-9 font-bold text-xs text-slate-700 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                <span>View Reports & Compliance</span>
              </Button>
            ) : (
              <Link href={`/admin/reports?staffUid=${employee.uid}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-9 font-bold text-xs text-slate-700 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  <span>View Reports & Activity</span>
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-9 font-bold text-xs"
            >
              Close
            </Button>

            {canEdit && onEdit && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(employee);
                }}
                className="flex-1 sm:flex-none h-9 font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                <span>Edit Employee</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
