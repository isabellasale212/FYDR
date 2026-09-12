import Link from 'next/link';
import { DashboardFlagsPanel } from '@/components/DashboardFlagsPanel/DashboardFlagsPanel';
import { DashboardHeadlineStats } from '@/components/DashboardHeadlineStats/DashboardHeadlineStats';
import { Dial } from '@/components/Dial/Dial';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { FIXTURE_RANGE_DAYS, fetchEffectiveToday, fetchHeadlineStats, fetchOutstandingTracks, fetchSaturdayReadiness, fetchTimeline, fetchWeekStrip, type ReadinessRowKey, type SessionPip } from '@/lib/queries/dashboard';
import { fetchGroups } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, formatLongDate, matchdayWeekday, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Dashboard · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* Light-theme handoff §6, domain colour-coding: "one dot, bar segment, or tint
 * per domain". Three fixes came out of applying it here.
 *
 * 1. `recovery` and `meeting` were the SAME raw rgba(16,18,23,0.2) — two
 *    session types rendering one indistinguishable pip, and two raw colour
 *    literals in a component, which CLAUDE.md §8 rules out. Recovery takes the
 *    handoff's own --domain-recovery slate; meeting takes the neutral-ink
 *    alpha that scheduleGeometry.ts's TYPE_STYLE already gives it, so the two
 *    surfaces that draw a meeting now draw it the same colour.
 * 2. `testing` was --accent2 here and --good in TYPE_STYLE. The handoff settles
 *    it at #4fd6ff, which is --good now, so --domain-testing points at both.
 * 3. Nothing else moved: training, gym, rehab and match were already the
 *    handoff's values under the names this codebase gives them. */
const PIP_COLOR: Record<SessionPip, string> = {
  training: 'var(--accent)',
  gym: 'var(--domain-gym)',
  rehab: 'var(--warn)',
  testing: 'var(--domain-testing)',
  match: 'var(--bad)',
  recovery: 'var(--domain-recovery)',
  meeting: 'rgb(var(--ink-rgb) / 0.3)',
};

/* The four domains the week strip's legend names, in the Visual Lift's own
 * order. Training and match are deliberately absent: the legend explains the
 * dots a coach might not recognise, and those two are self-evident from the
 * activity titles beside them. */
const WEEK_LEGEND: { type: SessionPip; label: string }[] = [
  { type: 'gym', label: 'Gym' },
  { type: 'training', label: 'Pitch' },
  { type: 'testing', label: 'Testing' },
  { type: 'recovery', label: 'Recovery' },
];

/* FILLS. Bars and swatches — a block of colour, where the raw tone is right. */
const TONE_VAR: Record<string, string> = { good: 'var(--accent2)', accent: 'var(--accent)', accent2: 'var(--accent2)', warn: 'var(--warn)', bad: 'var(--bad)' };

/* TEXT, which is a different question and was being answered with the fill
 * map above. A tone is chosen to be seen as an area; as a 13px numeral it was
 * measuring 2:1 on white and 1.5:1 once the Ready card took its tint — the
 * count telling a coach how many players are doubtful was the least readable
 * thing in the card. These are the derived pill-text tokens, the same
 * distinction tokens.css §3.7 already draws for --accent-text against
 * --accent-pill-text. */
const TONE_TEXT: Record<string, string> = {
  warn: 'var(--warn-pill-text)',
  bad: 'var(--bad-pill-text)',
};

/* The three rows that ARE segments of the availability bar directly above
 * them, and the colour that says which. The other two readiness rows are
 * selection inputs rather than slices of the squad, so they take no dot —
 * absence here is the test, not a second list. */
/* "1 days out" — what the card read once the merge put this line under a
 * fixture one day away. 0 is matchday itself, which "0 days out" says badly. */
function daysOutLabel(daysOut: number | null): string {
  if (daysOut === null) return '\u2014 days out';
  if (daysOut === 0) return 'today';
  return daysOut === 1 ? '1 day out' : `${daysOut} days out`;
}

const ROW_DOT: Partial<Record<ReadinessRowKey, string>> = {
  available: 'var(--accent2)',
  modified: 'var(--warn)',
  unavailable: 'var(--bad)',
};

/* Every readiness row already drew a chevron and a pointer cursor; none of
 * them was a link. Merging the two cards forced the issue, because the "Squad
 * ›" link on the deleted Squad state card was a real destination that would
 * otherwise have gone with it — so the three availability rows inherit it,
 * and the other two get the page they were pointing at all along. */
