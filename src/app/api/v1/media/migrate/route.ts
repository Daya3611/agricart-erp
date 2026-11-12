import { NextResponse } from 'next/server';
import { apiError, apiSuccess, handleCorsPreflight } from '@/lib/api/v1-helper';
import { requireStrictMediaUser } from '@/lib/storage/media-auth';
import { migrateLegacyReportMediaToR2 } from '@/lib/storage/media-migration';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS };

/**
 * Super Admin endpoint to migrate legacy report attachments (Firebase/local/external) into Cloudflare R2
 * without deleting or mutating the legacy source files.
 */
export async function POST(req: Request) {
  try {
    const actor = await requireStrictMediaUser(req);
    if (actor.role !== 'super_admin') {
      return apiError('FORBIDDEN: Only Super Administrators can run legacy media migration.', 403);
    }

    let limit = 50;
    try {
      const body = await req.json();
      if (typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 200) {
        limit = Math.floor(body.limit);
      }
    } catch {
      // Optional JSON body
    }

    const report = await migrateLegacyReportMediaToR2(actor, limit);
    return apiSuccess(report, 'Legacy media migration completed.');
  } catch (err: any) {
    const msg = err?.message || 'Migration failed';
    if (msg.startsWith('UNAUTHORIZED')) return apiError(msg, 401);
    if (msg.startsWith('FORBIDDEN')) return apiError(msg, 403);
    if (msg.includes('R2_NOT_CONFIGURED')) return apiError(msg, 503);
    return apiError(msg, 500);
  }
}

