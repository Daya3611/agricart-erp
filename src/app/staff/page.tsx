import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function StaffRootRedirectPage() {
  const sessionUser = await getServerSession();

  if (!sessionUser) {
    redirect('/login?returnUrl=/staff/dashboard');
  }

  if (sessionUser.accountStatus === 'deactivated' || sessionUser.accountStatus === 'inactive') {
    redirect('/login?error=account_inactive');
  }

  if (sessionUser.role === 'super_admin' || sessionUser.role === 'admin') {
    redirect('/admin/staff');
  }

  if (sessionUser.role === 'manager') {
    redirect('/manager/staff');
  }

  redirect('/staff/dashboard');
}
