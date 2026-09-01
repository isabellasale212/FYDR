/** Is this string shaped like a UUID?
 *
 *  Exists because a route parameter is user input. `/reports/athlete/[athleteId]`
 *  takes whatever the URL segment happens to contain, and every entry point
 *  under it — the page, the CSV and the PDF — passed it straight into a query.
 *  Postgres rejects a non-UUID with `invalid input syntax for type uuid`, which
 *  arrives as an unhandled error, so `/reports/athlete/notauuid` answered 500
 *  where it should answer 404. `/reports/athlete/export` did the same, because
 *  there is no such route and "export" became the athlete id.
 *
 *  The distinction that matters: a well-formed id for an athlete who is not in
 *  this org already 404s correctly, via the `if (!report) notFound()` those
 *  files already carry. That check is right, it just runs after the query it
 *  needed to protect. This is the same check moved in front of it.
 *
 *  Shape only — it says nothing about whether the row exists or whether this
 *  org may see it. Tenancy is RLS and the `org_id` filter on the query
 *  (CLAUDE.md rule 1); never treat a passing id as an authorised one.
 *
 *  `groupFilter.ts` and `queries/auditLog.ts` each held their own copy of this
 *  regex and now call this instead — one definition, so a future correction
 *  cannot land in two of three places.
 *
 *  Those two keep their own RESPONSE to a bad id, and should: a malformed
 *  `?groups=` value is dropped and the filter falls open to "no filter", the
 *  same as the param being absent, because a stale link should not take a
 *  whole page down — and an audit-log filter behaves likewise. A malformed
 *  path SEGMENT is different: it names a resource that does not exist, so it
 *  is a 404. Shared shape test, different consequence, deliberately. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}
