import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function MissingReportsRedirect() {
  const sessionUser = await getServerSession();
  if (!sessionUser) redirect('/login?returnUrl=/admin/missing-reports');
  if (sessionUser.role === 'staff') redirect('/staff/dashboard');
  if (sessionUser.role === 'manager') redirect('/manager/dashboard');
  redirect('/admin/missing-reports');
}
