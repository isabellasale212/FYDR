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
