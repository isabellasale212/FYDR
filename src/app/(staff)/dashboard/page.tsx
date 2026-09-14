import Link from 'next/link';
import { DashboardFlagsPanel } from '@/components/DashboardFlagsPanel/DashboardFlagsPanel';
import { DashboardHeadlineStats } from '@/components/DashboardHeadlineStats/DashboardHeadlineStats';
import { DashboardLeadCard } from '@/components/DashboardLeadCard/DashboardLeadCard';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { FIXTURE_RANGE_DAYS, fetchEffectiveToday, fetchGymToday, fetchHeadlineStats, fetchNearestSessionDay, fetchOutstandingTracks, fetchSaturdayReadiness, fetchSelectionReasons, fetchTimeline, fetchWeekStrip, fetchWeighInsToday, type SessionPip } from '@/lib/queries/dashboard';
import { dayEmptyCopy, flagsAllClearLine, sessionAllClearLine } from '@/lib/dashboardEmpty';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { attentionDomains, dashboardTiles, dashboardVersion, leadCardNames, needYouFoot, showsWeekStrip } from '@/lib/dashboardVersion';
import { weekStripYields } from '@/lib/dashboardLead';
import { fetchGroupAthleteIds, fetchGroups, fetchSquadSize } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, formatLongDate, matchdayWeekday, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';
import { fetchThresholdProvenance } from '@/lib/queries/thresholds';
import { CLINICAL_ONLY, SETTINGS_ADMIN, THRESHOLD_EDIT, hasAnyRole } from '@/lib/access';
import { fetchSetupCounts } from '@/lib/queries/setupChecklist';
import { setupDashboardLine, setupSteps, setupSummary } from '@/lib/setupChecklist';

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

