/* PATTERN-S8 C6 (2026-09-13): the two sentences each threshold now carries —
 * who set it and when, exactly as the dashboard quotes ("Thresholds set by
 * Jane Pemberton · 24 Aug"), and the 28-day preview of who it would have
 * flagged, computed by the engine's own evaluator (migration 0113) and
 * writing nothing. Pure. */

import { formatDate } from '@/lib/format';

/** D8, answered 2026-09-13: "no creator means default". A row with no
 *  created_by is one of Fydr's starter rules (0059); everything else was
 *  set by a person. `updated_at` is the one stored date the dashboard's
 *  provenance line already uses (fetchThresholdProvenance). */
export function thresholdOwnerLine(o: { setBy: string | null; updatedAt: string; timezone: string }): string {
  const when = formatDate(o.updatedAt, o.timezone);
  return o.setBy ? `Set by ${o.setBy} · ${when}` : `One of the club defaults · unchanged since ${when}`;
}

export type PreviewRow = { athlete_id: string | null; first_name: string | null; last_name: string | null; breach_days: number; in_scope: number; window_days: number };

export type PreviewSummary = {
  flagged: number;
  inScope: number;
  windowDays: number;
  /** "4 of 30 athletes" */
  count: string;
  /** The names, most days first, with their day counts. */
  names: string[];
  /** The one paragraph under the count. */
  sentence: string;
  /** What a preview is not. */
  caveat: string;
};

export function previewSummary(rows: readonly PreviewRow[]): PreviewSummary | null {
  const first = rows[0];
  if (!first) return null;
  const inScope = first.in_scope;
  const windowDays = first.window_days;
  const flagged = rows.filter((r) => r.athlete_id !== null);
  const sorted = [...flagged].sort((a, b) => b.breach_days - a.breach_days || `${a.last_name}`.localeCompare(`${b.last_name}`));
  const names = sorted.map((r) => `${r.first_name} ${r.last_name} (${r.breach_days} day${r.breach_days === 1 ? '' : 's'})`);
  const athletes = `${inScope} athlete${inScope === 1 ? '' : 's'}`;
  const count = `${flagged.length} of ${athletes}`;
  let sentence: string;
  if (inScope === 0) sentence = `Nobody is in this rule's scope, so there is nothing to preview.`;
  else if (flagged.length === 0) sentence = `Over the last ${windowDays} days this rule would have flagged nobody among the ${athletes} it applies to.`;
  else sentence = `Over the last ${windowDays} days this rule would have flagged ${count} it applies to, on the days shown against each name.`;
  const caveat = `A preview reads the same entries the nightly sweep reads and writes nothing — no flag, no notification. It counts every day the rule would fire, without the cooldown the sweep leaves between one flag and the next, so it can show more days than flags.`;
  return { flagged: flagged.length, inScope, windowDays, count, names, sentence, caveat };
}
