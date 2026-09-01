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
 *  NOTE: `groupFilter.ts` and `queries/auditLog.ts` each hold their own copy of
 *  this regex. They are not changed here — CLAUDE.md §5, no unrelated
 *  refactoring in a feature commit — but they should collapse into this. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}
