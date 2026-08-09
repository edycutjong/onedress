import { errorResponse, getClient } from '@/lib/api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/credit — live grant balance for the unit meter in the shell footer.
 *
 * Returns 200 with `configured: false` rather than an error when no key is set:
 * the meter is a piece of honesty UI, and a deployment in cached-demo mode should
 * say "demo mode" instead of showing a broken widget.
 */
export async function GET() {
  const client = getClient();
  if (!client) return Response.json({ configured: false, units: null });

  try {
    const units = await client.getCredit();
    return Response.json({ configured: true, units });
  } catch (err) {
    return errorResponse(err);
  }
}
