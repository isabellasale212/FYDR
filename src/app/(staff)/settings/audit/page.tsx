import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { AuditLogFilters } from '@/components/AuditLogFilters/AuditLogFilters';
import { fetchAuditLog, fetchEntityTypes, fetchActors, fetchAthleteOptions, type AuditLogFilters as Filters } from '@/lib/queries/auditLog';
import { formatDateTime, todayIso, addDays } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Audit log · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 50;
const DEFAULT_WINDOW_DAYS = 30;

function str(v: string | string[] | undefined): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const out = s.toString();
  return out ? `?${out}` : '';
}

/** docs/10-roadmap.md's own gap list: "Audit log viewer (new screen 35) —
 *  01-roles-and-permissions.md §2 grants admins access to the audit log
 *  and no screen exists." lib/queries/auditLog.ts's header has the rest —
 *  the table and its admin-only RLS were both already real. Admin only,
 *  same gate as the rest of Settings' admin-only sections.
 *
 *  Fix gameplan item 2.5 (audit governance finding 9): a last-100-rows,
 *  no-filter log can't answer "who viewed this athlete's data" — the
 *  question a safeguarding review actually asks. Added: a date range
 *  (default last 30 days, "Show all time" to lift it), a staff-member
 *  filter, an athlete filter, free-text search over the action and
 *  actor name, and real offset pagination past the old hard cap of 100.
 *  Access is unchanged — still admin-only, same redirect. */
export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!claims.roles.includes('admin')) redirect('/settings');

  const sp = await searchParams;
  const entityType = str(sp.type);
  const actorId = str(sp.actor);
  const athleteId = str(sp.athlete);
  const q = str(sp.q);
  const isAllTime = sp.range === 'all';
  const explicitFrom = str(sp.from);
  const explicitTo = str(sp.to);

  // No date param at all on first load: default to a recent window rather
  // than the unbounded table. "Show all time" (range=all) lifts it
  // explicitly; an explicit from/to (even a partial one) is honoured as
  // given rather than merged with the default.
  const usingDefaultWindow = !isAllTime && explicitFrom === null && explicitTo === null;
  const from = isAllTime ? null : (explicitFrom ?? (usingDefaultWindow ? addDays(todayIso(), -(DEFAULT_WINDOW_DAYS - 1)) : null));
  const to = isAllTime ? null : (explicitTo ?? (usingDefaultWindow ? todayIso() : null));

  const pageParam = Number.parseInt(str(sp.page) ?? '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [entityTypes, actors, athleteOptions] = await Promise.all([
    fetchEntityTypes(db, orgId),
    fetchActors(db, orgId),
    fetchAthleteOptions(db, orgId),
  ]);
  const athleteNameById = new Map(athleteOptions.map((a) => [a.id, a.name]));

  const filters: Filters = { entityType, from, to, actorId, athleteId, q };
  const result = await fetchAuditLog(db, orgId, filters, page, PAGE_SIZE, athleteNameById, timezone);

  const otherParams = { type: entityType ?? undefined, from: explicitFrom ?? undefined, to: explicitTo ?? undefined, range: isAllTime ? 'all' : undefined, actor: actorId ?? undefined, athlete: athleteId ?? undefined, q: q ?? undefined };

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const rangeStart = result.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(result.total, page * PAGE_SIZE);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Compliance
          </p>
          <h1>Audit log</h1>
        </div>
      </div>

      <p className="tiny" style={{ marginBottom: 14 }}>
        Every read of a medical record, every role change, every report export — who did it, when, and to
        what. Append-only: nothing here can be edited or deleted, by any role.
      </p>

      <div className="chiprow" style={{ marginBottom: 14 }}>
        <Link href={`/settings/audit${qs({ ...otherParams, type: undefined })}`} className="squad-chip" aria-pressed={!entityType}>
          All
        </Link>
        {entityTypes.map((t) => (
          <Link key={t} href={`/settings/audit${qs({ ...otherParams, type: t })}`} className="squad-chip" aria-pressed={entityType === t}>
            {t.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      <AuditLogFilters
        actors={actors}
        athletes={athleteOptions}
        from={explicitFrom ?? (usingDefaultWindow ? (from ?? '') : '')}
        to={explicitTo ?? (usingDefaultWindow ? (to ?? '') : '')}
        actorId={actorId ?? ''}
        athleteId={athleteId ?? ''}
        q={q ?? ''}
        isAllTime={isAllTime}
      />

      <p className="cap" style={{ marginTop: -6, marginBottom: 14 }}>
        {isAllTime ? 'Showing all time.' : from && to ? `Showing ${from} to ${to}.` : from ? `Showing from ${from}.` : to ? `Showing up to ${to}.` : 'Showing all time.'}{' '}
        The athlete filter matches a direct record (subject access, restriction overrides, availability changes,
        clinical reads) or a report that named the athlete. Some action types — role changes, retention runs,
        bulk invites, week-template applications — aren&rsquo;t tied to a single athlete and won&rsquo;t match it;
        they still show under the entity-type filter above.
      </p>

      {result.rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="No audit entry matches this filter. Try widening the date range or clearing a filter above."
        />
      ) : (
        <>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Athlete</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sub mono">{formatDateTime(r.occurredAt, timezone)}</td>
                    <td>
                      {r.actorName ?? '—'}
                      {r.actorRole ? <span className="tiny" style={{ color: 'var(--faint)' }}> · {r.actorRole}</span> : null}
                    </td>
                    <td className="mono tiny">{r.action}</td>
                    <td className="tiny">
                      {r.entityType}
                      {r.entityId ? <span style={{ color: 'var(--faint)' }}> · {r.entityId.slice(0, 8)}</span> : null}
                    </td>
                    <td className="tiny">{r.athleteName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chiprow" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <p className="cap" style={{ margin: 0 }}>
              {rangeStart}–{rangeEnd} of {result.total}
            </p>
            <div className="chiprow" style={{ margin: 0 }}>
              {page > 1 ? (
                <Link href={`/settings/audit${qs({ ...otherParams, page: String(page - 1) })}`} className="btn-ghost">
                  ← Previous
                </Link>
              ) : null}
              <span className="tiny" style={{ color: 'var(--faint)' }}>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={`/settings/audit${qs({ ...otherParams, page: String(page + 1) })}`} className="btn-ghost">
                  Next →
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
