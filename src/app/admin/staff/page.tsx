'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Users,
  Mail,
  Edit,
  Trash2,
  Search,
  Shield,
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  KeyRound,
  Send,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  FileText,
  Calendar,
  MoreVertical,
  BarChart3,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { UserProfile, Department, Center } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { StaffFormModal } from '@/components/staff/StaffFormModal';
import { EmployeeInfoModal } from '@/components/staff/EmployeeInfoModal';

export default function AdminStaffManagementPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedCenterFilter, setSelectedCenterFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<UserProfile | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete User Modal State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // Employee Information Modal
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedStaffForInfo, setSelectedStaffForInfo] = useState<UserProfile | null>(null);

  // Compliance & History View Modal
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [selectedStaffForCompliance, setSelectedStaffForCompliance] = useState<UserProfile | null>(null);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setCurrentUser(sessData.user);

      const params = new URLSearchParams({
        search: searchQuery,
        role: selectedRoleFilter,
        departmentId: selectedDeptFilter,
        centerId: selectedCenterFilter,
        status: selectedStatusFilter,
        sortBy,
        sortOrder,
        page: currentPage.toString(),
        limit: '15',
      });

      const res = await fetch(`/api/staff?${params.toString()}`);
      const data = await res.json();
      if (data.users) {
        setStaffList(data.users);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }

      if (departments.length === 0) {
        const deptRes = await fetch('/api/departments');
        const deptData = await deptRes.json();
        if (deptData.departments) setDepartments(deptData.departments);
      }

      if (centers.length === 0) {
        const centerRes = await fetch('/api/centers');
        const centerData = await centerRes.json();
        if (centerData.centers) setCenters(centerData.centers);
      }
    } catch (err: any) {
      console.error('Failed to load staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, [searchQuery, selectedRoleFilter, selectedDeptFilter, selectedCenterFilter, selectedStatusFilter, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setNotification({ type, message });
    notificationTimerRef.current = setTimeout(() => setNotification(null), 5000);
  };

  const getStaffRowMeta = (staff: UserProfile) => {
    const viewerIsSuperAdmin = currentUser?.role === 'super_admin';
    const isSelf = Boolean(currentUser?.uid && staff.uid === currentUser.uid);
    const isProtectedSuperAdmin = staff.role === 'super_admin';
    const canEditThisStaff = viewerIsSuperAdmin || (staff.role !== 'admin' && staff.role !== 'super_admin');
    const canDeleteThisStaff =
      Boolean(currentUser) &&
      !isSelf &&
      !isProtectedSuperAdmin &&
      (viewerIsSuperAdmin || staff.role !== 'admin');

    let deleteDisabledReason = 'Delete User';
    if (!currentUser) {
      deleteDisabledReason = 'Loading permissions...';
    } else if (isSelf) {
      deleteDisabledReason = 'You cannot delete your own currently logged-in account.';
    } else if (isProtectedSuperAdmin) {
      deleteDisabledReason = 'Super Admin accounts are protected and cannot be deleted.';
    } else if (staff.role === 'admin' && !viewerIsSuperAdmin) {
      deleteDisabledReason = 'Only Super Administrators can delete Admin accounts.';
    }

    return {
      isSelf,
      canEditThisStaff,
      canDeleteThisStaff,
      deleteDisabledReason,
      isDeactivated: staff.accountStatus === 'deactivated',
      invitationStatus: (staff as any).invitationStatus || 'pending',
    };
  };

  const handleDeactivate = async (staff: UserProfile) => {
    if (currentUser?.uid === staff.uid) {
      showNotification('error', 'You cannot deactivate your own currently logged-in account.');
      return;
    }
    if (staff.role === 'super_admin' || (staff.role === 'admin' && currentUser?.role !== 'super_admin')) {
      showNotification('error', 'Only Super Administrators can deactivate administrator accounts.');
      return;
    }

    if (!confirm(`Are you sure you want to deactivate ${staff.fullName}'s account? This blocks portal access.`)) return;

    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: 'deactivated' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Account for ${staff.fullName} deactivated successfully.`);
        fetchStaffData();
      } else {
        showNotification('error', data.error || 'Failed to deactivate staff account.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error occurred while deactivating account.');
    }
  };

  const handleOpenDeleteDialog = (staff: UserProfile) => {
    const meta = getStaffRowMeta(staff);
    if (!meta.canDeleteThisStaff) {
      showNotification('error', meta.deleteDisabledReason);
      return;
    }
    setStaffToDelete(staff);
    setDeleteError(null);
    setDeleteConfirmed(false);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!staffToDelete || deleting || !deleteConfirmed) return;

    const meta = getStaffRowMeta(staffToDelete);
    if (!meta.canDeleteThisStaff) {
      setDeleteError(meta.deleteDisabledReason);
      showNotification('error', meta.deleteDisabledReason);
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/staff/${staffToDelete.uid}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user account.');
      }

      const deletedName = staffToDelete.fullName;
      const deletedEmpId = staffToDelete.employeeId;

      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
      setDeleteConfirmed(false);
      showNotification('success', `User ${deletedName} (${deletedEmpId}) deleted permanently.`);

      if (staffList.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        await fetchStaffData();
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error occurred while deleting employee account.';
      setDeleteError(errMsg);
      showNotification('error', errMsg);
    } finally {
      setDeleting(false);
    }
  };

  const handleReactivate = async (staff: UserProfile) => {
    if (!confirm(`Reactivate account for ${staff.fullName}? This restores portal access.`)) return;

    try {
      const res = await fetch(`/api/staff/${staff.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: 'active' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Account for ${staff.fullName} reactivated successfully.`);
        fetchStaffData();
      } else {
        showNotification('error', data.error || 'Failed to reactivate staff account.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error occurred while reactivating account.');
    }
  };

  const handleResendInvite = async (staff: UserProfile) => {
    try {
      const res = await fetch(`/api/staff/${staff.uid}/resend-invite`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Invitation resent to ${staff.email}.`);
        fetchStaffData();
      } else {
        showNotification('error', data.error || 'Failed to resend invitation.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error sending invitation email.');
    }
  };

  const handleResetPassword = async (staff: UserProfile) => {
    if (!confirm(`Send secure password reset instructions to ${staff.email}?`)) return;

    try {
      const res = await fetch(`/api/staff/${staff.uid}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Password reset instructions dispatched to ${staff.email}.`);
      } else {
        showNotification('error', data.error || 'Failed to trigger password reset.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error sending password reset email.');
    }
  };

  const handleOpenInfo = (staff: UserProfile) => {
    setSelectedStaffForInfo(staff);
    setInfoModalOpen(true);
  };

  const handleOpenCompliance = async (staff: UserProfile) => {
    setSelectedStaffForCompliance(staff);
    setComplianceModalOpen(true);
    setComplianceLoading(true);
    setComplianceData(null);

    try {
      const res = await fetch(`/api/staff/${staff.uid}/compliance`);
      const data = await res.json();
      if (res.ok && data.success) {
        setComplianceData(data);
      }
    } catch (err) {
      console.error('Failed to load compliance details:', err);
    } finally {
      setComplianceLoading(false);
    }
  };

  const roleBadges: Record<string, { label: string; variant: any }> = {
    super_admin: { label: 'Super Admin', variant: 'default' },
    admin: { label: 'Admin', variant: 'info' },
    manager: { label: 'Dept Head', variant: 'purple' },
    staff: { label: 'Staff', variant: 'secondary' },
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" /> Employee & Staff Management
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage authenticated employee profiles, organizational assignments, reporting schedules, and compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchStaffData()}
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button
            onClick={() => {
              setStaffToEdit(null);
              setModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add New Employee
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                pill
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={selectedRoleFilter}
                onChange={(e) => {
                  setSelectedRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-full border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Administrator</option>
                <option value="manager">Department Head</option>
                <option value="staff">Staff</option>
              </select>

              <select
                value={selectedDeptFilter}
                onChange={(e) => {
                  setSelectedDeptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-full border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCenterFilter}
                onChange={(e) => {
                  setSelectedCenterFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-full border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Centers</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-full border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="deactivated">Deactivated Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Employee Directory ({totalCount})
              </CardTitle>
              <CardDescription className="text-xs">
                {loading ? 'Loading employee records...' : `Showing ${staffList.length} of ${totalCount} employees.`}
              </CardDescription>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading employee records from Firestore...</div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No employees match the specified filters.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee & ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Center</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invitation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((staff) => {
                      const {
                        canEditThisStaff,
                        canDeleteThisStaff,
                        deleteDisabledReason,
                        isDeactivated,
                        invitationStatus,
                      } = getStaffRowMeta(staff);

                      return (
                        <TableRow key={staff.uid} className={isDeactivated ? 'bg-slate-50 opacity-75' : ''}>
                          <TableCell>
                            <div>
                              <div className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                                {staff.fullName}
                                {isDeactivated && (
                                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono font-medium">
                                <span className="text-emerald-700 font-bold">{staff.employeeId}</span> • {staff.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={roleBadges[staff.role]?.variant || 'secondary'}>
                              {roleBadges[staff.role]?.label || staff.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-700">
                            {staff.departmentName || 'Field Operations'}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-700">
                            {staff.assignedCenterNames?.[0] || 'Nashik Main Hub'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isDeactivated ? 'secondary' : 'default'}>
                              {staff.accountStatus.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invitationStatus === 'sent'
                                  ? 'info'
                                  : invitationStatus === 'accepted'
                                    ? 'default'
                                    : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {invitationStatus.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Employee Information Details Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                title="View Employee Information"
                                onClick={() => handleOpenInfo(staff)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>

                              {/* Compliance and Report History Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                title="View Reports & Compliance"
                                onClick={() => handleOpenCompliance(staff)}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>

                              {/* Resend Invitation Button */}
                              {!isDeactivated && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Resend Setup Invitation"
                                  onClick={() => handleResendInvite(staff)}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Reset Password Button */}
                              {!isDeactivated && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Send Password Reset Link"
                                  onClick={() => handleResetPassword(staff)}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-amber-600 hover:bg-amber-50"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {canEditThisStaff ? (
                                <>
                                  {/* Edit Profile Button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Edit Profile Details"
                                    onClick={() => {
                                      setStaffToEdit(staff);
                                      setModalOpen(true);
                                    }}
                                    className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>

                                  {/* Reactivate or Deactivate Button */}
                                  {isDeactivated ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      title="Reactivate Account"
                                      onClick={() => handleReactivate(staff)}
                                      className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                    >
                                      <UserCheck className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      title="Deactivate Account"
                                      onClick={() => handleDeactivate(staff)}
                                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic px-2">Super Admin</span>
                              )}

                              {/* Delete User Button */}
                              {canDeleteThisStaff ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Delete User"
                                  aria-label={`Delete ${staff.fullName}`}
                                  onClick={() => handleOpenDeleteDialog(staff)}
                                  className="h-8 w-8 p-0 text-rose-600 border-rose-200/80 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <span title={deleteDisabledReason} className="inline-flex">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    aria-label={deleteDisabledReason}
                                    className="h-8 w-8 p-0 text-rose-300 border-slate-200 cursor-not-allowed"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Record Cards (< 768px) */}
              <div className="md:hidden space-y-3 p-4">
                {staffList.map((staff) => {
                  const {
                    canEditThisStaff,
                    canDeleteThisStaff,
                    deleteDisabledReason,
                    isDeactivated,
                    invitationStatus,
                  } = getStaffRowMeta(staff);

                  return (
                    <RecordCard key={staff.uid} className={isDeactivated ? 'opacity-80 bg-slate-50/70' : ''}>
                      <RecordCardHeader>
                        <div className="min-w-0 flex-1">
                          <RecordCardTitle className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{staff.fullName}</span>
                            {isDeactivated && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5 shrink-0">
                                Inactive
                              </Badge>
                            )}
                          </RecordCardTitle>
                          <RecordCardSubtitle>
                            <span className="text-emerald-700 font-bold">{staff.employeeId}</span> • {staff.email}
                          </RecordCardSubtitle>
                        </div>
                        <Badge variant={roleBadges[staff.role]?.variant || 'secondary'} className="text-[10px] shrink-0">
                          {roleBadges[staff.role]?.label || staff.role}
                        </Badge>
                      </RecordCardHeader>

                      <RecordCardContent>
                        <RecordCardRow
                          label="Department"
                          value={staff.departmentName || 'Field Operations'}
                        />
                        <RecordCardRow
                          label="Center"
                          value={staff.assignedCenterNames?.[0] || 'Nashik Main Hub'}
                        />
                        <RecordCardRow
                          label="Account Status"
                          value={
                            <Badge variant={isDeactivated ? 'secondary' : 'default'} className="text-[10px]">
                              {staff.accountStatus.toUpperCase()}
                            </Badge>
                          }
                        />
                        <RecordCardRow
                          label="Invitation"
                          value={
                            <Badge
                              variant={
                                invitationStatus === 'sent'
                                  ? 'info'
                                  : invitationStatus === 'accepted'
                                    ? 'default'
                                    : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {invitationStatus.toUpperCase()}
                            </Badge>
                          }
                        />
                      </RecordCardContent>

                      <RecordCardActions>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenInfo(staff)}
                          className="flex-1 h-10 text-xs font-semibold text-slate-700"
                        >
                          <FileText className="h-4 w-4 mr-1 text-emerald-600" /> Details
                        </Button>

                        {canEditThisStaff && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStaffToEdit(staff);
                              setModalOpen(true);
                            }}
                            className="flex-1 h-10 text-xs font-semibold text-slate-700"
                          >
                            <Edit className="h-4 w-4 mr-1 text-indigo-600" /> Edit
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 w-10 p-0 text-slate-600 shrink-0"
                              aria-label="More options"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleOpenCompliance(staff)}>
                              <BarChart3 className="h-4 w-4 mr-2 text-emerald-600" /> Reports & Compliance
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isDeactivated && (
                              <>
                                <DropdownMenuItem onClick={() => handleResendInvite(staff)}>
                                  <Send className="h-4 w-4 mr-2 text-blue-600" /> Resend Invite
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResetPassword(staff)}>
                                  <KeyRound className="h-4 w-4 mr-2 text-amber-600" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {canEditThisStaff && (
                              isDeactivated ? (
                                <DropdownMenuItem onClick={() => handleReactivate(staff)} className="text-emerald-700">
                                  <UserCheck className="h-4 w-4 mr-2" /> Reactivate Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleDeactivate(staff)} className="text-rose-700">
                                  <UserX className="h-4 w-4 mr-2" /> Deactivate Account
                                </DropdownMenuItem>
                              )
                            )}
                            <DropdownMenuSeparator />
                            {canDeleteThisStaff ? (
                              <DropdownMenuItem
                                onClick={() => handleOpenDeleteDialog(staff)}
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="text-slate-400">
                                <Trash2 className="h-4 w-4 mr-2" /> {deleteDisabledReason}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </RecordCardActions>
                    </RecordCard>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Showing page {currentPage} of {totalPages} ({totalCount} employees)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Modal */}
      {modalOpen && (
        <StaffFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          staffToEdit={staffToEdit}
          departments={departments}
          centers={centers}
          managers={staffList.filter((s) => s.role === 'manager' || s.role === 'admin' || s.role === 'super_admin')}
          onSuccess={() => {
            fetchStaffData();
            showNotification('success', staffToEdit ? 'Employee updated successfully.' : 'New employee registered successfully.');
          }}
        />
      )}

      {/* Employee Information Modal */}
      {infoModalOpen && selectedStaffForInfo && (
        <EmployeeInfoModal
          open={infoModalOpen}
          onOpenChange={setInfoModalOpen}
          staff={selectedStaffForInfo}
          canEdit={isSuperAdmin || (selectedStaffForInfo.role !== 'admin' && selectedStaffForInfo.role !== 'super_admin')}
          onEdit={(staff) => {
            setStaffToEdit(staff);
            setModalOpen(true);
          }}
          onViewCompliance={(staff) => {
            handleOpenCompliance(staff);
          }}
        />
      )}

      {/* Compliance & Report History Modal */}
      {complianceModalOpen && selectedStaffForCompliance && (
        <Dialog
          open={complianceModalOpen}
          onOpenChange={setComplianceModalOpen}
          title={`Reports & Compliance: ${selectedStaffForCompliance.fullName}`}
          description={`Employee ID: ${selectedStaffForCompliance.employeeId} • Role: ${selectedStaffForCompliance.role.toUpperCase()}`}
          maxWidth="max-w-4xl"
        >
          {complianceLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading compliance data from Database
            </div>
          ) : !complianceData ? (
            <div className="p-8 text-center text-xs text-slate-500">No report records found.</div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Compliance Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Submitted</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {complianceData.compliance.submittedCount}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">On-Time Rate</div>
                  <div className="text-xl font-bold text-emerald-800 mt-0.5">
                    {complianceData.compliance.complianceRate}%
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Late Submissions</div>
                  <div className="text-xl font-bold text-amber-800 mt-0.5">
                    {complianceData.compliance.lateCount}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Approved Reports</div>
                  <div className="text-xl font-bold text-blue-800 mt-0.5">
                    {complianceData.compliance.approvedCount}
                  </div>
                </div>
              </div>

              {/* Reports History Table */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" /> Recent Report History 
                </h4>
                {complianceData.reports.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                    No reports submitted yet by this employee.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Farmers</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Timing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {complianceData.reports.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-bold text-slate-900">{r.reportDate}</TableCell>
                            <TableCell className="text-slate-600">{r.workLocation || 'Field'}</TableCell>
                            <TableCell className="text-slate-600">{r.farmersVisited || 0}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  r.status === 'approved'
                                    ? 'default'
                                    : r.status === 'correction_requested'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                                className="text-[10px]"
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.isLate ? (
                                <Badge variant="warning" className="text-[10px]">
                                  LATE
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px]">
                                  ON TIME
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setComplianceModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      )}

      {/* Permanent Delete User Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteConfirmOpen(open);
          if (!open) {
            setStaffToDelete(null);
            setDeleteError(null);
            setDeleteConfirmed(false);
          }
        }}
        title="Delete Employee Account"
        description="Permanently remove this employee from Firebase Authentication and Firestore."
        maxWidth="max-w-lg"
      >
        {staffToDelete && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
              <div className="font-bold text-rose-900 flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <p className="text-rose-800 leading-relaxed">
                This action is permanent and cannot be undone. It will delete both the{' '}
                <span className="font-semibold">Firebase Authentication</span> account and the{' '}
                <span className="font-semibold">Firestore employee record</span> for this user.
              </p>
              <div className="p-3 bg-white/90 rounded-xl border border-rose-200/80 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">Employee Name</span>
                  <span className="font-bold text-slate-900 text-right">{staffToDelete.fullName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">Employee ID</span>
                  <span className="font-mono font-bold text-emerald-700">{staffToDelete.employeeId}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">Email</span>
                  <span className="font-medium text-slate-700 truncate">{staffToDelete.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 font-medium">Role</span>
                  <Badge variant={roleBadges[staffToDelete.role]?.variant || 'secondary'} className="text-[10px]">
                    {roleBadges[staffToDelete.role]?.label || staffToDelete.role}
                  </Badge>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/80 cursor-pointer select-none hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-slate-700 font-medium leading-snug">
                I explicitly confirm permanent deletion of{' '}
                <span className="font-bold text-slate-900">{staffToDelete.fullName}</span>{' '}
                (<span className="font-mono font-bold text-emerald-700">{staffToDelete.employeeId}</span>).
              </span>
            </label>

            {deleteError && (
              <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl font-semibold flex items-start gap-2">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setStaffToDelete(null);
                  setDeleteError(null);
                  setDeleteConfirmed(false);
                }}
              >
                Cancel
              </Button>
              {staffToDelete.accountStatus !== 'deactivated' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={async () => {
                    const target = staffToDelete;
                    setDeleteConfirmOpen(false);
                    setStaffToDelete(null);
                    setDeleteError(null);
                    setDeleteConfirmed(false);
                    await handleDeactivate(target);
                  }}
                  className="text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  Deactivate Instead
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || !deleteConfirmed}
                onClick={handleDeleteUser}
                className="font-bold"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Permanently
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold border shadow-xl animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1 leading-snug">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded-full hover:bg-black/5 text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
