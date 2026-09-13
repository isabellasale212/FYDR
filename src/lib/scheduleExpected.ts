/* PATTERN-S4 C5 (2026-09-13): "Every count states its denominator" — the
 * expected-attendee sentence on the schedule's session panel. The number is
 * DISTINCT athletes across the session's groups (ScheduleWorkspace resolves
 * them as one Set; adding group sizes would count an athlete in two groups
 * twice), against the squad. Pure. */
export function expectedAthletesLine(o: { expected: number; squad: number }): string {
  if (o.expected === 0) return 'Nobody is expected — staff only';
  if (o.squad > 0 && o.expected >= o.squad) return `All ${o.squad} athletes are expected`;
  const verb = o.expected === 1 ? 'is' : 'are';
  if (o.squad <= 0) return `${o.expected} athlete${o.expected === 1 ? '' : 's'} ${verb} expected`;
  return `${o.expected} of ${o.squad} athletes ${verb} expected`;
}
