import type { Database } from '@/lib/types/database';

type SessionType = Database['public']['Enums']['session_type'];

/** Extracted out of timetable.ts (integration audit Batch 3, restriction-
 *  to-session-card linkage) so schedule.ts can reuse the exact same
 *  heuristic for the Schedule week grid's `SelectedSessionPanel` without a
 *  circular import — timetable.ts already imports `dayBounds`/`Session`
 *  from schedule.ts, so schedule.ts importing back from timetable.ts would
 *  cycle. Both files import this instead.
 *
 *  The doc's own shipped default for `organisations.settings ->
 *  'restriction_conflicts'` — not read from settings in this pass (no
 *  screen writes that key yet, so there is nothing there to diverge from
 *  the default), applied directly. Substring match, case-insensitive: real
 *  restriction text in this org includes phrases like "no contact" inside
 *  a longer string ("no contact, no scrummaging"), never an exact token.
 *
 *  Coach audit finding 8: `screens/timetable.md`'s documented default is
 *  `no contact` conflicts with `session_type in ('match')` *or* a session
 *  tagged `contact`. The tag half never fires — `sessions.tags` is O-403,
 *  never built — which left `no contact` checking match sessions only.
 *  `training` is treated as contact-relevant alongside `match`, the
 *  plausible proxy until `sessions.tags` ships. `gym`, `rehab`, `testing`,
 *  `meeting` and `recovery` stay excluded — none of them are contact work
 *  by definition, and adding them would just be noise the coach starts
 *  ignoring.
 *
 *  This is the acknowledged-imprecise stand-in for the controlled-
 *  vocabulary design O-358/O-362/O-403 (`docs/screens/session-detail.md`,
 *  `docs/screens/timetable.md`) still leave open — reuse it everywhere a
 *  restriction-conflict indicator is needed rather than writing a second,
 *  divergent substring rule. */
export function computeConflicts(sessionType: SessionType, plannedRpe: number | null, restrictions: string[]): string[] {
  const lower = restrictions.map((r) => r.toLowerCase());
  const conflicts: string[] = [];
  if (
    (sessionType === 'match' || sessionType === 'training') &&
    lower.some((r) => r.includes('no contact'))
  ) {
    conflicts.push('no contact');
  }
  if (
    sessionType !== 'match' &&
    sessionType !== 'meeting' &&
    sessionType !== 'recovery' &&
    plannedRpe !== null &&
    plannedRpe >= 7 &&
    lower.some((r) => r.includes('no sprinting'))
  ) {
    conflicts.push('no sprinting');
  }
  return conflicts;
}
