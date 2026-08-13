/* The group filter, CLAUDE.md §3: every screen that shows more than one
 * athlete is filterable by group, held in `?groups=` so the selection
 * survives a refresh and is applied in the query rather than after the rows
 * arrive.
 *
 * This parse function has to run in the server component that reads
 * `searchParams` and calls the query. It used to live in
 * components/GroupFilter/GroupFilter.tsx, which is 'use client': any export
 * of a client component file becomes a client reference at the RSC boundary,
 * pure function or not, so a server component importing it fails at runtime
 * with "Attempted to call parseGroupParam() from the server but
 * parseGroupParam is on the client." Plain module, no directive, so both the
 * server pages and the client GroupFilter component can import it.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every caller feeds this straight into a `group_id in (...)` query, so a
 *  non-UUID value here is never a real group — it's a hand-edited URL, a
 *  stale link, or a query string built by hand. Caught live: an invalid
 *  value used to reach the database as-is and crash the page with "invalid
 *  input syntax for type uuid" (analytics.ts's fetchGroupAthleteIds call).
 *  Dropping it silently means a bad group filter fails open to "no filter
 *  applied", the same as the param being absent, rather than failing the
 *  whole page. */
export function parseGroupParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}

/** The active scope, by name — "Whole squad", "Forwards", "Backs + Academy".
 *
 *  The audit's S4 finding: this filter re-scopes every screen, report and
 *  export, yet no scope line ever named it — headers said "Squad · <club>"
 *  (or "1 GROUP", coach finding 16) whether or not a filter was silently
 *  narrowing the data underneath, and the worst observed case was an injury
 *  report declaring "Everyone is available." over a filtered subset. One
 *  shared function, used by every header eyebrow, CSV caption and PDF meta
 *  line, so the label can never drift per-screen.
 *
 *  " + " as the separator is deliberate (coach finding 17): the chips are
 *  multi-select but styled like radios, and "Backs + Academy" states the
 *  union where "Backs, Academy" would not.
 *
 *  Selected ids with no matching group (a stale cookie surviving an archive,
 *  a hand-edited URL) still filter the query downstream — fetchGroupAthleteIds
 *  does not re-validate against live groups — so they must not be silently
 *  dropped from the label: that would print "Whole squad" over filtered data,
 *  the exact lie this function exists to end.
 *
 *  "Whole squad", singular — CLAUDE.md §6: there is exactly one squad per
 *  organisation, and this control picks among groups, never among squads.
 *  "All squads" (plural) was live here despite this doc comment already
 *  saying the singular two lines up — a typo, not a considered choice, and
 *  the one outlier against the "Whole squad" wording every sibling scope
 *  chip already uses (NutritionTargetForm, LeaderboardBuilderForm,
 *  SelectedSessionPanel, NutritionTargetsList, LeaderboardWall). */
export function groupScopeLabel(
  groups: readonly { id: string; name: string }[],
  selectedIds: readonly string[],
): string {
  if (selectedIds.length === 0) return 'Whole squad';
  const selected = new Set(selectedIds);
  const named = groups.filter((g) => selected.has(g.id)).map((g) => g.name);
  const unknown = selectedIds.filter((id) => !groups.some((g) => g.id === id)).length;
  if (unknown > 0) named.push(unknown === 1 ? '1 unknown group' : `${unknown} unknown groups`);
  return named.join(' + ');
}
