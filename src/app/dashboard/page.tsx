import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardRedirectPage() {
  const sessionUser = await getServerSession();

  if (!sessionUser) {
    redirect('/login?returnUrl=/admin/dashboard');
  }

  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    redirect('/login?error=account_inactive');
  }

  if (sessionUser.role === 'super_admin' || sessionUser.role === 'admin') {
    redirect('/admin/dashboard');
  }

  if (sessionUser.role === 'manager') {
    redirect('/manager/dashboard');
  }

  redirect('/staff/dashboard');
}
