/* Who has not submitted this morning, ordered by how many mornings in a row —
 * STAFF-SS-01 A4, approved 2026-09-12. The dashboard's "Wellness in" list
 * used to be names in alphabetical order; the board's rule is that the person
 * who has been quiet longest comes first, with their last entry date beside
 * them, and a missing morning is "Not submitted", never 0 or 0%.
 *
 * A run counts EXPECTED mornings only: a rest day (no expectation) neither
 * extends nor breaks it. It ends at the most recent expected morning that has
 * an entry. Pure, so it is tested with rows; the dashboard query feeds it.
 */

export type MissingRun = { athleteId: string; name: string; runDays: number; lastEntry: string | null };

export function missingRuns(
  missing: readonly { id: string; name: string }[],
  expectations: readonly { athlete_id: string; expectation_date: string }[],
  entries: readonly { athlete_id: string | null; entry_date: string | null }[],
  today: string,
): MissingRun[] {
  const expectedBy = new Map<string, string[]>();
  for (const e of expectations) {
    if (e.expectation_date > today) continue;
    expectedBy.set(e.athlete_id, [...(expectedBy.get(e.athlete_id) ?? []), e.expectation_date]);
  }
  const enteredBy = new Map<string, Set<string>>();
  const lastBy = new Map<string, string>();
  for (const r of entries) {
    if (!r.athlete_id || !r.entry_date || r.entry_date > today) continue;
    enteredBy.set(r.athlete_id, (enteredBy.get(r.athlete_id) ?? new Set()).add(r.entry_date));
    const prev = lastBy.get(r.athlete_id);
    if (!prev || r.entry_date > prev) lastBy.set(r.athlete_id, r.entry_date);
  }
  return missing
    .map(({ id, name }) => {
      const dates = [...new Set(expectedBy.get(id) ?? [])].sort().reverse();
      const entered = enteredBy.get(id) ?? new Set<string>();
      let runDays = 0;
      for (const d of dates) {
        if (entered.has(d)) break;
        runDays += 1;
      }
      return { athleteId: id, name, runDays: Math.max(runDays, 1), lastEntry: lastBy.get(id) ?? null };
    })
    .sort((a, b) => b.runDays - a.runDays || a.name.localeCompare(b.name));
}

export function runLabel(runDays: number): string {
  return runDays === 1 ? '1 morning' : `${runDays} mornings in a row`;
}
