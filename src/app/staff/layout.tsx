import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AppShell } from '@/components/layout/app-shell';

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
    <AppShell
      user={sessionUser}
      title="Agricart Field Staff Portal"
      subtitle={`Welcome, ${sessionUser.fullName} (${sessionUser.employeeId})`}
      maxWidth="max-w-5xl"
    >
      {children}
    </AppShell>
  );
}