/* The readiness card's own helpers — the tone-text map, "N days out", the
 * row dots and hrefs — left with it on 2026-09-13 (STAFF-SS-01 C2): the
 * matchday lead card (components/DashboardLeadCard) says the same facts in
 * the board's words, lib/dashboardLead.ts. */

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
  const { db, orgId, orgName, timezone, claims, collectsRpe } = await requireStaff();

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

  /* STAFF-SS-01 C2, the role versions (2026-09-13): resolved from the
     server-side claims, never the client. The sport scientist, the coach and
     the medic read everything below; the S&C reads four summary cards and no
     week strip; the nutritionist two cards and the lead card's counts without
     names (the censored availability view of migration 0074, at the board's
     level of detail). lib/dashboardVersion.ts is the rule. */
  const version = dashboardVersion(claims.roles);

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

  const [groups, stats, week, timeline, readiness, outstanding, provenance, gymToday, weighIns, scopeIds, squadSize, setupCounts] = await Promise.all([
    fetchGroups(db, orgId),
    fetchHeadlineStats(db, orgId, groupIds, effectiveToday, wallClockToday, timezone, attentionDomains(version)),
    fetchWeekStrip(db, orgId, groupIds, weekStart, effectiveToday, timezone),
    // "now" is the real instant — a session is "passed" against the real
    // clock, never against an end-of-day stand-in (audit S2).
    fetchTimeline(db, orgId, groupIds, selectedDay, new Date().toISOString(), timezone),
    fetchSaturdayReadiness(db, orgId, groupIds, effectiveToday, timezone),
    fetchOutstandingTracks(db, orgId, groupIds, effectiveToday, { collectsRpe }),
    /* STAFF-SS-01 C2: who set the thresholds and when, for the line that
       closes the attention panel — one stored date, read once. */
    fetchThresholdProvenance(db, orgId),
    /* The two tiles only the role versions draw — read only for them. */
    version === 'sc' ? fetchGymToday(db, orgId, groupIds, effectiveToday, timezone) : Promise.resolve(null),
    version !== 'full' ? fetchWeighInsToday(db, orgId, groupIds, effectiveToday) : Promise.resolve(null),
    /* PATTERN-S6 C8: the scope's size, for the all-clear lines' "any of the N
       athletes in …" — the filter's athletes when one is set, else the squad.
       Two count reads, in the same batch. */
    fetchGroupAthleteIds(db, orgId, groupIds),
    fetchSquadSize(db, orgId),
    /* PATTERN-S8 C1: the setup checklist's one line, for the sport
       scientist, while any step is outstanding. */
    hasAnyRole(claims.roles, SETTINGS_ADMIN) ? fetchSetupCounts(db, orgId) : Promise.resolve(null),
  ]);
  const setupLine = setupCounts ? setupDashboardLine(setupSummary(setupSteps(setupCounts, orgName)), orgName) : null;
  const scopeWords = groupIds.length === 0 ? 'the squad' : groupScopeLabel(groups, groupIds);
  const scopeSize = scopeIds ? scopeIds.length : squadSize;

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

  /* PATTERN-S6 C8: the nearest day with a session, for the timeline's empty —
     read on the empty path only, after the batch above, since it is needed
     for nothing else. */
  const nearestDay = timeline.length === 0 ? await fetchNearestSessionDay(db, orgId, selectedDay, timezone) : null;
  const dayEmpty = dayEmptyCopy({
    dayLabel: formatDate(selectedDay, timezone),
    nearest: nearestDay ? { ...nearestDay, label: formatDate(nearestDay.date, timezone) } : null,
    weekStart,
    weekEnd,
    groupsQs,
  });

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

  /* The lead card's reason lines — the medic's only. Data rule 6 literally:
     every other role reads the status and the restriction and nothing about
     why; and a non-medic must never even call the clinical read (an empty
     result from RLS rendered as a blank line looks like a broken page). */
  const canSeeReasons = hasAnyRole(claims.roles, CLINICAL_ONLY);
  const reasons =
    matchday && canSeeReasons ? await fetchSelectionReasons(db, orgId, [...readiness.modifiedNames, ...readiness.unavailableNames]) : null;

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

      <div style={{ margin: 'var(--s-5) 0 var(--s-7)' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {isAnchoredToPast ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 'var(--sp-14)',
            padding: 'var(--s-5) var(--s-8)',
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

      {/* PATTERN-S8 C1: one line while the club is still on a default — a
          status, not the emphasised card (that is the lead card below), and
          not a gate: it names the step that costs most and links the list. */}
      {setupLine ? (
        <div className="card setup-line" role="status">
          <span className="tiny">{setupLine}</span>
          <Link href="/settings/setup" className="btn-ghost">
            Continue setup
          </Link>
        </div>
      ) : null}

      {/* STAFF-SS-01 C2 — the matchday lead card, the one emphasised card
       * on the page, first: the board's ten-second read is the matchday
       * question, the week, the summary cards, then the attention panel.
       * Absent, not empty, with no fixture inside FIXTURE_RANGE_DAYS (the
       * week card takes the emphasis below). The nutritionist reads its three
       * counts and no names — the board's frame 7. */}
      {matchday ? (
        <DashboardLeadCard
          readiness={readiness}
          names={leadCardNames(version)}
          matchday={matchday}
          timezone={timezone}
          scopeLabel={groupScopeLabel(groups, groupIds)}
          reasons={reasons}
          squadHref="/squad"
          flagsHref="/flags"
          scheduleHref="/schedule"
        />
      ) : null}

      {/* The week strip, per the Visual Lift screenshots: one card, a header
       * with the session count and a domain legend, then a column per day.
       * Each day lists its own activities with a domain dot each, rather than
       * one joined summary line, so a coach reads the week as a shape.
       * Still six real links that set ?day= on this same page — only the
       * arrangement changed.
       *
       * It gives way for the S&C and the nutritionist (STAFF-SS-01 C2 role
       * versions), and on a heavy morning — five or more athletes needing
       * attention — for everyone (lib/dashboardLead.ts weekStripYields):
       * "the week is one sidebar row away, the five names are not". Never
       * while it is the lead. */}
      {showsWeekStrip(version) && !weekStripYields({ attentionAthletes: stats.attentionAthletes, hasMatchday: matchday !== null }) ? (
      <div className="dash-week" data-lead={!matchday}>
        {/* With no fixture inside 14 days the week is the lead: it takes the
            matchday card's treatment and says why, and the real next fixture
            and its distance are stated so the absence is legible. The two
            never appear together. */}
        {!matchday ? (
          <p className="eyebrow dash-week-lead-eyebrow">
            No match in the next {FIXTURE_RANGE_DAYS} days
            {stats.opponent && stats.nextKickoffAt
              ? ` · Next fixture ${formatDate(stats.nextKickoffAt, timezone)} v ${stats.opponent} · ${stats.toMatchdayDays} days`
              : ' · No fixture booked'}
          </p>
        ) : null}
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
      ) : null}

      {/* The summary cards, after the week (the board's order: the matchday
       * question, the week, the cards, then the attention panel).
       * Used to be five static info cards — nothing here read as clickable
       * beyond a bare CSS cursor, and Available/To matchday didn't even point
       * anywhere useful (audit coach finding 13 only fixed Need you). Every
       * tile now either navigates to its real destination or expands in
       * place; DashboardHeadlineStats' own header states the reasoning for
       * each one individually. */}
      <DashboardHeadlineStats
        stats={stats}
        tiles={dashboardTiles(version)}
        needYouFoot={needYouFoot(version)}
        gymToday={gymToday}
        weighIns={weighIns}
        gymTodayHref="/schedule"
        weighInsHref="/nutrition"
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

      {/* Flags has no sidebar row of its own any more — this is the
       * replacement: closed by default, the toggle row is the "small
       * summaries" state, and each expanded row jumps straight to the
       * flag's real, actionable home on the athlete's own profile. */}
      <div style={{ marginTop: 'var(--sp-14)' }}>
        <DashboardFlagsPanel
          rows={stats.attentionRows}
          openTotal={stats.openFlags}
          allClearLine={flagsAllClearLine({ inScope: scopeSize, scopeWords })}
          athleteTotal={stats.attentionAthletes}
          provenance={provenance}
          changedAtLabel={provenance ? formatDate(provenance.changedAt, timezone) : null}
          canEditThresholds={hasAnyRole(claims.roles, THRESHOLD_EDIT)}
          awaitingAck={stats.awaitingAckFlags}
          bySeverity={stats.flagsBySeverity}
        />
      </div>

      <div className="dash-body" style={{ marginTop: 'var(--sp-14)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 'var(--sp-12)' }}>
            <h2 style={{ fontSize: 'var(--fs-16)', fontWeight: 'var(--w-bold)', letterSpacing: 'var(--t-section-tracking)', margin: 0 }}>
              {dayTitle(selectedDay, wallClockToday)}
            </h2>
            <span className="tiny num" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
              {selectedDayMd && selectedDayMd !== 'MD' ? `${selectedDayMd} · ` : ''}
              {dayCaption}
            </span>
          </div>

          {timeline.length === 0 ? (
            /* PATTERN-S6 C8: the one grammar — why, the nearest day on record,
               what would fill it, one action to that day. Never "for this
               filter": the filter narrows who is expected, not which sessions
               exist (fetchTimetableDay). Bare, not inside .card — .empty draws
               its own frame, and a frame in a frame is what the first render
               showed. */
            <EmptyState headingLevel={3} title={dayEmpty.title} body={dayEmpty.body} action={dayEmpty.action} />
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
                    style={{ padding: 'var(--s-8) var(--s-9)', display: 'block', textDecoration: 'none', color: 'inherit' }}
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
                          {sessionAllClearLine({ expected: entry.expected, past: entry.past, scopeWords })}
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
                <Link href="/reports/compliance" className="tiny" style={{ color: 'var(--accent-text)', fontWeight: 'var(--w-semi)' }}>
                  Compliance ›
                </Link>
              </div>
              <div className="dash-track">
                {outstanding.map((t) =>
                  t.off ? (
                    /* The RPE club setting is off (0118): the track stays and
                       says so — never a bar at zero, never quietly absent. */
                    <div key={t.label}>
                      <span style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--w-semi)' }}>{t.label}</span>
                      <p className="tiny" style={{ color: 'var(--muted)', marginTop: 'var(--sp-4)' }}>
                        {t.off}
                      </p>
                    </div>
                  ) : (
                    <div key={t.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--w-semi)' }}>{t.label}</span>
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
                  ),
                )}
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
