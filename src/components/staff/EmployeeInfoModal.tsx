'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Building2,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Shield,
  Briefcase,
  AlertCircle,
  Clock,
  KeyRound,
  FileText,
  Edit,
  Send,
  UserCheck,
  UserX,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';
import { cn } from '@/lib/utils/cn';

interface EmployeeInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: UserProfile | null;
  canEdit?: boolean;
  onEdit?: (staff: UserProfile) => void;
  onViewCompliance?: (staff: UserProfile) => void;
}

export function EmployeeInfoModal({
  open,
  onOpenChange,
  staff,
  canEdit = true,
  onEdit,
  onViewCompliance,
}: EmployeeInfoModalProps) {
  const [employeeData, setEmployeeData] = useState<UserProfile | null>(staff);
  const [loading, setLoading] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync initial staff prop and fetch freshest document from erp_emp via /api/staff/[id]
  useEffect(() => {
    if (!open || !staff?.uid) {
      setEmployeeData(staff);
      return;
    }

    setEmployeeData(staff);
    let isMounted = true;

    async function loadFreshDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/staff/${staff?.uid}`);
        const data = await res.json();
        if (isMounted && res.ok && data.success && data.user) {
          setEmployeeData(data.user);
        }
      } catch (err) {
        console.warn('Could not refresh full employee record:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFreshDetails();

    return () => {
      isMounted = false;
    };
  }, [open, staff]);

  if (!staff && !employeeData) return null;

  const current = employeeData || staff!;
  const initials = current.fullName
    ? current.fullName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AG';

  const isDeactivated = current.accountStatus === 'deactivated';
  const invitationStatus = (current as any).invitationStatus || 'pending';

  const roleConfig: Record<string, { label: string; badgeVariant: 'default' | 'info' | 'purple' | 'secondary' }> = {
    super_admin: { label: 'Super Admin', badgeVariant: 'default' },
    admin: { label: 'Administrator', badgeVariant: 'info' },
    manager: { label: 'Department Head', badgeVariant: 'purple' },
    staff: { label: 'Staff Member', badgeVariant: 'secondary' },
  };

  const currentRole = roleConfig[current.role] || {
    label: current.role.replace('_', ' ').toUpperCase(),
    badgeVariant: 'secondary',
  };

  const handleCopyUid = () => {
    if (!current.uid) return;
    navigator.clipboard.writeText(current.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const avatarUrl = (current as any).avatarUrl || (current as any).photoUrl;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Employee Information"
      description={`Official personnel record for ${current.fullName} (${current.employeeId})`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* Top Profile Summary Card */}
        <div className="p-4 bg-slate-50 dark:bg-card/70 rounded-2xl border border-slate-200/90 dark:border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={current.fullName}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-600/30 shadow-2xs"
                />
              ) : (
                <Avatar className="h-14 w-14 bg-emerald-700 text-white font-black text-lg ring-2 ring-emerald-600/30">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              )}
              <span
                className={cn(
                  'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-card',
                  isDeactivated ? 'bg-rose-500' : 'bg-emerald-500'
                )}
                title={isDeactivated ? 'Deactivated' : 'Active Account'}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-foreground truncate">
                  {current.fullName}
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                  {current.employeeId}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-muted-foreground mt-0.5 truncate">
                {current.designation || 'Field Officer'} • {current.departmentName || 'Field Operations'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-0.5">
                {current.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0 self-stretch sm:self-auto justify-between border-t sm:border-t-0 border-slate-200/80 pt-2 sm:pt-0">
            <Badge variant={currentRole.badgeVariant} className="text-xs font-bold">
              {currentRole.label}
            </Badge>
            <Badge variant={isDeactivated ? 'secondary' : 'default'} className="text-xs font-bold">
              {current.accountStatus.toUpperCase()}
            </Badge>
            {invitationStatus && (
              <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-semibold">
                Invitation: <span className="capitalize text-slate-700 dark:text-foreground font-bold">{invitationStatus}</span>
              </span>
            )}
          </div>
        </div>

        {/* Section 1: Employment Information */}
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-border/60 pb-2">
            <Briefcase className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-foreground">
              Employment Information
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Assigned Department
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-foreground">
                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>{current.departmentName || 'Field Operations'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Assigned Operational Center
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-foreground">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  {current.assignedCenterNames && current.assignedCenterNames.length > 0
                    ? current.assignedCenterNames.join(', ')
                    : 'Nashik Main Hub'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Official Designation
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {current.designation || 'Field Officer'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Joining Date
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{current.joiningDate ? formatReadableDate(current.joiningDate) : 'Not provided'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Reporting Manager
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {current.reportingManagerName || (current.reportingManagerUid ? 'Assigned' : 'None assigned')}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Employment Type
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {(current as any).employmentType || 'Permanent / Full-Time'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-border/60 pb-2">
            <Mail className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-foreground">
              Contact Details
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Email Address
              </span>
              <a
                href={`mailto:${current.email}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{current.email}</span>
              </a>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Mobile Number
              </span>
              {current.phone ? (
                <a
                  href={`tel:${current.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:text-emerald-700 dark:text-slate-200"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>{current.phone}</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Not provided</span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Emergency Contact
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {current.emergencyContact || 'Not provided'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Residential / Work Address
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {(current as any).address || 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Account & System Information */}
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-border/60 pb-2">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-foreground">
              Account & System Information
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Firebase Account UID
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-muted/60 px-2 py-1 rounded-md border border-slate-200/80 dark:border-border">
                <span className="truncate">{current.uid}</span>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-foreground shrink-0 p-0.5"
                  title="Copy UID"
                  aria-label="Copy UID"
                >
                  {copiedUid ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Invitation Status
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={
                    invitationStatus === 'accepted'
                      ? 'default'
                      : invitationStatus === 'sent'
                        ? 'info'
                        : 'secondary'
                  }
                  className="text-[10px] uppercase font-bold"
                >
                  {invitationStatus}
                </Badge>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Account Created Date
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {current.createdAt ? formatReadableDateTime(current.createdAt) : 'Not recorded'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Last Profile Update
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {current.updatedAt ? formatReadableDateTime(current.updatedAt) : 'Not recorded'}
              </span>
            </div>

            {(current as any).lastLoginAt && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Last Login
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {formatReadableDateTime((current as any).lastLoginAt)}
                </span>
              </div>
            )}

            {current.workScheduleId && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Reporting Schedule
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {current.workScheduleId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Bio / Additional Notes (if stored) */}
        {current.bio && (
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border p-4 shadow-2xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Bio / Personnel Notes
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic bg-slate-50 dark:bg-muted/40 p-3 rounded-xl border border-slate-100 dark:border-border">
              "{current.bio}"
            </p>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="pt-3 border-t border-slate-200/90 dark:border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {onViewCompliance && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onViewCompliance(current);
                }}
                className="text-xs font-bold h-9 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-200/90 w-full sm:w-auto"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                <span>View Reports & Compliance</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            {canEdit && onEdit && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(current);
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold h-9 rounded-xl shadow-2xs w-full sm:w-auto"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                <span>Edit Employee</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold h-9 rounded-xl w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

