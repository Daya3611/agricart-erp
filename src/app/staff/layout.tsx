import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { StaffSidebar } from '@/components/layout/StaffSidebar';
import { Navbar } from '@/components/layout/Navbar';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getServerSession();

  if (!sessionUser) {
    redirect('/login?returnUrl=/staff/dashboard');
  }

  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    redirect('/login?error=account_inactive');
  }

  // If Admin or Super Admin opens staff dashboard, redirect to their authorized admin dashboard
  if (sessionUser.role === 'admin' || sessionUser.role === 'super_admin') {
    redirect('/admin/dashboard');
  }

  // If Manager opens staff dashboard, redirect to their authorized manager dashboard
  if (sessionUser.role === 'manager') {
    redirect('/manager/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <StaffSidebar user={sessionUser} />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 md:ml-64 min-h-screen">
        <Navbar
          user={sessionUser}
          title="Agricart Field Staff Portal"
          subtitle={`Welcome, ${sessionUser.fullName} (${sessionUser.employeeId})`}
        />
        <main className="flex-1 p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
