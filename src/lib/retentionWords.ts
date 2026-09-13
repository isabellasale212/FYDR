/* PATTERN-S8 C9 (2026-09-13): retention states its consequence before the
 * button — rows, athletes, which are current — in the same card as Run, and
 * again in the dialog that runs it (B11: a purge is irreversible). From the
 * preview the server computed; pure. */

import type { RetentionPreview } from '@/lib/retention/compute';

const n = (v: number, one: string, many: string) => `${v.toLocaleString('en-GB')} ${v === 1 ? one : many}`;

export type RetentionConsequence = {
  /** What the run will actually change, or that it will change nothing. */
  lead: string;
  /** Who it touches: the athletes and how many are current, with names. */
  people: string | null;
  /** What the preview-only categories hold, stated as visibility only. */
  visibility: string | null;
  /** True when Run has something to do. */
  runnable: boolean;
};

export function retentionConsequence(p: RetentionPreview): RetentionConsequence {
  const automated = p.categories.filter((c) => c.automated);
  const previewOnly = p.categories.filter((c) => !c.automated);
  const imports = automated.find((c) => /Import batch/.test(c.category))?.count ?? 0;
  const injuries = automated.find((c) => /Injury clinical/.test(c.category))?.count ?? 0;
  const runnable = imports + injuries > 0;

  const parts: string[] = [];
  if (imports) parts.push(`delete ${n(imports, 'import file', 'import files')} older than 30 days`);
  if (injuries) parts.push(`redact the clinical detail on ${n(injuries, 'closed injury record', 'closed injury records')} and archive ${injuries === 1 ? 'it' : 'them'}`);
  const lead = runnable ? `Running now will ${parts.join(', and ')}. This cannot be undone.` : 'Nothing is eligible today: no import file is older than 30 days and no closed injury record has passed its retention period. Run has nothing to do.';

  let people: string | null = null;
  if (injuries) {
    const { total, current, names } = p.athletes;
    const who = current === 0 ? 'none of them still on the squad' : `${current === total ? (total === 1 ? 'still on the squad' : 'all still on the squad') : `${current} of them still on the squad`}${names.length ? `: ${names.join(', ')}` : ''}`;
    people = `${injuries === 1 ? 'That record belongs' : 'Those records belong'} to ${n(total, 'athlete', 'athletes')}, ${who}. Their availability history and everything else about them stays; only the diagnosis, mechanism, notes, treatment plan, imaging and referral go.`;
  }

  const visibleRows = previewOnly.reduce((s, c) => s + c.count, 0);
  const visibility = previewOnly.length ? `${n(visibleRows, 'row', 'rows')} in the ${previewOnly.length} preview-only categories ${visibleRows === 1 ? 'is' : 'are'} past their period and untouched by this run — shown so the club can see what a fuller retention would remove.` : null;

  return { lead, people, visibility, runnable };
}
