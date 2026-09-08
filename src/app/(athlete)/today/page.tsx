import Link from 'next/link';
import { AvailabilityBanner } from '@/components/AvailabilityBanner/AvailabilityBanner';
/* TEMPORARY, with the component it renders. Both go when the Tier 2 decision is
   made. See src/lib/diagnosisPreview.ts for the four locks on it. */
import { DiagnosisPreview } from '@/components/DiagnosisPreview/DiagnosisPreview';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { OutboxFlusher } from '@/components/OutboxFlusher/OutboxFlusher';
import { Toast } from '@/components/Toast/Toast';
import { fetchAthleteAvailability } from '@/lib/queries/availability';
import { diagnosisPreviewEnabled, fetchDiagnosisPreview } from '@/lib/diagnosisPreview';
import { fetchMyOutstanding } from '@/lib/queries/compliance';
import {
  fetchAthleteDaySessions,
  fetchAthleteWeekSessionTypes,
  fetchNextFixture,
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
function toastMessageFor(
  params: Record<string, string | string[] | undefined>,
  timezone: string,
): string | null {
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
      ? `Nutrition check-in submitted for week of ${formatDate(week, timezone)} · queued, syncs on signal`
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

  const [
    availability,
    outstanding,
    sessions,
    nutritionCheckin,
    myAllocation,
    weekMd,
    userRow,
    weekSessionTypes,
    nextFixture,
  ] = await Promise.all([
      fetchAthleteAvailability(db, orgId, athleteId),
      fetchMyOutstanding(db, athleteId, today),
      fetchAthleteDaySessions(db, orgId, athleteId, today, timezone),
      fetchCheckinForWeek(db, athleteId, nutritionWeekStart),
      fetchMyAllocation(db, athleteId, weekStart),
      fetchWeekMdLabels(db, orgId, weekStart, timezone),
      // Only for the header glyph. This page drew initials unconditionally,
      // so an athlete who had uploaded a photo on Me still saw initials
      // here — the photo was never fetched on this route at all.
      db.from('users').select('avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
      // Match/training/recovery/rest colouring for the week strip.
      fetchAthleteWeekSessionTypes(db, orgId, athleteId, weekStart, timezone),
      /* What the week is building towards. From today, not from the week's
         Monday: on a Sunday the fixture that bounded this week has been and
         gone, and "working towards" a match already played is nonsense. */
      fetchNextFixture(db, orgId, new Date().toISOString()),
    ]);

  /* TEMPORARY, and sequential on purpose rather than joining the Promise.all
     above: it needs the injury id that availability resolves, and the gate is
     asked FIRST so that in every environment but this one it costs a boolean
     and no round trip. Delete with the component. */
  const diagnosisPreview = diagnosisPreviewEnabled()
    ? await fetchDiagnosisPreview(db, availability.injury?.id)
    : null;

  const todoItems = [
    ...outstanding.map((item) => ({
      domain: item.domain,
      href: item.href,
      /* The SESSION's name is the title for an RPE task — "Team run", not
         "Training" — per Fydr Athlete App.dc.html 23a. It was in the subtitle,
         which made every training row read identically until you got to the
         second line.
         The design's subtitle also carries a timing clause ("open since
         07:00", "due by 19:45"). compliance_expectations holds no such times —
         only domain, session, required and waived — so that half is left out
         rather than invented. */
      name: item.domain === 'wellness' ? 'Wellness' : (item.label || 'Training'),
      sub: item.domain === 'wellness' ? '45 seconds' : '20 seconds',
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

  const toastMessage = toastMessageFor(params, timezone);

  /* Time-of-day aware in the ORGANISATION's timezone, not the server's. A
     greeting that says "Morning" at nine at night is worse than no greeting,
     and this app is read on a phone in the club's own country. */
  const hourNow = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).format(new Date()),
  );
  const greeting = hourNow < 12 ? 'Morning' : hourNow < 18 ? 'Afternoon' : 'Evening';

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Every session in `sessions` falls on `today` (fetchAthleteDaySessions is
  // bounded to that one calendar day), so the same anchored value the week
  // strip below already uses for `today` applies uniformly to every pill in
  // the day's session list — this replaces each session's raw, unanchored
  // md_offset, which could disagree with the week strip on this very page.
  const todayMdOffset = weekMd.get(today) ?? null;
  /* Shown in the header eyebrow. Null when the club has no fixture bounding
     this week, in which case the eyebrow is just the date — an MD offset with
     no matchday to count towards would be a number about nothing. */
  const todayMd = mdLabel(todayMdOffset);

  return (
    <>
      <div className="hd">
        {userRow.data?.avatar_url ? (
          /* Supabase Storage URL, already public and sized by the uploader.
           * next/image would need a remotePatterns entry for a host that
           * varies per project, for a 30px glyph. */
          // eslint-disable-next-line @next/next/no-img-element
          <img className="av" src={userRow.data.avatar_url} alt="" width={30} height={30} />
        ) : (
          <span
            className="av"
            aria-hidden="true"
            style={
              userRow.data?.avatar_colour
                ? {
                    background: `var(--group-${userRow.data.avatar_colour.toLowerCase()})`,
                    color: 'var(--on-accent)',
                  }
                : undefined
            }
          >
            {initials({ first_name: firstName, last_name: lastName })}
          </span>
        )}
        {/* Fydr Athlete App.dc.html 23a: an eyebrow carrying the date and
            today's matchday offset, then a greeting rather than the date as
            the headline. The count that used to sit here as a pill moved to
            the "To do" heading, where the design puts it — it belongs beside
            the list it counts, not beside the athlete's name. */}
        <div style={{ minWidth: 0 }}>
          {/* Accent, not muted: the date and today's matchday offset are the
              one line on this screen that changes every morning, and the header
              reads as the athlete's own rather than as a form label. */}
          <p className="eyebrow eyebrow-accent">
            {formatDate(today, timezone).toUpperCase()}
            {todayMd ? ` · ${todayMd}` : ''}
          </p>
          <h1 className="d">
            {greeting}, {firstName}
          </h1>
        </div>
      </div>

      <OutboxFlusher orgId={orgId} athleteId={athleteId} userId={claims.userId} timezone={timezone} />

      {toastMessage ? <Toast message={toastMessage} clearHref="/today" /> : null}

      <div className="card wk-card">
        {/* A visible "THIS WEEK", not just the strip's aria-label. The design
            (01-final.png) heads this card with it, and a sighted athlete had
            nothing naming the row of seven dates — the label existed for a
            screen reader only. */}
        <p className="eyebrow wk-card-label">This week</p>
        <div className="wk-strip">
        {weekDays.map((date, i) => {
          const isToday = date === today;
          const offset = weekMd.get(date) ?? null;
          const md = mdLabel(offset);
          const tone = md === 'MD' ? 'md' : md === 'MD-1' ? 'md-1' : undefined;
          const explainer = mdExplainer(offset);

          /* Day kind, so match, training and rest days are told apart at a
           * glance rather than by reading MD labels. Match wins over
           * everything (a matchday with a shakeout on it is still a
           * matchday); recovery only counts as recovery when nothing harder
           * shares the day; anything else with a session is training. A day
           * with no session of this athlete's own is rest — genuinely rest,
           * since fetchAthleteWeekSessionTypes resolves the same "mine" set
           * as the day list below, not merely a day nothing was loaded for. */
          const types = weekSessionTypes.get(date);
          const kind = !types
            ? 'rest'
            : types.has('match')
              ? 'match'
              : types.size === 1 && types.has('recovery')
                ? 'recovery'
                : 'training';
          const kindLabel =
            kind === 'match' ? 'Match' : kind === 'training' ? 'Training' : kind === 'recovery' ? 'Recovery' : 'Rest';
          /* Abbreviated for the 40px column the MD label shares. "Training" and
             "Recovery" overrun it at 10.5px; the full word is still on the row
             for screen readers and on hover. */
          const kindShort =
            kind === 'match' ? 'Match' : kind === 'training' ? 'Train' : kind === 'recovery' ? 'Rec' : 'Rest';

          return (
            <div key={date} className="wk-day" data-today={isToday} data-kind={kind}>
              <span className="wi">{WEEKDAY_INITIAL[i]}</span>
              <span className="wn num">{Number(date.slice(8, 10))}</span>
              {/* Colour is never the only channel — the kind is also spelled
                  out for screen readers and on hover. */}
              <span className="visually-hidden">{kindLabel}</span>
              {/* Spec §7.1 puts the MD label on this line and carries the day's
                  kind in the column's own fill and border — so the dot that was
                  here, and the legend under the card that explained the dot,
                  both go.

                  MD needs a fixture to count towards. When the calendar has
                  none the line falls back to the kind in a word, which is the
                  fact the legend was carrying anyway; an empty third line would
                  drop it and leave the column's colour unexplained. */}
              <span className="wo num" data-tone={tone} title={explainer ?? kindLabel}>
                {/* Rest prints nothing. The word only earns the line where
                    there is something on: a week with no sessions rendered
                    "Rest" seven times, which is a wall of identical text
                    saying what seven empty columns already said. A day with
                    nothing scheduled is shown by having nothing — no fill, no
                    label — which is the same rule the rest of this app applies
                    to an absent value. */}
                {md ?? (kind === 'rest' ? '' : kindShort)}
              </span>
            </div>
            );
          })}
        </div>

        {/* Fydr Athlete App.dc.html 23a: what the week is building towards,
            inside the same card as the week it counts.
            Not a link: there is no athlete-facing fixture screen to open, and
            the design's chevron would promise one. Not showing a meet time
            either — the design has "meet 12:15" but fixtures carry only a
            kickoff_at, so that clause would be invented.
            Absent entirely when nothing is scheduled, rather than an empty
            heading: a club with no fixture on the calendar is not working
            towards anything this app knows about, and saying so in a box is
            noise on the screen an athlete opens every morning. */}
        {nextFixture ? (
          <div className="wk-towards">
            <p className="eyebrow">Working towards</p>
            <p className="wk-towards-name">
              v {nextFixture.opponent} · {enumLabel(nextFixture.home_away)}
            </p>
            <p className="wk-towards-when num">
              {formatDate(nextFixture.kickoff_at.slice(0, 10), timezone)} · kick-off{' '}
              {formatTime(nextFixture.kickoff_at, timezone)}
              {nextFixture.venue ? ` · ${nextFixture.venue}` : ''}
            </p>
          </div>
        ) : null}
      </div>

      <AvailabilityBanner
        status={availability.current?.status ?? null}
        restrictions={availability.current?.restrictions ?? []}
        reasonCategory={availability.current?.reason_category ?? null}
        note={availability.current?.note ?? null}
        /* Already fetched above and, until 2026-09-08, thrown away on every
           load. fetchAthleteAvailability only resolves this when the
           availability row actually names the injury, so an athlete who is out
           for a non-injury reason with an unrelated injury on file gets null
           rather than the wrong injury attached to the wrong absence. */
        injury={availability.injury}
        timezone={timezone}
      />

      {/* TEMPORARY. Off in every deployed environment and off locally until
          FYDR_PREVIEW_DIAGNOSIS=1 is set against scratch — the gate is asked
          before the database is, so a closed gate costs one boolean and no
          query. Delete this block, the component and lib/diagnosisPreview when
          the Tier 2 decision is made. */}
      <DiagnosisPreview diagnosis={diagnosisPreview} />

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
          <h2 className="sect todo-head" id="todo-title">
            <span>To do</span>
            {/* "N left", not a bare count: the design puts the number beside
                the list it counts and says what it means. Amber because an
                outstanding item is a thing to act on, not a statistic. */}
            <span className="todo-left num">{todoItems.length} left</span>
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
                    {/* Spec §7.1: row name 17/700. */}
                    <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {item.name}
                    </span>
                    <span className="tiny" style={{ display: 'block', marginTop: 2 }}>
                      {item.sub}
                    </span>
                  </span>
                  {/* No Due/Optional pill. Fydr Athlete App.dc.html 23a puts
                      the same information in the row's own subtitle — "45
                      seconds · open since 07:00" — where it reads as a fact
                      about the task rather than a badge to decode, and it
                      leaves the row a clean name-and-chevron shape. Whether a
                      task is optional is already in item.sub. */}
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
              const md = mdLabel(todayMdOffset);
              const cancelled = session.status === 'cancelled';
              return (
                <div key={session.id}>
                  {index > 0 ? <div className="hair" /> : null}
                  <div className="sess" style={{ opacity: cancelled ? 0.55 : 1 }}>
                    <span className="tm num">{formatTime(session.starts_at, timezone)}</span>
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
                        <span className="num">{session.duration_min ?? BLANK}</span> min
                      </div>
                    </div>
                    {md ? (
                      <span className="pill pill-neutral num" title={mdExplainer(todayMdOffset) ?? undefined}>
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
