import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { ManagerSidebar } from '@/components/layout/ManagerSidebar';
import { Navbar } from '@/components/layout/Navbar';

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
    <div className="min-h-screen bg-slate-50 flex">
      <ManagerSidebar user={sessionUser} />
      <div className="flex-1 flex flex-col min-w-0 ml-64 min-h-screen">
        <Navbar
          user={sessionUser}
          title="Agricart Department & Center Management"
          subtitle={`Department Head / Center Manager: ${sessionUser.fullName} (${sessionUser.departmentName || 'Operations'})`}
        />
        <main className="flex-1 p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
