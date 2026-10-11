import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { Navbar } from '@/components/layout/Navbar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getServerSession();

  if (!sessionUser) {
    redirect('/login?returnUrl=/admin/dashboard');
  }

  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    redirect('/login?error=account_inactive');
  }

  // Deny access to Staff users and redirect to staff dashboard
  if (sessionUser.role === 'staff') {
    redirect('/staff/dashboard');
  }

  // Deny access to Managers and redirect to manager dashboard
  if (sessionUser.role === 'manager') {
    redirect('/manager/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar user={sessionUser} />
      <div className="flex-1 flex flex-col min-w-0 ml-64 min-h-screen">
        <Navbar
          user={sessionUser}
          title="Agricart Administrative Portal"
          subtitle={`Administrator: ${sessionUser.fullName} (${sessionUser.role === 'super_admin' ? 'Super Admin' : 'Admin'})`}
        />
        <main className="flex-1 p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
