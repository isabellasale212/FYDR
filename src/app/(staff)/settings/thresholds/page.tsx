import Link from 'next/link';
import { SeedDefaultThresholds } from '@/components/SeedDefaultThresholds/SeedDefaultThresholds';
import { ThresholdRow } from '@/components/ThresholdRow/ThresholdRow';
import { describeThreshold, fetchThresholds } from '@/lib/queries/thresholds';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { THRESHOLD_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Thresholds · Fydr' };

/** screens/thresholds.md, screen 30. Coach only — see the query file header
 *  for why. Configures the rules; screens/flags.md is where they get acted
 *  on. */
export default async function ThresholdsPage() {
  const { db, orgId, claims } = await requireStaff();
  /* §3.6 Thresholds is VECD for the coach AND the sport scientist. This read
     `isCoach` alone, so it refused the sport scientist from configuring the
     rules that raise flags. */
  if (!hasAnyRole(claims.roles, THRESHOLD_EDIT)) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">
              <Link href="/settings">Settings</Link> · Thresholds
            </p>
            <h1>Thresholds</h1>
          </div>
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            Setting the rules that raise flags belongs to the coach and the
            sport scientist. Other staff are notified by several thresholds and
            can read them, but do not configure them &mdash; access matrix §3.6.
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
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6 }}>
        The rules that raise flags. {activeCount} active,{' '}
        {thresholds.length - activeCount} inactive.
      </p>

      {/* Was a bare <EmptyState>, which named the absence honestly and then left
          the coach with nowhere to go but "+ New threshold" and a blank form.
          Answers the coach's own question ("do we have general default
          thresholds for each club to use and start with?") in the one place it
          gets asked — see migration 0059 and SeedDefaultThresholds's header.
          Only this branch changes; a club with rules already sees exactly what
          it saw before. The shared EmptyState component is untouched: it takes
          no children by design, and widening it for one caller would push this
          screen's copy into a component five other screens share. */}
      {thresholds.length === 0 ? (
        <SeedDefaultThresholds orgId={orgId} />
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
                <span className="tiny num">{rows.length}</span>
              </h2>
              {rows.map((t) => (
                <ThresholdRow
              canManage={hasAnyRole(claims.roles, THRESHOLD_EDIT)} key={t.id} threshold={t} orgId={orgId} sentence={describeThreshold(t)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
