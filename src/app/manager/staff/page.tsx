'use client';

import React, { useEffect, useState } from 'react';
import { Users, Search, Building2, MapPin, Mail, Phone } from 'lucide-react';
import { UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function ManagerStaffPage() {
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // API automatically scopes users to the manager's assigned department/centers
    fetch('/api/staff')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setStaffList(data.users);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredStaff = staffList.filter((s) => {
    return (
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-purple-600" /> Assigned Department Staff
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          View active field staff members and officers assigned to your department and procurement centers.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search staff by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <Badge variant="outline" className="text-xs font-bold">
            {filteredStaff.length} Members in Department
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Department Roster</CardTitle>
          <CardDescription>Field officers expected to log daily activity reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading department staff...</div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No staff members found matching criteria.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Center / Hub</TableHead>
                  <TableHead>Contact Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.uid}>
                    <TableCell>
                      <div>
                        <p className="font-bold text-slate-900">{staff.fullName}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{staff.employeeId} • {staff.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">{staff.designation || 'Field Staff'}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">
                      {staff.assignedCenterNames?.[0] || 'Nashik Center'}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">
                      {staff.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.accountStatus === 'active' ? 'default' : 'secondary'}>
                        {staff.accountStatus.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
