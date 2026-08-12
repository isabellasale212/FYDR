import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchAuditLog, fetchEntityTypes } from '@/lib/queries/auditLog';
import { formatDateTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Audit log · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** docs/10-roadmap.md's own gap list: "Audit log viewer (new screen 35) —
 *  01-roles-and-permissions.md §2 grants admins access to the audit log
 *  and no screen exists." lib/queries/auditLog.ts's header has the rest —
 *  the table and its admin-only RLS were both already real. Admin only,
 *  same gate as the rest of Settings' admin-only sections. */
export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims } = await requireStaff();
  if (!claims.roles.includes('admin')) redirect('/settings');

  const sp = await searchParams;
  const entityType = typeof sp.type === 'string' ? sp.type : null;

  const [rows, entityTypes] = await Promise.all([fetchAuditLog(db, orgId, { entityType }), fetchEntityTypes(db, orgId)]);

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
        <Link href="/settings/audit" className="squad-chip" aria-pressed={!entityType}>
          All
        </Link>
        {entityTypes.map((t) => (
          <Link key={t} href={`/settings/audit?type=${t}`} className="squad-chip" aria-pressed={entityType === t}>
            {t.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing recorded yet" body="No audit entry exists for this filter." />
      ) : (
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sub mono">{formatDateTime(r.occurredAt)}</td>
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
      )}

      <p className="cap" style={{ marginTop: 10 }}>
        The most recent {rows.length} entries for this filter. Pagination and search aren&rsquo;t
        available yet.
      </p>
    </>
  );
}
