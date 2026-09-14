import Link from 'next/link';
import { AnalyticsPanel, type PanelBand } from '@/components/AnalyticsPanel/AnalyticsPanel';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import { ANALYTICS, hasAnyRole } from '@/lib/access';
import { METRICS, type MetricDef } from '@/lib/analyticsBuilder';
import {
  DEFAULT_WINDOW_DAYS,
  PANELS,
  WINDOWS,
  axisTop,
  axisWords,
  bucketValue,
  bucketsFor,
  fmt,
  grainFor,
  grainWords,
  groundWords,
  squadBand,
  suppression,
  zoneFor,
  zoneWords,
  type Panel,
} from '@/lib/analyticsPanels';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchBuilderAthletes, fetchPerAthleteDaily } from '@/lib/queries/analytics';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchThresholds } from '@/lib/queries/thresholds';
import { isRpeAnalyticsMetric, rpeOffLine } from '@/lib/rpeSetting';
import { refuse, requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Analytics · Fydr' };

/* ANALYTICS — PATTERN-S7 C6 (Isabella, 2026-09-13; built 2026-09-14), the
 * board "PATTERN-S7 · FINAL" artboards 9–11. Four fixed panels of bars —
 * Training load, Wellness, Gym volume, Acute to chronic — one athlete against
 * the squad's spread, or against the club's zone where one is set; Compare
 * two names each series at the end of its own bars; the group filter is the
 * population compared against. Every panel states what it measures, over
 * what window, what the ground is, and n, in one line under the title —
 * never a tooltip. The axis starts at zero and the axis line says so. One
 * bar per day up to a fortnight, one per week beyond, summed for a volume
 * measure and meaned for a scored one (lib/analyticsPanels). Hover or tap a
 * bar for its value; a tap stays. A period with nothing is a dashed stub
 * that reads "Not submitted" (or the measure's own words). Below three bars
 * with a value the panel is withheld and says why, with one action.
 *
 * NO EXPORT. A question worth keeping leaves as a report — the thing with a
 * definition, a row count, a print layout and an audit row.
 *
 * This replaced the four day-only boards with their metric dropdowns and
 * the coloured chart family, and with it /analytics/build (D2: "stays until
 * C6 replaces it"). All four panels read real tables through the same engine
 * as before (fetchPerAthleteDaily, one code path for the collapse, the ACWR
 * trailing ratio and the in_data denominator). docs/screens/42-analytics.md.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function metricFor(panel: Panel): MetricDef {
  const m = METRICS.find((x) => x.key === panel.metric);
  if (!m) throw new Error(`Unknown metric ${panel.metric}`);
  return m;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, timezone, tier, claims, collectsRpe } = await requireStaff();
  /* D-02: Analytics is the sport scientist's alone. Confirmed 2026-09-05. */
  if (!hasAnyRole(claims.roles, ANALYTICS)) await refuse(db, 'analytics', '/analytics');
  /* 12-product-tiers.md §2.3 row 27: the whole destination is Premium, refused
   * at the route as well as absent from the sidebar. requireStaff() has
   * already resolved the preview through effectiveTier(), downward only. */
  if (!isPremium(tier)) {
    return (
      <PlanGate
        featureName="Analytics"
        body="Four panels of bars — training load, wellness, gym volume and the acute to chronic ratio — one athlete against the squad, or two athletes side by side."
        metadata="Premium · analytics · four panels"
      />
    );
  }

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const [groups, athletes, thresholds] = await Promise.all([fetchGroups(db, orgId), fetchBuilderAthletes(db, orgId, groupIds), fetchThresholds(db, orgId, false)]);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  /* Athlete A defaults to the first in scope so the screen is never empty on
   * arrival. Compare two is opt-in; B defaults to the next athlete. */
  const aId = typeof params.a === 'string' && athletes.some((x) => x.id === params.a) ? params.a : (athletes[0]?.id ?? null);
  const comparing = params.compare === '1';
  const bId =
    comparing && typeof params.b === 'string' && athletes.some((x) => x.id === params.b) && params.b !== aId
      ? params.b
      : comparing
        ? (athletes.find((x) => x.id !== aId)?.id ?? null)
        : null;
  const a = athletes.find((x) => x.id === aId) ?? null;
  const b = athletes.find((x) => x.id === bId) ?? null;

  /* One window for the page, clamped to the offered list. The grain follows it. */
  const days = (typeof params.w === 'string' && WINDOWS.find((w) => String(w.days) === params.w)?.days) || DEFAULT_WINDOW_DAYS;
  const grain = grainFor(days);
  const today = todayIso(timezone);
  const range = { from: addDays(today, -(days - 1)), to: today };
  const buckets = bucketsFor(range.from, range.to, grain);

  const qs = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const groupsQs = Array.isArray(params.groups) ? params.groups.join(',') : params.groups;
    if (groupsQs) sp.set('groups', groupsQs);
    if (aId) sp.set('a', aId);
    if (bId) sp.set('b', bId);
    if (comparing) sp.set('compare', '1');
    if (days !== DEFAULT_WINDOW_DAYS) sp.set('w', String(days));
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const q = sp.toString();
    return q ? `?${q}` : '';
  };
  const wider = WINDOWS.find((w) => w.days > days) ?? null;

  /* Who set each zone rule: the thresholds read carries created_by; the name
   *  is read once for every rule a panel might quote. */
  const setterIds = [...new Set(thresholds.map((t) => t.created_by).filter((x): x is string => !!x))];
  const setters = new Map<string, string>();
  if (setterIds.length > 0) {
    const { data } = await db.from('users').select('id, full_name').eq('org_id', orgId).in('id', setterIds);
    for (const u of data ?? []) setters.set(u.id, u.full_name);
  }

  const panelData = a
    ? await Promise.all(
        PANELS.map(async (panel) => {
          const metric = metricFor(panel);
          const rpeOff = !collectsRpe && isRpeAnalyticsMetric(metric.key);
          if (rpeOff) return { panel, metric, rpeOff: true as const };
          /* The whole scope in one read: A's bars, B's bars and the squad's
           * spread all come from the same per-athlete daily maps. */
          const daily = await fetchPerAthleteDaily(db, orgId, metric, range, groupIds, null);
          const valuesA = daily.perAthlete.get(a.id) ?? new Map<string, number>();
          const valuesB = b ? (daily.perAthlete.get(b.id) ?? new Map<string, number>()) : null;
          const seriesA = buckets.map((bk) => bucketValue(valuesA, bk, panel.measure));
          const seriesB = valuesB ? buckets.map((bk) => bucketValue(valuesB, bk, panel.measure)) : null;
          const zone = zoneFor(panel, thresholds);
          const bands: PanelBand[] = buckets.map((bk) => {
            const e = squadBand(daily.perAthlete, bk, panel.measure);
            return e ? { lo: e.lo, hi: e.hi } : null;
          });
          /* n for the definition line: athletes in scope with any value in the window. */
          let nWithData = 0;
          for (const [, values] of daily.perAthlete) if ([...values.keys()].some((d) => d >= range.from && d <= range.to)) nWithData += 1;
          const zoneRule = zone ? thresholds.find((t) => zone.names.includes(t.name)) ?? null : null;
          const zoneText = zone ? zoneWords(zone, panel, zoneRule?.created_by ? (setters.get(zoneRule.created_by) ?? null) : null, formatDate(zone.setAt.slice(0, 10), timezone)) : null;
          const top = axisTop(panel, [...seriesA, ...(seriesB ?? []), ...bands.map((e) => e?.hi ?? null), zone?.hi ?? null]);
          const points = seriesA.filter((v) => v !== null).length;
          const held = suppression({
            points,
            buckets: buckets.length,
            grain,
            days,
            athleteName: `${a.first_name} ${a.last_name}`,
            widenHref: wider ? `/analytics${qs({ w: String(wider.days) })}` : null,
            reportHref: `/reports/athlete/${a.id}`,
          });
          const lastIdx = (() => { for (let i = seriesA.length - 1; i >= 0; i -= 1) if (seriesA[i] !== null) return i; return -1; })();
          return { panel, metric, rpeOff: false as const, seriesA, seriesB, bands, zone, zoneText, top, nWithData, held, lastIdx };
        }),
      )
    : [];

  const bucketLabels = buckets.map((bk) => ({ label: bk.label, long: grain === 'day' ? formatDate(bk.start, timezone) : `${formatDate(bk.start, timezone)} to ${formatDate(bk.end, timezone)}` }));

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {scopeLabel.toUpperCase()} · {orgName.toUpperCase()}
          </p>
          <h1>Analytics</h1>
        </div>
        <div className="cmp-athletes">
          <ReportSelectNav
            stacked
            label="Athlete"
            paramKey="a"
            value={aId ?? ''}
            options={athletes.map((x) => ({ value: x.id, label: `${x.last_name}, ${x.first_name}` }))}
            clearValue={athletes[0]?.id ?? ''}
            ariaLabel="Athlete"
          />
          {comparing ? (
            <ReportSelectNav
              stacked
              label="Compared with"
              paramKey="b"
              value={bId ?? ''}
              options={athletes.filter((x) => x.id !== aId).map((x) => ({ value: x.id, label: `${x.last_name}, ${x.first_name}` }))}
              clearValue={athletes.find((x) => x.id !== aId)?.id ?? ''}
              ariaLabel="Athlete compared with"
            />
          ) : null}
          <ReportSelectNav
            stacked
            label="Window"
            paramKey="w"
            value={String(days)}
            options={WINDOWS.map((w) => ({ value: String(w.days), label: w.label }))}
            clearValue={String(DEFAULT_WINDOW_DAYS)}
            ariaLabel="Window"
          />
          {/* A link, not a switch: the whole comparison is a URL. */}
          <Link href={`/analytics${qs({ compare: comparing ? undefined : '1', b: undefined })}`} className="squad-chip" aria-pressed={comparing} data-compare>
            Compare two
          </Link>
        </div>
      </div>

      <div className="cmp-against" style={{ marginBottom: 'var(--sp-14)' }}>
        <span className="cmp-against-label">Compare against</span>
        <GroupFilter groups={groups} selected={groupIds} />
        <span className="cmp-against-n">
          n = {athletes.length} · {scopeLabel.toLowerCase()}
        </span>
      </div>

      {!a ? (
        <div className="empty">
          <h2>Nobody in scope</h2>
          <p>The group filter resolves to no athletes, so there is nothing to chart. Widen it and the four panels return.</p>
        </div>
      ) : (
        <div className="cmp-grid">
          {panelData.map((d) => {
            const { panel } = d;
            const windowWords = `last ${days} days, ${formatDate(range.from, timezone)} to ${formatDate(range.to, timezone)}`;
            return (
              <section key={panel.key} className="card" aria-labelledby={`p-${panel.key}`} data-panel={panel.key}>
                <div className="cmp-card-head">
                  <h2 className="cmp-card-title" id={`p-${panel.key}`}>
                    {panel.title}
                  </h2>
                  {d.rpeOff ? null : (
                    <span className="cmp-picker-meta" style={{ marginLeft: 'auto' }}>
                      {a.last_name}
                      {b ? ` and ${b.last_name}` : ''}
                    </span>
                  )}
                </div>
                {d.rpeOff ? (
                  /* Migration 0118: the club setting. The panel keeps its
                     place and says why the plot is not drawn (the absence rule). */
                  <p className="import-sub" style={{ marginBottom: 0 }} data-rpe-off>
                    {rpeOffLine(`${panel.title.toLowerCase()} on this panel`)}
                  </p>
                ) : (
                  <>
                    <p className="ap-def" data-definition>
                      {panel.measures} · {windowWords} · {grainWords(panel, grain)} · {groundWords({ zone: d.zoneText, nWithData: d.nWithData, scope: scopeLabel.toLowerCase(), grain })}.
                    </p>
                    {d.held ? (
                      <div className="ap-suppressed" data-suppressed>
                        <p style={{ margin: 0 }}>{d.held.reason}</p>
                        <Link href={d.held.action.href} className="btn-ghost">
                          {d.held.action.label}
                        </Link>
                      </div>
                    ) : (
                      <>
                        {/* The figure: the latest bar, printed — never on hover alone. */}
                        <p className="ap-figure" data-figure>
                          {d.lastIdx >= 0 ? (
                            <>
                              <b>{fmt(d.seriesA[d.lastIdx]!, panel.decimals)}{panel.unit}</b> · {bucketLabels[d.lastIdx]!.long}
                              {d.seriesB && d.seriesB[d.lastIdx] !== null ? ` · ${b!.last_name} ${fmt(d.seriesB[d.lastIdx]!, panel.decimals)}${panel.unit}` : ''}
                              {' · '}
                              <Link href={`/reports/athlete/${a.id}`}>full detail in the athlete report</Link>
                            </>
                          ) : (
                            'No value in this window.'
                          )}
                        </p>
                        <AnalyticsPanel
                          title={panel.title}
                          unit={panel.unit}
                          decimals={panel.decimals}
                          missingWord={panel.missingWord}
                          buckets={bucketLabels}
                          a={{ label: a.last_name, values: d.seriesA }}
                          b={b && d.seriesB ? { label: b.last_name, values: d.seriesB } : null}
                          band={d.zone ? null : d.bands}
                          zone={d.zone ? { lo: d.zone.lo, hi: d.zone.hi } : null}
                          top={d.top}
                          axisLine={axisWords(panel, d.top, grain)}
                        />
                      </>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="cap" data-no-export>
        Analytics has no export. A question worth keeping leaves as a report — the athlete report, the squad weekly or the training load report carry a definition, a row count, a print layout and an audit row.
      </p>
    </>
  );
}
