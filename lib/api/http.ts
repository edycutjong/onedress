import { YouCamClient } from '../youcam/client';
import { toUserFacingError } from '../youcam/errors';

/**
 * Shared plumbing for the route handlers. Two invariants:
 *
 *  - The API key never leaves the server. Every YouCam call in the app goes through
 *    a route handler; the browser only ever sees file_ids and result URLs.
 *  - A missing key is NOT a crash. The judged live URL must load zero-config
 *    (rules.md: no login wall, works with no setup), so "unconfigured" is a normal,
 *    reportable state that leaves the cached demo party fully usable.
 */

export interface ApiErrorBody {
  error: ReturnType<typeof toUserFacingError>;
}

export function errorResponse(err: unknown, status = 502): Response {
  const body: ApiErrorBody = { error: toUserFacingError(err) };
  return Response.json(body, { status });
}

let cached: YouCamClient | null = null;

/** The shared client, or null when no API key is configured on this deployment. */
export function getClient(): YouCamClient | null {
  if (cached) return cached;
  try {
    cached = new YouCamClient();
    return cached;
  } catch {
    return null;
  }
}

export function notConfigured(): Response {
  return Response.json(
    {
      error: {
        code: 'not_configured',
        title: 'Live mode unavailable',
        guidance:
          'This deployment has no YouCam API key, so live runs are disabled. The cached demo party still works.',
        recovery: 'config' as const,
      },
    },
    { status: 503 },
  );
}
