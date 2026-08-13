import Link from 'next/link';
import { AvailabilityBanner } from '@/components/AvailabilityBanner/AvailabilityBanner';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { OutboxFlusher } from '@/components/OutboxFlusher/OutboxFlusher';
import { Toast } from '@/components/Toast/Toast';
import { fetchAthleteAvailability } from '@/lib/queries/availability';
import { fetchMyOutstanding } from '@/lib/queries/compliance';
import {
  fetchAthleteDaySessions,
  fetchWeekMdLabels,
  mondayOf,
} from '@/lib/queries/schedule';
import { fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { fetchMyAllocation } from '@/lib/queries/teamAllocation';
import {
  BLANK,
  addDays,
  enumLabel,
  formatDate,
  formatTime,
  initials,
  mdExplainer,
  mdLabel,
  todayIso,
} from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Today · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const WEEKDAY_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** ATHLETE-APP-SPEC.md §13's literal toast copy, built from whatever the
 *  redirecting form actually knew. The gym message drops the spec's "· RPE
 *  prompt at 18:00" clause: nothing in this build schedules that prompt at
 *  a real time (see notifications/page.tsx's own "nothing sends a push
 *  yet" note), so stating one would be inventing a time this app cannot
 *  keep. */
function toastMessageFor(params: Record<string, string | string[] | undefined>): string | null {
  const submitted = typeof params.submitted === 'string' ? params.submitted : null;
  if (submitted === '1') return 'Wellness submitted · queued, syncs on signal';
  if (submitted === 'rpe') {
    const rpe = typeof params.rpe === 'string' ? params.rpe : null;
    const session = typeof params.session === 'string' ? params.session : null;
    return rpe && session ? `RPE ${rpe} submitted for ${session}` : 'RPE submitted';
  }
  if (submitted === 'nutrition') {
    /* Same phrasing as wellness: the check-in is queued on the phone first
       (lib/outbox.ts), so "submitted" is true even before the server has it. */
    const week = typeof params.week === 'string' ? params.week : null;
    return week
      ? `Nutrition check-in submitted for week of ${formatDate(week)} · queued, syncs on signal`
      : 'Nutrition check-in submitted · queued, syncs on signal';
  }
  if (submitted === 'gym') return 'Gym session logged.';
  return null;
}

/**
 * The compliance surface, ATHLETE-APP-SPEC.md §5. Six blocks in the spec's
 * own order: week strip, availability, to do, today's sessions, "something
 * not right", plus the done state that replaces to-do once nothing is
 * outstanding. "Fuelling today" — a card this page carried before this
 * pass — moved to Programme, which now has the spec's own dedicated
 * nutrition-targets card (§11); showing standing targets in both places
 * was two homes for one real number.
 *
 * Gym never appears in "to do" here: fetchMyOutstanding only resolves
 * wellness and training_rpe (see its own header), and detecting "today has
 * an unfinished gym session" is a real, separate query this pass doesn't
 * add — Programme and the session itself are still the real entry points.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, claims, timezone, firstName, lastName } =
    await requireAthlete();
  const params = await searchParams;
  const today = todayIso(timezone);
  const weekStart = mondayOf(today);
  const nutritionWeekStart = addDays(weekStart, -7);

  const [availability, outstanding, sessions, nutritionCheckin, myAllocation, weekMd] =
    await Promise.all([
      fetchAthleteAvailability(db, orgId, athleteId),
      fetchMyOutstanding(db, athleteId, today),
      fetchAthleteDaySessions(db, orgId, athleteId, today),
      fetchCheckinForWeek(db, athleteId, nutritionWeekStart),
      fetchMyAllocation(db, athleteId, weekStart),
      fetchWeekMdLabels(db, orgId, weekStart),
    ]);

  const todoItems = [
    ...outstanding.map((item) => ({
      domain: item.domain,
      href: item.href,
      name: item.domain === 'wellness' ? 'Wellness' : 'Training',
      sub:
        item.domain === 'wellness'
          ? 'About 45 seconds'
          : `${item.label} · about 20 seconds`,
    })),
    ...(!nutritionCheckin
      ? [
          {
            domain: 'nutrition' as const,
            href: '/nutrition-check-in',
            name: 'Weekly check-in',
            sub: 'Did you hit your protein target most days? · about 10 seconds',
          },
        ]
      : []),
  ];
  const outstandingCount = todoItems.length;

  const toastMessage = toastMessageFor(params);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <div className="hd">
        <span className="av" aria-hidden="true">
          {initials({ first_name: firstName, last_name: lastName })}
        </span>
        <h1 className="d">{formatDate(today)}</h1>
        <span className={`pill status-pill ${outstandingCount > 0 ? 'pill-warn' : 'pill-good'}`}>
          {outstandingCount > 0 ? (
            <>
              <span className="mono">{outstandingCount}</span> to do
            </>
          ) : (
            'Up to date'
          )}
        </span>
      </div>

      <OutboxFlusher orgId={orgId} athleteId={athleteId} userId={claims.userId} />

      {toastMessage ? <Toast message={toastMessage} clearHref="/today" /> : null}

      <div className="card wk-strip" aria-label="This week">
        {weekDays.map((date, i) => {
          const isToday = date === today;
          const offset = weekMd.get(date) ?? null;
          const md = mdLabel(offset);
          const tone = md === 'MD' ? 'md' : md === 'MD-1' ? 'md-1' : undefined;
          const explainer = mdExplainer(offset);
          return (
            <div key={date} className="wk-day" data-today={isToday}>
              <span className="wi">{WEEKDAY_INITIAL[i]}</span>
              <span className="wn mono">{Number(date.slice(8, 10))}</span>
              <span className="wo mono" data-tone={tone} title={explainer ?? undefined}>
                {md ?? ''}
              </span>
            </div>
          );
        })}
      </div>

      <AvailabilityBanner
        status={availability.current?.status ?? null}
        restrictions={availability.current?.restrictions ?? []}
        reasonCategory={availability.current?.reason_category ?? null}
        note={availability.current?.note ?? null}
      />

      {myAllocation ? (
        <p className="banner" role="status">
          <span className="g g-good" aria-hidden="true">
            ✓
          </span>
          <span>
            <b>Team this week: {myAllocation.team_name}.</b> Set by your coach.
          </span>
        </p>
      ) : null}

      {todoItems.length > 0 ? (
        <section aria-labelledby="todo-title">
          <h2 className="sect" id="todo-title">
            To do <span className="mono">{todoItems.length}</span>
          </h2>
          <div className="card flush">
            {todoItems.map((item, index) => (
              <div key={`${item.domain}-${index}`}>
                {index > 0 ? <div className="hair" /> : null}
                <Link href={item.href} className="todo">
                  <span className="gl" data-domain={item.domain} aria-hidden="true">
                    {item.domain === 'wellness' ? 'WEL' : item.domain === 'training_rpe' ? 'RPE' : 'NUT'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                    <span className="tiny" style={{ display: 'block', marginTop: 2 }}>
                      {item.sub}
                    </span>
                  </span>
                  {item.domain === 'nutrition' ? (
                    <span className="pill-optional">Optional</span>
                  ) : (
                    <span className="pill pill-warn">Due</span>
                  )}
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="card done-card">
          <div className="done-check" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10.5l4 4 8-9"
                stroke="var(--good-text)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="done-title">You&rsquo;re up to date.</p>
          <p className="done-sub">Nothing expected of you today is outstanding.</p>
        </div>
      )}

      <section aria-labelledby="today-title">
        <h2 className="sect" id="today-title">
          Today
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing scheduled"
            body="You are not named in a session today. Rest or check with your coach."
          />
        ) : (
          <div className="card flush">
            {sessions.map((session, index) => {
              const md = mdLabel(session.md_offset);
              const cancelled = session.status === 'cancelled';
              return (
                <div key={session.id}>
                  {index > 0 ? <div className="hair" /> : null}
                  <div className="sess" style={{ opacity: cancelled ? 0.55 : 1 }}>
                    <span className="tm mono">{formatTime(session.starts_at)}</span>
                    <div>
                      <div className="ti">
                        <span style={{ textDecoration: cancelled ? 'line-through' : 'none' }}>
                          {session.title}
                        </span>
                        <span className="pill pill-neutral">{enumLabel(session.session_type)}</span>
                        {/* screens/schedule.md's realtime broadcast on
                         * cancellation is not built here — see
                         * lib/queries/schedule.ts's header comment. An
                         * athlete only learns of a cancellation by opening
                         * this screen, not the moment it happens, which is
                         * a real, documented gap for the case the spec
                         * calls out as the one to get right. */}
                        {cancelled ? <span className="pill pill-bad">Cancelled</span> : null}
                      </div>
                      <div className="lo">
                        {session.location ?? 'Location not set'} ·{' '}
                        <span className="mono">{session.duration_min ?? BLANK}</span> min
                      </div>
                    </div>
                    {md ? (
                      <span className="pill pill-neutral mono" title={mdExplainer(session.md_offset) ?? undefined}>
                        {md}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* "Something not right?" — §5's always-available report route, now
       * wired to the real thing: migration 0040's problem_reports table,
       * 03-flows.md §6 ("Athlete reports a problem from Today tab ->
       * notification to Medical"). */}
      <Link href="/report-problem" className="report-card">
        <span className="k">Something not right?</span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </Link>
    </>
  );
}
