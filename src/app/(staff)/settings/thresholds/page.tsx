import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { ThresholdRow } from '@/components/ThresholdRow/ThresholdRow';
import { describeThreshold, fetchThresholds } from '@/lib/queries/thresholds';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Thresholds · Fydr' };

/** screens/thresholds.md, screen 30. Coach only — see the query file header
 *  for why. Configures the rules; screens/flags.md is where they get acted
 *  on. */
export default async function ThresholdsPage() {
  const { db, orgId, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');

  if (!isCoach) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">
              <Link href="/settings">Settings</Link> · Thresholds
            </p>
            <h1>Thresholds</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="empty">
          <h2>Coach only</h2>
          <p>
            Setting the rules that raise flags is a coaching decision.
            Medical staff are notified by several thresholds but do not
            configure them &mdash; 01-roles-and-permissions.md §2.
          </p>
        </div>
      </>
    );
  }

  const thresholds = await fetchThresholds(db, orgId, true);
  const sections = new Map<string, typeof thresholds>();
  for (const t of thresholds) {
    const list = sections.get(t.domain) ?? [];
    list.push(t);
    sections.set(t.domain, list);
  }

  const activeCount = thresholds.filter((t) => t.is_active).length;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Thresholds
          </p>
          <h1>Thresholds</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/settings/thresholds/new" className="btn-primary">
            + New threshold
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6 }}>
        The rules that raise flags. {activeCount} active,{' '}
        {thresholds.length - activeCount} inactive.
      </p>

      {thresholds.length === 0 ? (
        <EmptyState
          title="No thresholds set"
          body="Flags are raised when a threshold is crossed. Nothing is being watched yet."
        />
      ) : (
        <div className="stack">
          {[...sections.entries()].map(([domain, rows]) => (
            <section className="card flush" key={domain} aria-labelledby={`sec-${domain}`}>
              <h2
                className="sect"
                id={`sec-${domain}`}
                style={{ padding: '14px 16px 8px' }}
              >
                {enumLabel(domain)}
                <span className="tiny mono">{rows.length}</span>
              </h2>
              {rows.map((t) => (
                <ThresholdRow key={t.id} threshold={t} orgId={orgId} sentence={describeThreshold(t)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
