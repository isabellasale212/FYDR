import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchAcwr, fetchWellnessTrend } from '@/lib/queries/analytics';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatNumber } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Analytics · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/analytics.md, screen 27, cut to two of the five shipped presets — see
 *  lib/queries/analytics.ts for exactly which and why. Fixed presets, not the
 *  custom builder: no saved_views table exists to save one to. */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, timezone } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, acwr, wellness] = await Promise.all([
    fetchGroups(db, orgId),
    fetchAcwr(db, orgId, timezone, groupIds),
    fetchWellnessTrend(db, orgId, timezone, groupIds),
  ]);

  const acwrSuppressedCount = acwr.filter((r) => r.suppressed).length;
  const outliers = wellness.filter((r) => r.outlier);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Analytics</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <section className="card" aria-labelledby="acwr-title">
        <h2 className="card-title" id="acwr-title">
          Acute:chronic workload ratio
        </h2>
        <p className="import-sub">
          Who is loading faster than they have adapted to. Acute is the last 7 days of
          session load; chronic is the last 28 days, averaged to a weekly figure.
        </p>

        {acwr.every((r) => r.suppressed) ? (
          <p className="cap">
            Not enough training history yet. ACWR needs at least 21 of the last 28 days
            to carry a training entry for any athlete, squad-wide.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <caption className="visually-hidden">Acute:chronic workload ratio by athlete</caption>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col" className="r">
                    Acute
                  </th>
                  <th scope="col" className="r">
                    Chronic
                  </th>
                  <th scope="col" className="r">
                    ACWR
                  </th>
                </tr>
              </thead>
              <tbody>
                {acwr
                  .filter((r) => !r.suppressed)
                  .map((r) => {
                    const flagged = r.acwr !== null && (r.acwr < 0.8 || r.acwr > 1.5);
                    return (
                      <tr key={r.athlete_id}>
                        <td className="nm">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="r mono">{formatNumber(r.acute, 0)}</td>
                        <td className="r mono">{formatNumber(r.chronic, 0)}</td>
                        <td className="r mono">
                          <span className={flagged ? 'pill pill-warn' : undefined}>
                            {formatNumber(r.acwr, 2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {acwrSuppressedCount > 0 ? (
          <p className="cap">
            {acwrSuppressedCount} athlete{acwrSuppressedCount === 1 ? '' : 's'} suppressed:
            fewer than 21 of the last 28 days have a training entry. Not estimated from
            what exists.
          </p>
        ) : null}

        <div className="note" style={{ marginTop: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>ACWR is a descriptive ratio.</b> The evidence linking specific ACWR values
            to injury risk is contested, and the 0.8 to 1.5 band is a convention rather
            than a validated threshold. Use it to find athletes whose load changed
            sharply, not to predict injury.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="wellness-trend-title">
        <h2 className="card-title" id="wellness-trend-title">
          Wellness trend
        </h2>
        <p className="import-sub">
          Whose readiness has moved against their own norm &mdash; never the squad
          average, always their own history.
        </p>

        {outliers.length === 0 ? (
          <p className="cap">
            Nobody is currently more than 1.5 standard deviations below their own
            baseline.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <caption className="visually-hidden">Athletes below their own wellness baseline</caption>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col" className="r">
                    Readiness
                  </th>
                  <th scope="col" className="r">
                    Own baseline
                  </th>
                  <th scope="col" className="r">
                    z
                  </th>
                </tr>
              </thead>
              <tbody>
                {outliers.map((r) => (
                  <tr key={r.athlete_id}>
                    <td className="nm">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="r mono">{formatNumber(r.readiness, 0)}</td>
                    <td className="r mono">{formatNumber(r.band?.mean ?? null, 0)}</td>
                    <td className="r mono">
                      <span className="pill pill-warn">{formatNumber(r.z, 1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="cap">
          {wellness.filter((r) => r.observations < 10).length} of {wellness.length}{' '}
          athletes have fewer than 10 prior check-ins, so their own baseline is not
          shown yet &mdash; their raw readiness still counts, a personal norm just
          cannot be drawn from too little history.
        </p>
      </section>

      <p className="cap">
        More presets are planned &mdash; compliance trends, load distribution by matchday, and
        the nutrition check-in trend &mdash; and aren&rsquo;t available yet.
      </p>
    </>
  );
}