const ROW_HREF: Record<ReadinessRowKey, string> = {
  available: '/squad',
  modified: '/squad',
  unavailable: '/squad',
  flags: '/flags',
  sessions: '/schedule',
};

/* One day, and only one day. The week strip and the week list are gone: the
 * dashboard answers "what is happening now", and a six-day recap on the same
 * screen answered a question Schedule already owns better, with a real week
 * grid rather than six stacked summaries. */

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

/** "Today" only when the date IS wall-clock today — a dashboard anchored to
 *  the latest day with data (see the banner) titles that day by its real
 *  name, never "Today" (audit S2). */
function dayTitle(date: string, wallClockToday: string): string {
  if (date === wallClockToday) return 'Today';
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** DASHBOARD-SPEC.md — the coach's 07:00 screen, twelve sections rebuilt
 *  pixel-for-pixel. lib/queries/dashboard.ts's own header records the
 *  three real, load-bearing decisions this rebuild made: what "today"
 *  means for a seeded dataset with a real edge (fetchEffectiveToday), how
 *  a flag with no session_id column at all still surfaces under the
 *  session it's really about, and why "doubtful" is every modified
 *  athlete uniformly rather than a guess read out of free text. Read that
 *  file's header before extending this page — most of the judgement calls
 *  live there, not here. */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, timezone } = await requireStaff();

  // 01-roles-and-permissions.md (superseded) §2: admin gets `no` for "View squad
  // dashboard" — every panel below is named-athlete availability, load and
  // flag detail. docs/20-route-map.md §11 G-1 resolves the one place the
  // docs disagree (02-information-architecture.md §4.2 sketches an admin
  // panel order for this same page) in the matrix's favour: "an admin-only
  // user does not open /dashboard". Sidebar.tsx's staff.dashboard row is
  // already coach/medical only, so this is the server-side lock behind
  // that hidden row — homeRoute() in lib/supabase/claims.ts no longer
  // lands an admin-only sign-in here, but a typed URL still could without
  // this. Same pattern as /flags, /squad and /analytics.
  /* Was `coach || medic`, which in the four-role model was the phrase for "any
     staff who is not an admin". The sport scientist, the S&C and the
     nutritionist are none of those, so this screen refused all three. The
     access matrix gives every staff role this page. */
    /* No role gate here, and that is the rule rather than an omission. This page
     is open to every staff role: requireStaff() has already turned away anyone
     who is not staff, and ALL_STAFF is by definition the rest.

     There WAS a gate, keyed on the four-role model's `coach || medic` — the
     phrase that model used for "any staff who is not an admin". The five-role
     model has no admin, so that phrase excluded the sport scientist, the S&C and
     the nutritionist, and G-39 corrected it to ALL_STAFF. What it left behind was
     a refusal branch that could no longer fire, rendering "Not part of this role"
     for a condition nothing satisfies, explained by a comment citing a document
     that now says do not build against it. Removed 2026-09-06: unreachable code
     that reads as a live rule is worse than no code, because the next audit
     believes it. */

  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const wallClockToday = todayIso(timezone);
  const effectiveToday = await fetchEffectiveToday(db, orgId, wallClockToday);
  const weekStart = mondayOf(effectiveToday);
  // fetchWeekStrip renders 6 days (Monday-Saturday, i = 0..5) — weekEnd here
  // has to match that, not weekStart itself. The old bounds check compared
  // sp.day against weekStart on both ends (`sp.day >= weekStart && sp.day <=
  // weekStart`, equivalent to `sp.day === weekStart`), which is never true
  // for a real ?day= value from later in the week, so it always fell
  // through to the unconditional `typeof sp.day === 'string' ? sp.day :
  // effectiveToday` — accepting any string, including a stale ?day= from a
  // different week, with no bounds check at all.
  const weekEnd = addDays(weekStart, 5);

  const selectedDay = typeof sp.day === 'string' && sp.day >= weekStart && sp.day <= weekEnd ? sp.day : effectiveToday;

  /* NO PERIOD ON THIS SCREEN. The dashboard is one day — the day strip and the
   * week list are gone, the selector is gone, and with nothing left to window
   * there is no period to resolve. That also removes this screen as a writer of
   * the account-wide `fydr-period` cookie, which was the single most damaging
   * write there is: homeRoute() lands every coach and medical sign-in here, and
   * this screen had the narrowest allow-list in the app, so a sticky write from
   * it seeded the whole account with a key no report accepts. Longer windows
   * live on Analytics, which has its own per-board controls. */

  const [groups, stats, week, timeline, readiness, outstanding] = await Promise.all([
    fetchGroups(db, orgId),
    fetchHeadlineStats(db, orgId, groupIds, effectiveToday, wallClockToday, timezone),
    fetchWeekStrip(db, orgId, groupIds, weekStart, effectiveToday, timezone),
    // "now" is the real instant — a session is "passed" against the real
    // clock, never against an end-of-day stand-in (audit S2).
    fetchTimeline(db, orgId, groupIds, selectedDay, new Date().toISOString(), timezone),
    fetchSaturdayReadiness(db, orgId, groupIds, effectiveToday, timezone),
    fetchOutstandingTracks(db, orgId, groupIds, effectiveToday),
  ]);

  /* The week strip's header line, derived from the strip's own days rather
   * than re-queried: the count is literally the number of activities rendered
   * in the columns below, so the two can never disagree. dayLabel is already
   * "Mon 10" / "Sat 15", which is the form the header wants.
   *
   * This replaced a second count taken off weekTimeline, which was fed by a
   * fetch that only runs in week mode — so it read 0 in day mode while the
   * strip beside it listed real sessions. Both counted the same rows from the
   * same query (fetchWeekStrip calls fetchWeekSessions itself), so collapsing
   * them to the always-present one loses nothing and removes the disagreement. */
  const weekSessionCount = week.reduce((n, d) => n + d.activities.length, 0);
  /* dayLabel is "Mon 31" — weekday and day, no month — so a bare "Mon 31 to
   * Sat 5" is ambiguous, and actively wrong-looking in a week that crosses a
   * month boundary, which is exactly the week this was first seen on
   * (31 Aug - 5 Sep). The month is appended once when the week sits inside one
   * month and on both ends when it does not. UTC noon to match dayLabelFor,
   * which builds the day numbers the same way. */
  const monthOf = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const weekFirst = week[0]?.dayLabel ?? '';
  const weekLast = week[week.length - 1]?.dayLabel ?? '';
  const weekRangeLabel =
    monthOf(weekStart) === monthOf(weekEnd)
      ? `${weekFirst} to ${weekLast} ${monthOf(weekEnd)}`
      : `${weekFirst} ${monthOf(weekStart)} to ${weekLast} ${monthOf(weekEnd)}`;

  const isAnchoredToPast = effectiveToday !== wallClockToday;

  const groupsQs = groupIds.length > 0 ? groupIds.join(',') : undefined;
  const isSelectedToday = selectedDay === effectiveToday;
  const selectedDayMd = week.find((d) => d.date === selectedDay)?.md ?? null;

  const dayCaption = isSelectedToday
    ? `${formatDate(effectiveToday, timezone)} · ${timeline.length} session${timeline.length === 1 ? '' : 's'}${timeline.length > 0 ? ` · first at ${timeline[0]!.time}` : ''}`
    : selectedDay < effectiveToday
      ? `complete${timeline.length > 0 ? ` · ${timeline.length} session${timeline.length === 1 ? '' : 's'}` : ''}`
      : `${timeline.length} session${timeline.length === 1 ? '' : 's'} planned`;

  /* The day the next fixture is actually on. Both the eyebrow and the
     readiness card used to say "Saturday" as a literal — in the eyebrow's case
     in BOTH branches, so a Tuesday fixture read "MD SATURDAY" and a club with
     no fixture read it too. */
  const matchday = matchdayWeekday(readiness.kickoffAt, timezone);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            WEEK OF {formatLongDate(weekStart, timezone).toUpperCase()}
            {matchday
              ? ` · MD ${matchday.toUpperCase()}${readiness.opponent ? ` · V ${readiness.opponent.toUpperCase()}` : ''}`
              : ''}{' · '}
            {/* The scope by name, not "1 GROUP" — audit S4 / coach finding 16. */}
            {groupScopeLabel(groups, groupIds).toUpperCase()}
          </p>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          <PrintButton />
        </div>
      </div>

      <div style={{ margin: '10px 0 14px' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {isAnchoredToPast ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 'var(--sp-14)',
            padding: '10px 16px',
            borderInlineStart: '3px solid var(--accent)',
            display: 'flex',
            gap: 'var(--sp-8)',
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <b style={{ fontSize: 'var(--fs-13)' }}>Showing {formatDate(effectiveToday, timezone)} — the latest day with data.</b>
          <span className="tiny" style={{ color: 'var(--muted)' }}>
            Nothing has been recorded for today ({formatDate(wallClockToday, timezone)}) yet. Schedule, Flags and Reports run
            on the real date.
          </span>
        </div>
      ) : null}

      {/* Flags has no sidebar row of its own any more — this is the
       * replacement: closed by default, the toggle row is the "small
       * summaries" state, and each expanded row jumps straight to the
       * flag's real, actionable home on the athlete's own profile. */}
      <div style={{ marginBottom: 'var(--sp-14)' }}>
        <DashboardFlagsPanel
          rows={stats.attentionRows}
          openTotal={stats.openFlags}
          awaitingAck={stats.awaitingAckFlags}
          bySeverity={stats.flagsBySeverity}
        />
      </div>

      {/* Used to be five static info cards — nothing here read as clickable
       * beyond a bare CSS cursor, and Available/To matchday didn't even point
       * anywhere useful (audit coach finding 13 only fixed Need you). Every
       * tile now either navigates to its real destination or expands in
       * place; DashboardHeadlineStats' own header states the reasoning for
       * each one individually. */}
      <DashboardHeadlineStats
        stats={stats}
        isAnchoredToPast={isAnchoredToPast}
        timezone={timezone}
        needYouHref={`/flags${qs({ groups: groupsQs, date: effectiveToday })}`}
        wellnessReportHref="/reports/compliance"
        squadHref="/squad"
        flagsHref="/flags"
        toMatchdayHref={stats.fixtureId ? `/schedule/fixtures/${stats.fixtureId}` : '/schedule'}
        squadModified={readiness.modifiedNames}
        squadUnavailable={readiness.unavailableNames}
      />

      {/* The week strip, per the Visual Lift screenshots: one card, a header
       * with the session count and a domain legend, then a column per day.
       * Each day lists its own activities with a domain dot each, rather than
       * one joined summary line, so a coach reads the week as a shape.
       * Still six real links that set ?day= on this same page — only the
       * arrangement changed. */}
      <div className="dash-week">
        <div className="dash-week-head">
          <span className="dash-week-head-title">This week</span>
          <span className="dash-week-head-meta">
            {weekSessionCount} session{weekSessionCount === 1 ? '' : 's'} · {weekRangeLabel}
          </span>
          <span className="dash-week-legend">
            {WEEK_LEGEND.map((l) => (
              <span key={l.label} className="dash-week-legend-item">
                <span className="dash-stat-dot" style={{ background: PIP_COLOR[l.type] }} aria-hidden="true" />
                {l.label}
              </span>
            ))}
          </span>
        </div>
        <div className="dash-week-grid">
          {week.map((d) => (
            <Link
              key={d.date}
              href={`/dashboard${qs({ groups: groupsQs, day: d.date, period: 'day' })}`}
              className="dash-week-col"
              data-past={d.isPast}
              data-selected={d.date === selectedDay}
              data-alert={d.alert?.sev ?? undefined}
            >
              <div className="dash-week-col-head">
                {/* --accent-on-tint, not --accent: when today is ALSO the selected
                    column the ground is rgb(--accent-rgb / 0.1), and plain
                    --accent on that measured 4.07:1 — under AA. The derived
                    pair is darker and clears it on the plain surface too. */}
                <span
                  className="dash-week-col-day"
                  style={{ color: d.isToday ? 'var(--accent-on-tint)' : undefined }}
                >
                  {d.dayLabel}
                </span>
                {d.md ? (
                  <span
                    className="num dash-week-col-md"
                    style={{ color: d.md === 'MD' ? 'var(--bad-text)' : undefined }}
                  >
                    {d.md}
                  </span>
                ) : null}
                {d.durationMin !== null ? <span className="num dash-week-col-dur">{d.durationMin} min</span> : null}
              </div>
              {d.activities.length > 0 ? (
                <div className="dash-week-col-acts">
                  {d.activities.map((a, i) => (
                    <span key={`${a.title}-${i}`} className="dash-week-act">
                      <span className="dash-week-act-dot" style={{ background: PIP_COLOR[a.type] }} aria-hidden="true" />
                      <span>{a.title}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="dash-week-col-empty">Nothing scheduled</div>
              )}
              {d.alert ? (
                <div
                  className="dash-week-col-flag"
                  style={d.alert.sev === 'accent' ? { color: 'var(--accent-text)' } : undefined}
                >
                  {d.alert.text}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      <div className="dash-body" style={{ marginTop: 'var(--sp-14)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 'var(--sp-12)' }}>
            <h2 style={{ fontSize: 'var(--fs-16)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              {dayTitle(selectedDay, wallClockToday)}
            </h2>
            <span className="tiny num" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
              {selectedDayMd && selectedDayMd !== 'MD' ? `${selectedDayMd} · ` : ''}
              {dayCaption}
            </span>
          </div>

          {timeline.length === 0 ? (
            <div className="card">
              <p className="tiny">Nothing is scheduled for this day, for this filter.</p>
            </div>
          ) : (
            <div className="dash-timeline">
              {timeline.map((entry) => (
                <div key={entry.id} className="dash-timeline-entry">
                  <div className="dash-timeline-time">
                    <div className="dash-timeline-clock" data-past={entry.past}>
                      {entry.time}
                    </div>
                    <div className="dash-timeline-rel">{entry.past ? 'passed' : 'planned'}</div>
                  </div>
                  <Link
                    href={`/schedule/${entry.id}`}
                    className="card dash-session-card"
                    style={{ padding: '16px 18px', display: 'block', textDecoration: 'none', color: 'inherit' }}
                    data-past={entry.past}
                    data-severe={entry.countState === 'bad'}
                  >
                    <div className="dash-session-head">
                      <div>
                        <span className="dash-session-name">{entry.name}</span>{' '}
                        <span className="pill pill-neutral">{entry.groupLabel}</span>
                        <div className="dash-session-meta">{entry.where}</div>
                      </div>
                      <div>
                        <div className="dash-session-count" style={{ color: entry.countState === 'bad' ? 'var(--bad-pill-text)' : entry.countState === 'warn' ? 'var(--warn-pill-text)' : undefined }}>
                          {entry.count}
                        </div>
                        <div className="dash-session-count-label">{entry.countLabel}</div>
                      </div>
                      <span className="dash-session-chevron">›</span>
                    </div>

                    {entry.affected.length === 0 ? (
                      <div className="dash-clean">
                        <span className="dash-clean-check" aria-hidden="true">✓</span>
                        <span className="tiny" style={{ color: 'var(--muted)' }}>
                          {entry.past ? 'Nothing was raised against this session.' : 'Nobody flagged and nothing outstanding for this one.'}
                        </span>
                      </div>
                    ) : (
                      <div className="dash-affected">
                        {entry.affected.map((a, i) => (
                          <div key={`${a.athleteId}-${i}`} className="dash-affected-row">
                            <span className="dash-avatar">{a.initials}</span>
                            <div>
                              <span className="dash-affected-name">{a.name}</span>{' '}
                              <span className={`pill ${a.sev === 'bad' ? 'pill-bad' : 'pill-warn'}`}>{a.kind}</span>
                              <div className="dash-affected-why">{a.why}</div>
                            </div>
                            <span className="dash-affected-value" style={{ color: a.sev === 'bad' ? 'var(--bad-pill-text)' : 'var(--warn-pill-text)' }}>
                              {a.value}
                            </span>
                            <span style={{ color: 'var(--faint)', fontSize: 'var(--fs-13)' }}>›</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card dash-ready-card">
            <div className="dash-ready-head">
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  {matchday ? `Ready for ${matchday}` : 'Squad readiness'}
                </h2>
                <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
                  {readiness.opponent ? `v ${readiness.opponent} · ${readiness.homeAway ?? ''} · ${daysOutLabel(readiness.daysOut)}` : `No fixture in the next ${FIXTURE_RANGE_DAYS} days`}
                </p>
                {/* Squad size and the active group scope, carried over from the
                    Squad state card's subtitle. It sits better next to the ring
                    than it did under its own heading — it is the ring's
                    denominator, said in words. */}
                <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
                  {readiness.squad} athletes · {groupScopeLabel(groups, groupIds)}
                </p>
              </div>
              {/* 76px, and the centre says what the fraction counts. "25/28"
                  on its own is a ratio of nothing in particular; the ring is
                  about SELECTION, and the second line is the only place that
                  word appears. */}
              <Dial size={76} pct={readiness.squad > 0 ? Math.round((100 * readiness.selectable) / readiness.squad) : null} tone="var(--accent)">
                <span className="dash-ready-dial">
                  <span className="v num">
                    {readiness.selectable}/{readiness.squad}
                  </span>
                  <span className="k">Named</span>
                </span>
              </Dial>
            </div>

            {/* The stacked bar from the Squad state card. The ring does not
                replace it: the ring is one number — how many you can name — and
                the bar is the shape of the three-way split at a glance. The
                dots on the three rows below are what ties each segment to the
                names inside it. */}
            <div className="dash-squad-bar">
              <div style={{ flex: readiness.available, background: 'var(--accent2)' }} />
              <div style={{ flex: readiness.modified, background: 'var(--warn)' }} />
              <div style={{ flex: readiness.unavailable, background: 'var(--bad)' }} />
            </div>

            <div style={{ marginTop: 'var(--sp-4)' }}>
              {readiness.rows.map((r) => (
                <Link
                  key={r.key}
                  href={ROW_HREF[r.key]}
                  className={ROW_DOT[r.key] ? 'dash-ready-row dash-ready-row-dot' : 'dash-ready-row'}
                  /* STAFF-SS-01 A1 (2026-09-12): Doubtful and Ruled out are
                     tone-family cards — the treatment ATH-ADULT-02 approved for
                     the athlete's own availability line — not dot rows. Fit and
                     available stays a plain row: it is the rule, not the
                     exception. */
                  data-tone={r.key === 'modified' ? 'warn' : r.key === 'unavailable' ? 'bad' : undefined}
                >
                  {ROW_DOT[r.key] ? (
                    <span className="dash-squad-dot" style={{ background: ROW_DOT[r.key] }} aria-hidden="true" />
                  ) : null}
                  <div>
                    <div style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{r.label}</div>
                    <div className="tiny">
                      {r.detail}
                    </div>
                  </div>
                  <span className="num" style={{ fontSize: 'var(--fs-13)', color: TONE_TEXT[r.tone === 'bad' ? 'bad' : r.tone === 'warn' ? 'warn' : ''] }}>
                    {r.value}
                  </span>
                  <span>›</span>
                </Link>
              ))}
            </div>

            {readiness.weekLoad ? (
              <>
                <hr className="hr" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--fs-12)', fontWeight: 700 }}>Week load so far</span>
                  <span className="num" style={{ fontSize: 'var(--fs-12)' }}>
                    {readiness.weekLoad.pct !== null ? `${readiness.weekLoad.pct}%` : '—'}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 8, marginTop: 'var(--sp-6)' }}>
                  <div className="dash-load-track" />
                  <div className="dash-load-fill" style={{ width: `${readiness.weekLoad.fillPct}%`, background: TONE_VAR[readiness.weekLoad.tone] ?? 'var(--accent)' }} />
                  <div className="dash-load-tick" style={{ left: `${readiness.weekLoad.tickPct}%` }} />
                </div>
                <p className="tiny num" style={{ marginTop: 'var(--sp-6)' }}>
                  {readiness.weekLoad.foot}
                </p>
              </>
            ) : null}
          </div>
          {/* "Not tied to a session" is gone, per the design review. It listed
              wellness, compliance, nutrition and testing flags — the domains
              that never attach to a timetable row — but fetchDashboardAttention
              filters only on org and open status, so every one of them was
              already in the open-flags panel at the top of this page. The card
              was a second view of the same rows under a different heading.

              "Squad state" is gone too, for the same reason one level down: it
              re-rendered numbers Ready for Saturday was already showing. Its
              total WAS that card's ring denominator, its Available/Modified/
              Unavailable WERE that card's Fit-and-available/Doubtful/Ruled-out,
              and both cards derived them from the same two reads. The bar, the
              reason categories and the Squad link moved up into the readiness
              card rather than being dropped; nothing that card showed was
              lost. */}
          {outstanding.length > 0 ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Outstanding entries
                </h2>
                <Link href="/reports/compliance" className="tiny" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                  Compliance ›
                </Link>
              </div>
              <div className="dash-track">
                {outstanding.map((t) => (
                  <div key={t.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{t.label}</span>
                      <span className="num" style={{ fontSize: 'var(--fs-13)' }}>
                        {t.valueLeft} left
                      </span>
                    </div>
                    <div className="dash-track-bar-outer">
                      <div className="dash-track-bar-fill" style={{ width: `${t.pct}%`, background: TONE_VAR[t.tone] ?? 'var(--accent)' }} />
                    </div>
                    <p className="tiny" style={{ color: 'var(--faint)', marginTop: 'var(--sp-4)' }}>
                      {t.foot}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* The closing paragraph is gone per Design.pdf p2. It explained how to
          read the page rather than telling a coach anything about their squad,
          and every card above already links to the screen that owns it. */}
    </>
  );
}
