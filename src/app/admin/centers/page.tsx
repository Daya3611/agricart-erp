'use client';

import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Plus,
  Building2,
  Edit,
  Trash2,
  Search,
  Power,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Center, Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [centerToDelete, setCenterToDelete] = useState<Center | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/centers?all=true');
      const data = await res.json();
      if (data.centers) setCenters(data.centers);

      const deptRes = await fetch('/api/departments?all=true');
      const deptData = await deptRes.json();
      if (deptData.departments) setDepartments(deptData.departments);
    } catch (err: any) {
      console.error('Failed to load centers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCenters();
  }, []);

  const openCreateModal = () => {
    setEditingCenter(null);
    setName('');
    setCode('');
    setAddress('');
    setLocationDetails('');
    setDepartmentId(departments[0]?.id || '');
    setActive(true);
    setFormError(null);
    setOpenModal(true);
  };

  const openEditModal = (center: Center) => {
    setEditingCenter(center);
    setName(center.name);
    setCode(center.code);
    setAddress(center.address || '');
    setLocationDetails(center.locationDetails || '');
    setDepartmentId(center.departmentId || '');
    setActive(center.active ?? true);
    setFormError(null);
    setOpenModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError('Center name and code are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const endpoint = editingCenter ? `/api/centers/${editingCenter.id}` : '/api/centers';
      const method = editingCenter ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim(),
          locationDetails: locationDetails.trim(),
          departmentId: departmentId || undefined,
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save center.');
      }

      showNotification('success', editingCenter ? `Center "${name}" updated successfully.` : `Center "${name}" created successfully.`);
      setOpenModal(false);
      fetchCenters();
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving center.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (center: Center) => {
    try {
      const res = await fetch(`/api/centers/${center.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !center.active }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Center "${center.name}" marked as ${!center.active ? 'Operational' : 'Inactive'}.`);
        fetchCenters();
      } else {
        showNotification('error', data.error || 'Failed to update center status.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status.');
    }
  };

  const handleDelete = async () => {
    if (!centerToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/centers/${centerToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete center.');
      }

      showNotification('success', `Center "${centerToDelete.name}" removed successfully.`);
      setDeleteConfirmOpen(false);
      setCenterToDelete(null);
      fetchCenters();
    } catch (err: any) {
      showNotification('error', err.message || 'Error occurred while deleting center.');
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCenters = centers.filter((center) => {
    const matchesSearch =
      center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      center.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (center.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (center.locationDetails || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && center.active) ||
      (statusFilter === 'inactive' && !center.active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-emerald-600" /> Procurement Centers & Locations
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage regional centers, cold storage facilities, packhouses, and APMC collection centers across Maharashtra.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchCenters()}
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <Plus className="h-4 w-4 mr-1.5" /> Add New Procurement Center
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
              pill
              placeholder="Search by name, code, address, or facility type..."
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
              className="h-9 rounded-full border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All ({centers.length})</option>
              <option value="active">Operational ({centers.filter((c) => c.active).length})</option>
              <option value="inactive">Inactive ({centers.filter((c) => !c.active).length})</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Centers Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading procurement centers...</div>
      ) : filteredCenters.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          No centers found matching your search. Click "Add New Procurement Center" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredCenters.map((center) => {
            const deptObj = departments.find((d) => d.id === center.departmentId);

            return (
              <Card
                key={center.id}
                className={`hover:border-emerald-300 transition-all ${!center.active ? 'bg-slate-50/70 border-slate-200 opacity-80' : ''}`}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-slate-900">{center.name}</CardTitle>
                    <CardDescription className="text-xs text-emerald-700 font-bold font-mono">
                      {center.code}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={center.active ? 'default' : 'secondary'} className="text-[10px]">
                      {center.active ? 'OPERATIONAL' : 'INACTIVE'}
                    </Badge>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Edit Center"
                        onClick={() => openEditModal(center)}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        title={center.active ? 'Deactivate Center' : 'Activate Center'}
                        onClick={() => handleToggleActive(center)}
                        className={`h-8 w-8 p-0 ${center.active
                            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        title="Delete Center"
                        onClick={() => {
                          setCenterToDelete(center);
                          setDeleteConfirmOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 text-xs pt-1">
                  <p className="text-slate-700 font-medium line-clamp-2 min-h-[32px]">
                    {center.address || 'Address not specified'}
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-600">
                    📌 <span className="font-bold">Facility:</span> {center.locationDetails || 'Procurement Hub'}
                  </div>
                  {deptObj && (
                    <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 pt-1">
                      <Building2 className="h-3 w-3 text-emerald-600" /> {deptObj.name}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal Dialog */}
      <Dialog
        open={openModal}
        onOpenChange={setOpenModal}
        title={editingCenter ? `Edit Center: ${editingCenter.name}` : 'Register New Procurement Center'}
        description={
          editingCenter
            ? 'Update the procurement center location, facility type, or address.'
            : 'Add address, facility details, and assigned department.'
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
            <label className="font-bold text-slate-700 block mb-1">Center Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kolhapur Procurement Facility"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Center Code *</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CNT-KLP-04"
              className="font-mono uppercase"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
            >
              <option value="">Select Department (Optional)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Postal Address</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. MIDC Shiroli, Kolhapur 416122"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Facility & Location Details</label>
            <Input
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              placeholder="e.g. Jaggery & Sugarcane Weighbridge Unit"
            />
          </div>

          {editingCenter && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Operational Status</label>
              <select
                value={active ? 'active' : 'inactive'}
                onChange={(e) => setActive(e.target.value === 'active')}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              >
                <option value="active">Operational (Active)</option>
                <option value="inactive">Inactive</option>
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
              {submitting ? 'Saving...' : editingCenter ? 'Save Changes' : 'Create Center'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Center"
        description="Are you sure you want to remove this procurement center from the ERP database?"
      >
        <div className="space-y-4 text-xs">
          {centerToDelete && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" /> Confirm Deletion: {centerToDelete.name} ({centerToDelete.code})
              </div>
              <p className="text-amber-800">
                Removing this center will delete its record from Firestore collection <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">erp_centers</code>.
              </p>
              <p className="text-amber-700 text-[11px]">
                Tip: If staff members are assigned here, deactivating the center preserves their historical assignment.
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
                setCenterToDelete(null);
              }}
            >
              Cancel
            </Button>
            {centerToDelete?.active && (
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={async () => {
                  if (centerToDelete) {
                    await handleToggleActive(centerToDelete);
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
