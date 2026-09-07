/* Which database is this actually pointing at?
 *
 * WHY THIS IS A MODULE AND NOT A CONDITIONAL INSIDE ONE SCRIPT. reset-scratch.mjs
 * already carries this reasoning in prose and enforces it inline, which means
 * the reasoning cannot be tested and cannot be reused — the next scratch-only
 * script re-derives it, or does not. This is that check, extracted so it can be
 * driven with real URL shapes by a test instead of being read and believed.
 *
 * THE TWO SHAPES, which is the part that is easy to get wrong. A Supabase
 * connection carries its project ref in the HOST for a direct connection:
 *
 *     https://stfgzkuvczbpxyevxkak.supabase.co
 *     postgresql://postgres:pw@db.stfgzkuvczbpxyevxkak.supabase.co:5432/postgres
 *
 * and in the USERNAME for a session-pooler connection, where the host is a
 * shared regional address that names no project at all:
 *
 *     postgresql://postgres.stfgzkuvczbpxyevxkak:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
 *
 * A check written against the host alone passes happily on a pooler URL for the
 * wrong project, because the host it inspects is the same string either way.
 * Both projects here are reachable by both routes (the IPv4 pooler fallback,
 * 2026-09-06), so this is a live case rather than a theoretical one.
 *
 * SO THE REF IS SEARCHED FOR ANYWHERE IN THE STRING, and both refs are checked
 * independently: a URL must name scratch AND must not name production. Neither
 * test alone is enough — "not production" passes for a typo that names nothing,
 * and "is scratch" would pass for a string that somehow carried both. */

export const SCRATCH_REF = 'stfgzkuvczbpxyevxkak';
export const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';

/** @typedef {{namesScratch: boolean, namesProduction: boolean, ok: boolean, reason: string}} TargetVerdict */

/** @param {string | undefined | null} url @returns {TargetVerdict} */
export function describeTarget(url) {
  const s = String(url ?? '');
  const namesScratch = s.includes(SCRATCH_REF);
  const namesProduction = s.includes(PRODUCTION_REF);

  let reason = '';
  if (namesProduction) {
    reason = `refusing: this URL names the PRODUCTION project (${PRODUCTION_REF}).`;
  } else if (!namesScratch) {
    reason = `refusing: this URL does not name the scratch project (${SCRATCH_REF}). It names no project this repository knows, which is not the same as being safe.`;
  }

  return { namesScratch, namesProduction, ok: namesScratch && !namesProduction, reason };
}
