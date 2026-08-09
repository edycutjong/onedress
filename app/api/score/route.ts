import { z } from 'zod';
import { scoreParty } from '@/lib/colorway/engine';
import { COLORWAYS } from '@/lib/colorway/data';

export const runtime = 'nodejs';

/**
 * POST /api/score — score a set of measured skin hexes against all 24 colorways.
 *
 * Pure math: zero API calls, zero units, no network. It exists as a route so the
 * score board, the "How we score" card and the maximin-vs-mean toggle can be driven
 * with hand-entered or replayed hexes — including the cached demo party — without
 * ever touching the grant balance.
 */

const Body = z.object({
  profiles: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        skinHex: z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'skinHex must be a 6-digit hex colour'),
        fitzpatrick: z.string().optional(),
      }),
    )
    .min(1, 'at least one bridesmaid is required')
    .max(12, 'the demo flow is scoped to at most 12 bridesmaids'),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return Response.json(
      { error: { code: 'bad_json', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'invalid_body',
          message: parsed.error.issues[0]?.message ?? 'Invalid body.',
        },
      },
      { status: 400 },
    );
  }

  const profiles = parsed.data.profiles.map((p) => ({
    ...p,
    skinHex: p.skinHex.startsWith('#') ? p.skinHex : `#${p.skinHex}`,
  }));

  const result = scoreParty(profiles, COLORWAYS);
  return Response.json({
    ranked: result.ranked,
    winner: result.winner,
    byEye: result.byEye,
    mostHurt: result.mostHurt,
    differsFromByEye: result.differsFromByEye,
  });
}
