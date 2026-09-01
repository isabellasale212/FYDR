import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList, fetchWellnessRecency } from '@/lib/queries/squad';
import { addDays, BLANK, enumLabel, formatDate, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';

export const metadata = { title: 'Athlete report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** How many of the last seven mornings count as a thin week. Below this, the
 *  report a coach is about to open will be built on four days or fewer, so the
 *  picker says so before they open it rather than after. */
const THIN_WELLNESS = 5;
const WELLNESS_WINDOW_DAYS = 7;

/** screens/reports.md's own entry point list names `athlete-profile.md`,
 *  "Generate report" as the way in — there is no such button on the profile
 *  page in this build, so this picker is the entry point instead.
 *
 *  Rebuilt to Fydr Athlete Picker.dc.html. It was a four-column roster:
 *  number, name, position, availability. Choosing an athlete to report on is a
 *  judgement — is their data thick enough to be worth reading, and can they
 *  train — so the two signals that answer it are in the row now instead of one
 *  click inside the report. */
export default async function AthleteReportPickerPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, timezone } = await requireReportAccess();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const today = todayIso(timezone);
  const windowFrom = addDays(today, -(WELLNESS_WINDOW_DAYS - 1));

  const [groups, rows] = await Promise.all([fetchGroups(db, orgId), fetchSquadList(db, orgId, groupIds)]);
  const wellness = await fetchWellnessRecency(db, rows.map((r) => r.id), windowFrom);

  /* Grouped by POSITIONAL group, which is what the design calls a unit and
   * what this schema already models — group_type 'positional' is Backs and
   * Forwards here. An athlete can belong to several groups (CLAUDE.md §3), so
   * this takes the first positional one they are in; that is a display choice
   * about which heading they appear under, never a change to who is in what. */
  const positional = groups.filter((g) => g.group_type === 'positional');
  const unitOf = (athleteGroupIds: readonly string[]): string =>
    positional.find((g) => athleteGroupIds.includes(g.id))?.name ?? 'No unit set';

  const unitOrder = [...positional.map((g) => g.name), 'No unit set'];
  const grouped = unitOrder
    .map((name) => ({ name, rows: rows.filter((r) => unitOf(r.group_ids) === name) }))
    .filter((g) => g.rows.length > 0);

  const counts = {
    available: rows.filter((r) => r.availability === 'available').length,
    modified: rows.filter((r) => r.availability === 'modified').length,
    unavailable: rows.filter((r) => r.availability === 'unavailable').length,
  };

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Athlete report
          </p>
          <h1>Pick an athlete</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/reports" className="btn-ghost">
            Back
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
        {/* The squad's shape at a glance, counted off the same rows the table
            renders. Each figure carries its status colour so the legend and
            the pills below cannot disagree about what "modified" looks like. */}
        <span className="pick-legend">
          <span>
            <i style={{ background: 'var(--good)' }} />
            {counts.available} available
          </span>
          <span>
            <i style={{ background: 'var(--warn)' }} />
            {counts.modified} modified
          </span>
          <span>
            <i style={{ background: 'var(--bad)' }} />
            {counts.unavailable} unavailable
          </span>
          <span style={{ color: 'var(--faint)' }}>
            n = {rows.length} athlete{rows.length === 1 ? '' : 's'}
          </span>
        </span>
      </div>

      <section className="card cmpl-table" aria-labelledby="pick-title">
        <h2 className="visually-hidden" id="pick-title">
          Squad roster, choose one for their report
        </h2>
        {rows.length === 0 ? (
          <p className="tiny" style={{ padding: '0 0 14px' }}>
            No athlete matches this filter ({groupScopeLabel(groups, groupIds)}) — clear it to see the
            whole squad.
          </p>
        ) : (
          <>
            <div className="pick-head">
              <span style={{ textAlign: 'right' }}>No.</span>
              <span>Athlete</span>
              <span>Position</span>
              <span style={{ textAlign: 'right' }}>Wellness 7d</span>
              <span style={{ textAlign: 'right' }}>Last report</span>
              <span>Availability</span>
              <span />
            </div>
            {grouped.map((group) => (
              <div key={group.name}>
                <div className="pick-group">
                  <span className="pick-group-name">{group.name}</span>
                  <span className="pick-group-rule" aria-hidden="true" />
                  <span className="pick-group-count">
                    {group.rows.length} athlete{group.rows.length === 1 ? '' : 's'}
                  </span>
                </div>
                {group.rows.map((row) => {
                  const w = wellness.get(row.id) ?? { last7: 0, lastEntry: null };
                  const thin = w.last7 < THIN_WELLNESS;
                  const flagged = row.availability !== 'available';
                  return (
                    <Link
                      key={row.id}
                      href={`/reports/athlete/${row.id}`}
                      className="pick-row"
                      data-flagged={flagged}
                    >
                      <span className="pick-no">{row.squad_number ?? BLANK}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="pick-name" style={{ display: 'block' }}>
                          {row.first_name} {row.last_name}
                        </span>
                        {/* The RESTRICTION only. Coaching staff see what an
                            athlete can and cannot do; diagnosis and treatment
                            notes are medical-only (CLAUDE.md rule 3), and
                            nothing on this row comes from a clinical table. */}
                        {row.restrictions.length > 0 ? (
                          <span className="pick-note">{row.restrictions.map(enumLabel).join(' · ')}</span>
                        ) : null}
                      </span>
                      <span className="pick-position">{row.position ?? BLANK}</span>
                      <span className="pick-wellness">
                        <span className="pick-wellness-track">
                          <span
                            className="pick-wellness-fill"
                            data-thin={thin}
                            style={{ width: `${Math.round((100 * w.last7) / WELLNESS_WINDOW_DAYS)}%` }}
                          />
                        </span>
                        <span className="pick-wellness-value" data-thin={thin}>
                          {w.last7} of {WELLNESS_WINDOW_DAYS}
                        </span>
                      </span>
                      <span className="pick-last" data-none={w.lastEntry === null}>
                        {w.lastEntry ? formatDate(w.lastEntry, timezone) : BLANK}
                      </span>
                      <span>
                        <span
                          className={`pill ${
                            row.availability === 'available'
                              ? 'pill-good'
                              : row.availability === 'modified'
                                ? 'pill-warn'
                                : row.availability === 'unavailable'
                                  ? 'pill-bad'
                                  : 'pill-neutral'
                          }`}
                        >
                          {row.availability === 'unknown' ? 'Unknown' : enumLabel(row.availability)}
                        </span>
                      </span>
                      <span className="pick-chev" aria-hidden="true">
                        &rsaquo;
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
            <p className="inj-foot">
              Wellness 7d counts morning entries submitted in the last seven days, not their scores.
              Modified athletes show the restriction only — diagnosis and treatment notes are visible to
              medical staff and the athlete concerned. {groupScopeLabel(groups, groupIds)} · {orgName}.
            </p>
          </>
        )}
      </section>
    </>
  );
}
