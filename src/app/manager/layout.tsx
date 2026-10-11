import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getServerSession();

  if (!sessionUser) {
    redirect('/login?returnUrl=/manager/dashboard');
  }

  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    redirect('/login?error=account_inactive');
  }

  // Deny access to Staff users and redirect to staff dashboard
  if (sessionUser.role === 'staff') {
    redirect('/staff/dashboard');
  }

  return (
    <AppShell
      user={sessionUser}
      title="Agricart Department & Center Management"
      subtitle={`Department Head: ${sessionUser.fullName} (${sessionUser.departmentName || 'Operations'})`}
    >
      {children}
    </AppShell>
  );
}
