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

  const [groups, allRows] = await Promise.all([fetchGroups(db, orgId), fetchSquadList(db, orgId, groupIds)]);

  /* Search is a plain `?q=`, filtered here rather than in the query: the group
   * filter is already applied in the database (groupFilter.ts's header explains
   * why that one has to be), and a squad is a few dozen rows, so a second round
   * trip per keystroke would buy nothing. Name, position and squad number,
   * because those are the three things on the row a coach would type. */
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const needle = q.toLowerCase();
  const rows = needle
    ? allRows.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) ||
          (r.position ?? '').toLowerCase().includes(needle) ||
          String(r.squad_number ?? '').includes(needle),
      )
    : allRows;

  const wellness = await fetchWellnessRecency(db, rows.map((r) => r.id), windowFrom, today);

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

  /* When EVERY athlete in scope reads "0 of 7", 29 identical zeros are
     technically honest and practically useless: they cannot distinguish "the
     squad stopped submitting" from "the feed is broken" or "the window is
     wrong". Said once, in words, with the date of the most recent entry that
     does exist — which is the fact that tells those three apart. */
  const recentTotal = rows.reduce((n, r) => n + (wellness.get(r.id)?.last7 ?? 0), 0);
  const mostRecentEntry = rows.reduce<string | null>((acc, r) => {
    const e = wellness.get(r.id)?.lastEntry ?? null;
    return e !== null && (acc === null || e > acc) ? e : acc;
  }, null);
  const squadWideSilence = rows.length > 0 && recentTotal === 0;

  /* Exactly what the URL carried, or nothing at all. See the form below. */
  const groupParam =
    params.groups === undefined ? [] : Array.isArray(params.groups) ? params.groups : [params.groups];

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
        {/* A real GET form, so it works with the keyboard and without JS and the
            result is a shareable URL — the same reasoning `?groups=` already
            uses. The group filter is carried across the submit ONLY when the
            URL already names it: resolveGroupFilter() treats a present-but-
            empty `groups` as "the user just cleared it", so echoing an empty
            hidden field would silently wipe a filter that came from the
            cookie. Absent means absent, and the cookie resolves it again. */}
        <form method="get" role="search" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {groupParam.map((value, i) => (
            <input key={`${value}-${i}`} type="hidden" name="groups" value={value} />
          ))}
          <input
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, position or number"
            aria-label="Search athletes"
            style={{ width: 260 }}
          />
          <Link href="/reports" className="btn-ghost">
            Back
          </Link>
        </form>
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

      {squadWideSilence ? (
        <div className="note" style={{ marginBottom: 14, borderColor: 'var(--warn)' }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>
              No morning entries from anyone in this scope in the last {WELLNESS_WINDOW_DAYS} days.
            </b>{' '}
            {mostRecentEntry
              ? `The most recent was ${formatDate(mostRecentEntry, timezone)}, so this is a squad that has stopped submitting rather than one with no history.`
              : 'And none on record at all, so this scope has never submitted — a new squad, or a group filter that catches nobody who reports.'}{' '}
            Every row below reads 0 of {WELLNESS_WINDOW_DAYS} for that reason, not because the
            reports are empty.
          </p>
        </div>
      ) : null}

      <section className="card cmpl-table" aria-labelledby="pick-title">
        <h2 className="visually-hidden" id="pick-title">
          Squad roster, choose one for their report
        </h2>
        {rows.length === 0 ? (
          <p className="tiny" style={{ padding: '0 0 14px' }}>
            {q ? (
              <>
                No athlete matches &ldquo;{q}&rdquo; in {groupScopeLabel(groups, groupIds)}
                {allRows.length > 0 ? (
                  <>
                    {' '}
                    — {allRows.length} athlete{allRows.length === 1 ? '' : 's'} match the group filter
                    alone.
                  </>
                ) : (
                  '.'
                )}
              </>
            ) : (
              <>
                No athlete matches this filter ({groupScopeLabel(groups, groupIds)}) — clear it to see
                the whole squad.
              </>
            )}
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
              {q ? (
                <>
                  Showing {rows.length} of {allRows.length} athlete{allRows.length === 1 ? '' : 's'}{' '}
                  matching &ldquo;{q}&rdquo;.{' '}
                </>
              ) : null}
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
