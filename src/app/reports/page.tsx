import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function ReportsRedirect() {
  const sessionUser = await getServerSession();
  if (!sessionUser) redirect('/login?returnUrl=/admin/reports');
  if (sessionUser.role === 'staff') redirect('/staff/report-history');
  if (sessionUser.role === 'manager') redirect('/manager/reports');
  redirect('/admin/reports');
}
