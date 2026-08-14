import Link from 'next/link';
import { DashboardFlagsPanel } from '@/components/DashboardFlagsPanel/DashboardFlagsPanel';
import { Dial } from '@/components/Dial/Dial';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchEffectiveToday,
  fetchHeadlineStats,
  fetchOutstandingTracks,
  fetchSaturdayReadiness,
  fetchSquadState,
  fetchTimeline,
  fetchUntiedFlags,
  fetchWeekStrip,
  type SessionPip,
  type SquadStateEntry,
} from '@/lib/queries/dashboard';
import { fetchGroups } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, enumLabel, formatDate, formatLongDate, todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Dashboard · Fydr' };

/** "James Barnes (Academic), Priya Shah" — the reason only where one was
 *  actually recorded. An injury-linked row shows "(Injury)" here, generic on
 *  purpose: body area and expected return already have their own home on
 *  the injuries report, and this tile is squad state at a glance, not the
 *  injury detail. ADR-008 / gameplan 2.6: this reason field went
 *  unrendered entirely before this change, for medical-authored rows too. */
function namedWithReason(entries: SquadStateEntry[]): string {
  return entries.map((e) => (e.reason ? `${e.name} (${enumLabel(e.reason)})` : e.name)).join(', ');
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PIP_COLOR: Record<SessionPip, string> = {
  training: 'var(--accent)',
  gym: 'var(--gym)',
  rehab: 'var(--warn)',
  testing: 'var(--accent2)',
  match: 'var(--bad)',
  recovery: 'rgba(16,18,23,0.2)',
  meeting: 'rgba(16,18,23,0.2)',
};

const TONE_VAR: Record<string, string> = { good: 'var(--accent2)', accent: 'var(--accent)', accent2: 'var(--accent2)', warn: 'var(--warn)', bad: 'var(--bad)' };

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
  const { db, orgId, orgName, claims, timezone } = await requireStaff();

  // 01-roles-and-permissions.md §2: admin gets `no` for "View squad
  // dashboard" — every panel below is named-athlete availability, load and
  // flag detail. docs/20-route-map.md §11 G-1 resolves the one place the
  // docs disagree (02-information-architecture.md §4.2 sketches an admin
  // panel order for this same page) in the matrix's favour: "an admin-only
  // user does not open /dashboard". Sidebar.tsx's staff.dashboard row is
  // already coach/medical only, so this is the server-side lock behind
  // that hidden row — homeRoute() in lib/supabase/claims.ts no longer
  // lands an admin-only sign-in here, but a typed URL still could without
  // this. Same pattern as /flags, /squad and /analytics.
  const hasAccess = claims.roles.includes('coach') || claims.roles.includes('medical');
  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">Squad · {orgName}</p>
            <h1>Dashboard</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            The dashboard is availability, load and flag detail for every named athlete.
            Admin manages the club and does not read athlete performance data &mdash; see
            01-roles-and-permissions.md §1. Reports, Leaderboard and Settings are still open
            from the sidebar.
          </p>
        </div>
      </>
    );
  }

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

  const [groups, stats, week, timeline, readiness, squad, untied, outstanding] = await Promise.all([
    fetchGroups(db, orgId),
    fetchHeadlineStats(db, orgId, groupIds, effectiveToday, wallClockToday, timezone),
    fetchWeekStrip(db, orgId, groupIds, weekStart, effectiveToday, timezone),
    // "now" is the real instant — a session is "passed" against the real
    // clock, never against an end-of-day stand-in (audit S2).
    fetchTimeline(db, orgId, groupIds, selectedDay, new Date().toISOString(), timezone),
    fetchSaturdayReadiness(db, orgId, groupIds, effectiveToday, timezone),
    fetchSquadState(db, orgId, groupIds),
    fetchUntiedFlags(db, orgId, groupIds),
    fetchOutstandingTracks(db, orgId, groupIds, effectiveToday),
  ]);

  const isAnchoredToPast = effectiveToday !== wallClockToday;

  const groupsQs = groupIds.length > 0 ? groupIds.join(',') : undefined;
  const isSelectedToday = selectedDay === effectiveToday;
  const selectedDayMd = week.find((d) => d.date === selectedDay)?.md ?? null;

  const dayCaption = isSelectedToday
    ? `${formatDate(effectiveToday, timezone)} · ${timeline.length} session${timeline.length === 1 ? '' : 's'}${timeline.length > 0 ? ` · first at ${timeline[0]!.time}` : ''}`
    : selectedDay < effectiveToday
      ? `complete${timeline.length > 0 ? ` · ${timeline.length} session${timeline.length === 1 ? '' : 's'}` : ''}`
      : `${timeline.length} session${timeline.length === 1 ? '' : 's'} planned`;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            WEEK OF {formatLongDate(weekStart, timezone).toUpperCase()} · {readiness.opponent ? `MD SATURDAY · V ${readiness.opponent.toUpperCase()}` : 'MD SATURDAY'} ·{' '}
            {/* The scope by name, not "1 GROUP" — audit S4 / coach finding 16. */}
            {groupScopeLabel(groups, groupIds).toUpperCase()}
          </p>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PrintButton />
          <ThemeToggle />
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
            marginBottom: 14,
            padding: '10px 16px',
            borderInlineStart: '3px solid var(--accent)',
            display: 'flex',
            gap: 8,
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <b style={{ fontSize: 13.5 }}>Showing {formatDate(effectiveToday, timezone)} — the latest day with data.</b>
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
      <div style={{ marginBottom: 14 }}>
        <DashboardFlagsPanel
          rows={stats.attentionRows}
          openTotal={stats.openFlags}
          awaitingAck={stats.awaitingAckFlags}
          bySeverity={stats.flagsBySeverity}
        />
      </div>

      <div className="card dash-stats">
        {/* Used to link to /dashboard — this page — so a coach who clicked
         * it landed nowhere new (audit coach finding 13). needYouCount is
         * flags raised on effectiveToday specifically (see fetchHeadlineStats'
         * own comment); /flags now takes that same ?date= so this tile can
         * point at the exact athletes it's counting, not just their number. */}
        <Link
          href={`/flags${qs({ groups: groupsQs, date: effectiveToday })}`}
          className="dash-stat"
        >
          <div className="dash-stat-label">Need you</div>
          <div className="dash-stat-value" style={{ color: stats.needYouCount > 0 ? 'var(--bad)' : undefined }}>
            {stats.needYouCount}
          </div>
          <div className="dash-stat-sub">athletes today</div>
          <div className="dash-stat-foot">across wellness and GPS</div>
        </Link>
        <Link href="/reports/compliance" className="dash-stat">
          <div className="dash-stat-label">Wellness in</div>
          <div className="dash-stat-value">
            {stats.wellnessPct !== null ? (
              <>
                {stats.wellnessPct}
                <span className="unit">%</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="dash-stat-sub">{stats.wellnessSub}</div>
          <div className="dash-stat-foot">
            {stats.wellnessPct === null
              ? 'not expected today'
              : isAnchoredToPast
                ? 'window closed 09:00 that day'
                : 'window closes 09:00'}
          </div>
        </Link>
        <Link href="/squad" className="dash-stat">
          <div className="dash-stat-label">Available</div>
          <div className="dash-stat-value">
            {stats.availableCount} <span className="unit">/ {stats.availableTotal}</span>
          </div>
          <div className="dash-stat-sub">
            {stats.modifiedCount} modified, {stats.unavailableCount} out
          </div>
          <div className="dash-stat-foot">injury status set by medical, other absences by coach</div>
        </Link>
        <Link href="/flags" className="dash-stat">
          <div className="dash-stat-label">Open flags</div>
          <div className="dash-stat-value" style={{ color: stats.openFlags > 0 ? 'var(--warn-text)' : undefined }}>
            {stats.openFlags}
          </div>
          <div className="dash-stat-sub">
            {stats.awaitingAckFlags === 0 ? 'all acknowledged' : `${stats.awaitingAckFlags} awaiting acknowledgement`}
          </div>
          <div className="dash-stat-foot">wellness, gym, GPS</div>
        </Link>
        <Link href={`/dashboard${qs({ groups: groupsQs, day: week[5]?.date })}`} className="dash-stat">
          <div className="dash-stat-label">To matchday</div>
          <div className="dash-stat-value">
            {stats.toMatchdayDays ?? '—'} <span className="unit">{stats.toMatchdayDays === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="dash-stat-sub">{stats.opponent ? `v ${stats.opponent}` : 'no fixture'}</div>
          <div className="dash-stat-foot">{stats.sessionsLeft} session{stats.sessionsLeft === 1 ? '' : 's'} left to run</div>
        </Link>
      </div>

      <div className="dash-week-strip">
        {week.map((d) => (
          <Link
            key={d.date}
            href={`/dashboard${qs({ groups: groupsQs, day: d.date })}`}
            className="dash-day"
            data-today={d.isToday}
            data-past={d.isPast}
            data-selected={d.date === selectedDay}
          >
            <div className="dash-day-head">
              <span className="dash-day-name" style={{ color: d.isToday ? 'var(--accent)' : undefined }}>
                {d.dayLabel}
              </span>
              <span className="dash-day-md" style={{ color: d.md === 'MD' ? 'var(--bad)' : d.md === 'MD-1' ? 'var(--accent)' : undefined }}>
                {d.md ?? ''}
              </span>
            </div>
            <div className="dash-day-summary">{d.summary}</div>
            <div className="dash-day-pips">
              {d.pips.length > 0
                ? d.pips.map((p, i) => <span key={i} className="dash-day-pip" style={{ background: PIP_COLOR[p] }} />)
                : <span className="dash-day-pip" style={{ background: 'var(--hair)' }} />}
            </div>
            {d.alert ? (
              <div className="dash-day-alert" style={{ color: d.alert.sev === 'bad' ? 'var(--bad)' : 'var(--accent)' }}>
                {d.alert.text}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="dash-body" style={{ marginTop: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{dayTitle(selectedDay, wallClockToday)}</h2>
            <span className="tiny mono" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
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
                        <div className="dash-session-count" style={{ color: entry.countState === 'bad' ? 'var(--bad)' : entry.countState === 'warn' ? 'var(--warn-text)' : undefined }}>
                          {entry.count}
                        </div>
                        <div className="dash-session-count-label">{entry.countLabel}</div>
                      </div>
                      <span className="dash-session-chevron">›</span>
                    </div>

                    {entry.affected.length === 0 ? (
                      <div className="dash-clean">
                        <span className="dash-clean-check">✓</span>
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
                            <span className="dash-affected-value" style={{ color: a.sev === 'bad' ? 'var(--bad)' : 'var(--warn-text)' }}>
                              {a.value}
                            </span>
                            <span style={{ color: 'var(--faint)', fontSize: 13 }}>›</span>
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
                  Ready for Saturday
                </h2>
                <p className="tiny" style={{ marginTop: 2 }}>
                  {readiness.opponent ? `v ${readiness.opponent} · ${readiness.homeAway ?? ''} · ${readiness.daysOut ?? '—'} days out` : 'No fixture scheduled'}
                </p>
              </div>
              <Dial size={62} pct={readiness.squad > 0 ? Math.round((100 * readiness.selectable) / readiness.squad) : null} tone="var(--accent)">
                <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
                  {readiness.selectable}/{readiness.squad}
                </span>
              </Dial>
            </div>
            <p style={{ fontSize: 13.5, marginTop: 12 }}>{readiness.read}</p>

            <div style={{ marginTop: 4 }}>
              {readiness.rows.map((r) => (
                <div key={r.label} className="dash-ready-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                    <div className="tiny" style={{ color: 'var(--faint)' }}>
                      {r.detail}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 13, color: TONE_VAR[r.tone === 'bad' ? 'bad' : r.tone === 'warn' ? 'warn' : ''] }}>
                    {r.value}
                  </span>
                  <span style={{ color: 'var(--faint)' }}>›</span>
                </div>
              ))}
            </div>

            {readiness.weekLoad ? (
              <>
                <hr className="hr" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Week load so far</span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {readiness.weekLoad.pct !== null ? `${readiness.weekLoad.pct}%` : '—'}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 8, marginTop: 6 }}>
                  <div className="dash-load-track" />
                  <div className="dash-load-fill" style={{ width: `${readiness.weekLoad.fillPct}%`, background: TONE_VAR[readiness.weekLoad.tone] ?? 'var(--accent)' }} />
                  <div className="dash-load-tick" style={{ left: `${readiness.weekLoad.tickPct}%` }} />
                </div>
                <p className="tiny mono" style={{ color: 'var(--faint)', marginTop: 6 }}>
                  {readiness.weekLoad.foot}
                </p>
              </>
            ) : null}
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                Squad state
              </h2>
              <Link href="/squad" className="tiny" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Squad ›
              </Link>
            </div>
            <p className="tiny" style={{ color: 'var(--muted)' }}>
              {squad.total} athletes · {groupScopeLabel(groups, groupIds)}
            </p>
            <div className="dash-squad-bar">
              <div style={{ flex: squad.available, background: 'var(--accent2)' }} />
              <div style={{ flex: squad.modified, background: 'var(--warn)' }} />
              <div style={{ flex: squad.unavailable, background: 'var(--bad)' }} />
            </div>
            <div className="stack" style={{ gap: 9, marginTop: 14 }}>
              <div className="dash-squad-row">
                <span className="dash-squad-dot" style={{ background: 'var(--accent2)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Available</div>
                  <div className="tiny" style={{ color: 'var(--faint)' }}>
                    full training
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 14 }}>
                  {squad.available}
                </span>
              </div>
              <div className="dash-squad-row">
                <span className="dash-squad-dot" style={{ background: 'var(--warn)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Modified</div>
                  <div className="tiny" style={{ color: 'var(--faint)' }}>
                    {namedWithReason(squad.modifiedNames) || 'nobody'}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 14 }}>
                  {squad.modified}
                </span>
              </div>
              <div className="dash-squad-row">
                <span className="dash-squad-dot" style={{ background: 'var(--bad)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Unavailable</div>
                  <div className="tiny" style={{ color: 'var(--faint)' }}>
                    {namedWithReason(squad.unavailableNames) || 'nobody'}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 14 }}>
                  {squad.unavailable}
                </span>
              </div>
            </div>
          </div>

          {untied.length > 0 ? (
            <div className="card" style={{ border: '1px solid rgba(246,171,47,0.5)' }}>
              <div className="dash-ready-head">
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Not tied to a session
                  </h2>
                  <p className="tiny" style={{ marginTop: 2 }}>
                    Flags that belong to nothing on the timetable.
                  </p>
                </div>
                <span className="pill pill-warn">{untied.length} open</span>
              </div>
              {untied.map((f, i) => (
                <Link key={`${f.athleteId}-${i}`} href={`/squad/${f.athleteId}`} className="dash-untied-row" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</span>
                    <span className="pill pill-neutral">{f.domain}</span>
                    <span className="mono" style={{ fontSize: 12.5, marginLeft: 'auto', color: f.sev === 'bad' ? 'var(--bad)' : 'var(--warn-text)' }}>
                      {f.value}
                    </span>
                  </div>
                  <div className="tiny" style={{ color: 'var(--muted)', marginTop: 3 }}>
                    {f.rule}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {outstanding.length > 0 ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Outstanding entries
                </h2>
                <Link href="/reports/compliance" className="tiny" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Compliance ›
                </Link>
              </div>
              <div className="dash-track">
                {outstanding.map((t) => (
                  <div key={t.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</span>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        {t.valueLeft} left
                      </span>
                    </div>
                    <div className="dash-track-bar-outer">
                      <div className="dash-track-bar-fill" style={{ width: `${t.pct}%`, background: TONE_VAR[t.tone] ?? 'var(--accent)' }} />
                    </div>
                    <p className="tiny" style={{ color: 'var(--faint)', marginTop: 4 }}>
                      {t.foot}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="cap" style={{ marginTop: 14 }}>
        Squad · {orgName} · signed in as {claims.roles.join(', ')}. The dashboard navigates, it does not
        act — every row and card above leads to the screen that owns the thing.
      </p>
    </>
  );
}
