import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AppShell } from '@/components/layout/app-shell';

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
    <AppShell
      user={sessionUser}
      title="Agricart Administrative Portal"
      subtitle={`Administrator: ${sessionUser.fullName} (${sessionUser.role === 'super_admin' ? 'Super Admin' : 'Admin'})`}
    >
      {children}
    </AppShell>
  );
}
