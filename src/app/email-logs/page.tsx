import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function EmailLogsRedirect() {
  const sessionUser = await getServerSession();
  if (!sessionUser) redirect('/login?returnUrl=/admin/email-logs');
  if (sessionUser.role === 'staff') redirect('/staff/dashboard');
  if (sessionUser.role === 'manager') redirect('/manager/dashboard');
  redirect('/admin/email-logs');
}
