'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Users,
  Edit,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  Power,
  RefreshCw,
} from 'lucide-react';
import { Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/departments?all=true');
      const data = await res.json();
      if (data.departments) setDepartments(data.departments);
    } catch (err: any) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setActive(true);
    setFormError(null);
    setOpenModal(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setDescription(dept.description || '');
    setActive(dept.active ?? true);
    setFormError(null);
    setOpenModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError('Department name and code are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const endpoint = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save department.');
      }

      showNotification('success', editingDept ? `Department "${name}" updated successfully.` : `Department "${name}" created successfully.`);
      setOpenModal(false);
      fetchDepartments();
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !dept.active }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Department "${dept.name}" marked as ${!dept.active ? 'Active' : 'Inactive'}.`);
        fetchDepartments();
      } else {
        showNotification('error', data.error || 'Failed to update department status.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status.');
    }
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/departments/${deptToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete department.');
      }

      showNotification('success', `Department "${deptToDelete.name}" removed successfully.`);
      setDeleteConfirmOpen(false);
      setDeptToDelete(null);
      fetchDepartments();
    } catch (err: any) {
      showNotification('error', err.message || 'Error occurred while deleting department.');
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dept.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && dept.active) ||
      (statusFilter === 'inactive' && !dept.active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" /> Departments
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage organizational divisions across Field Operations, Quality Assurance, Supply Chain, and Extension Services.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchDepartments()}
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <Plus className="h-4 w-4 mr-1.5" /> Add New Department
          </Button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border transition-all ${notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
        >
          {notification.message}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name, code, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
            >
              <option value="all">All ({departments.length})</option>
              <option value="active">Active Only ({departments.filter((d) => d.active).length})</option>
              <option value="inactive">Inactive Only ({departments.filter((d) => !d.active).length})</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Department Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading departments...</div>
      ) : filteredDepartments.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          No departments found matching your search. Click "Add New Department" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDepartments.map((dept) => (
            <Card
              key={dept.id}
              className={`hover:border-emerald-300 transition-all ${!dept.active ? 'bg-slate-50/70 border-slate-200 opacity-80' : ''}`}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {dept.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-emerald-700 font-bold font-mono">
                    {dept.code}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={dept.active ? 'default' : 'secondary'} className="text-[10px]">
                    {dept.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                    {/* Edit Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      title="Edit Department"
                      onClick={() => openEditModal(dept)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>

                    {/* Quick Active Toggle Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      title={dept.active ? 'Deactivate Department' : 'Activate Department'}
                      onClick={() => handleToggleActive(dept)}
                      className={`h-8 w-8 p-0 ${dept.active
                          ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>

                    {/* Delete / Remove Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      title="Delete / Remove Department"
                      onClick={() => {
                        setDeptToDelete(dept);
                        setDeleteConfirmOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 min-h-[36px] line-clamp-2">
                  {dept.description || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-600" />
                    <span>Organizational Division</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">ID: {dept.id}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal Dialog */}
      <Dialog
        open={openModal}
        onOpenChange={setOpenModal}
        title={editingDept ? `Edit Department: ${editingDept.name}` : 'Add Organizational Department'}
        description={
          editingDept
            ? 'Update the department name, operational code, or description.'
            : 'Define department name, code, and operational description.'
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Department Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Farmer Advisory & Extension"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Department Code *</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. DEPT-ADV"
              className="font-mono uppercase"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational responsibilities, cluster coverage, activities..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {editingDept && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Operational Status</label>
              <select
                value={active ? 'active' : 'inactive'}
                onChange={(e) => setActive(e.target.value === 'active')}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              >
                <option value="active">Active (Available for employee assignment & reporting)</option>
                <option value="inactive">Inactive (Hidden from active forms)</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {submitting ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete / Remove Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Department"
        description="Are you sure you want to remove this department from the ERP database?"
      >
        <div className="space-y-4 text-xs">
          {deptToDelete && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" /> Confirm Deletion: {deptToDelete.name} ({deptToDelete.code})
              </div>
              <p className="text-amber-800">
                Removing this department will delete its configuration record from Firestore collection <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">erp_departments</code>.
              </p>
              <p className="text-amber-700 text-[11px]">
                Tip: If staff members are still assigned to this department, you can deactivate it instead to keep past records intact.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeptToDelete(null);
              }}
            >
              Cancel
            </Button>
            {deptToDelete?.active && (
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={async () => {
                  if (deptToDelete) {
                    await handleToggleActive(deptToDelete);
                    setDeleteConfirmOpen(false);
                  }
                }}
                className="text-amber-700 hover:bg-amber-50"
              >
                Deactivate Instead
              </Button>
            )}
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {deleting ? 'Removing...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
