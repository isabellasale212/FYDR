import Link from 'next/link';
import { AvailabilityBanner } from '@/components/AvailabilityBanner/AvailabilityBanner';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { InjuryClinical } from '@/components/InjuryClinical/InjuryClinical';
import { OutboxFlusher } from '@/components/OutboxFlusher/OutboxFlusher';
import { fetchAthleteAvailability } from '@/lib/queries/availability';
import { fetchAthleteInjuryClinical } from '@/lib/queries/athleteInjuryClinical';
import { fetchMyOutstanding } from '@/lib/queries/compliance';
import { availabilityStatus } from '@/lib/status';
import { availabilityLine, rpeWhen, sessionMeta } from '@/lib/todayRows';
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
  addDays,
  enumLabel,
  formatDate,
  formatTime,
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
/* PATTERN-S6 A2 (2026-09-12): no toast on Today. Each entry form still
   returns here with ?submitted= (the queue-then-Today behaviour is
   protected), but the list losing its row is the answer, and the outbox's
   own status line says what is still held on the phone. The toast used to
   say "Wellness submitted · queued, syncs on signal" over a list that had
   already changed. */

/**
 * The compliance surface, ATHLETE-APP-SPEC.md §5, as redrawn on 2026-09-08.
 * Four blocks now, in the reference's order: week strip with the fixture row
 * beneath it, the availability row, the to-do list, and the done state that
 * replaces the to-do list once nothing is outstanding.
 *
 * TWO BLOCKS WERE REMOVED and neither was an oversight. Today's session list
 * went because the reference makes the to-do list this page's only actionable
 * list — what is on today is the schedule's job, not this screen's. The
 * "Something not right?" row went with it; the report-a-problem route still
 * exists at /report-problem and problem_reports is unchanged, but nothing on
 * Today links to it any more. That is worth knowing rather than assuming: it
 * was the only in-app entry point, so an athlete now needs the URL or a link
 * from somewhere yet to be built. Raised with Isabella on 2026-09-08 and
 * confirmed. "Fuelling today" — a card this page carried before this
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
  const { db, orgId, athleteId, claims, timezone, firstName } = await requireAthlete();
  /* ?submitted= still arrives from the entry forms; nothing reads it now
     (S6 A2). Awaited so the route stays dynamic on the query, as before. */
  await searchParams;
  const today = todayIso(timezone);
  const weekStart = mondayOf(today);
  const nutritionWeekStart = addDays(weekStart, -7);

  const [
    availability,
    outstanding,
    nutritionCheckin,
    myAllocation,
    weekMd,
    weekSessionTypes,
    nextFixture,
    sessions,
  ] = await Promise.all([
      fetchAthleteAvailability(db, orgId, athleteId),
      fetchMyOutstanding(db, athleteId, today),
      fetchCheckinForWeek(db, athleteId, nutritionWeekStart),
      fetchMyAllocation(db, athleteId, weekStart),
      fetchWeekMdLabels(db, orgId, weekStart, timezone),
      // Match/training/recovery/rest colouring for the week strip.
      fetchAthleteWeekSessionTypes(db, orgId, athleteId, weekStart, timezone),
      /* What the week is building towards. From today, not from the week's
         Monday: on a Sunday the fixture that bounded this week has been and
         gone, and "working towards" a match already played is nonsense. */
      fetchNextFixture(db, orgId, new Date().toISOString()),
      fetchAthleteDaySessions(db, orgId, athleteId, today, timezone),
    ]);

  /* Sequential rather than joined to the Promise.all above, because it needs
     the injury id that availability resolves. Skipped entirely when there is no
     linked injury, which is the common case — and when there is one, the view
     returns nothing for an athlete under 18 (migration 0093). */
  const injuryClinical = await fetchAthleteInjuryClinical(db, availability.injury?.id);


  /* ATH-ADULT-02, 2026-09-11. Each row is a name, a subtitle and a chevron;
     the WEL / RPE / NUT tiles are gone, the names carry the domain.

     THE DURATIONS, and where each comes from — asked for explicitly, because
     ATH-ADULT-01 removed an unverified "45 seconds" claim from the sign-in
     page. "45 sec": 00-product-overview.md §198's success criterion and
     08-notifications.md's push copy ("Wellness, 45 seconds"). "about 10 sec":
     08-notifications.md ("three answers, under 10 seconds"). The RPE row
     carries NO duration: "20 seconds" exists only in
     docs/screens/legacy/training-entry.md, which is not binding, so it is
     not shipped until Isabella decides. Its subtitle is when the session
     was — "Today 10:45", "Yesterday" — from rpeWhen, in club time. */
  const todoItems = [
    ...outstanding.map((item) => ({
      domain: item.domain,
      href: item.href,
      name: item.domain === 'wellness' ? 'Wellness' : item.label,
      sub: item.domain === 'wellness' ? '45 sec' : item.session ? rpeWhen(item.session, today, timezone) : '',
    })),
    ...(!nutritionCheckin
      ? [
          {
            domain: 'nutrition' as const,
            href: '/nutrition-check-in',
            name: 'Weekly nutrition check-in',
            sub: 'about 10 sec',
          },
        ]
      : []),
  ];

  /* The one-line banner above To do, only when something is wrong (S2). It
     says the status and what they may do, in the card's own words, and
     links down to the card, which keeps every line it had. Available shows
     nothing here: an all-clear does not need to interrupt. */
  const availState = availabilityStatus(availability.current?.status ?? null);
  const availTone = availability.current?.status === 'unavailable' ? 'bad' : 'warn';
  const availSummary =
    availability.current && availability.current.status !== 'available'
      ? availabilityLine(
          availState.label,
          availability.current.restrictions ?? [],
          availability.current.reason_category ? enumLabel(availability.current.reason_category) : null,
          enumLabel,
        )
      : null;
  const nowMs = Date.now();

  /* Time-of-day aware in the ORGANISATION's timezone, not the server's. A
     greeting that says "Morning" at nine at night is worse than no greeting,
     and this app is read on a phone in the club's own country. */
  const hourNow = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).format(new Date()),
  );
  const greeting = hourNow < 12 ? 'Morning' : hourNow < 18 ? 'Afternoon' : 'Evening';

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /* Anchored to the week strip's own value rather than read per session. The
     day's session list this used to feed is gone with the 2026-09-08 redesign,
     but the header eyebrow below still needs today's MD offset and still needs
     it to agree with the strip. */
  const todayMdOffset = weekMd.get(today) ?? null;
  /* Shown in the header eyebrow. Null when the club has no fixture bounding
     this week, in which case the eyebrow is just the date — an MD offset with
     no matchday to count towards would be a number about nothing. */
  const todayMd = mdLabel(todayMdOffset);

  return (
    <>
      {/* NO AVATAR — ATH-ADULT-02 follow-up, Isabella's decision 2026-09-11,
          matching the board: the header is the date line and the greeting.
          The tab bar's Me covers the navigation the glyph used to hint at,
          and the users query that existed only to fetch it went with it. */}
      <div className="hd">
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

      {/* S2: when something is wrong it is said once, in one line, above the
          list — and the card it links to sits below the day with every line it
          had. Available says nothing here. */}
      {availSummary ? (
        <a href="#availability" className="avail-line" data-tone={availTone}>
          {availSummary}
        </a>
      ) : null}

      {/* THE WEEK, COMPACT, ABOVE TO DO — ATH-ADULT-02 follow-up, Isabella's
          decision 2026-09-11. The seven-day row with its MD labels sits on the
          ground here, under the greeting and the availability line, so the
          shape of the week is read before the list of what is owed; the card
          below Today keeps "Working towards". Measured at 375×812 with the
          availability line showing: To do's first row moved from 244px to
          367px, still inside the fold (see this commit's handover). */}
      <section aria-labelledby="week-title">
        <h2 className="eyebrow today-sect" id="week-title">
          This week
        </h2>
        <div className="wk-strip wk-compact">
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
      </section>

      {/* THE TO-DO LIST, always rendered, and its own status: the count reads
          off the same array the rows render from, and with nothing outstanding
          the slot holds one row-shaped card rather than an empty region. */}
      <section aria-labelledby="todo-title">
        <h2 className="eyebrow today-sect todo-head" id="todo-title">
          <span>To do</span>
          <span className="num">{todoItems.length > 0 ? `${todoItems.length} left` : 'None left'}</span>
        </h2>
        <div className="td-list">
          {todoItems.length > 0 ? (
            todoItems.map((item, index) => (
              <Link key={`${item.domain}-${index}`} href={item.href} className="card td-row">
                <span style={{ minWidth: 0 }}>
                  {/* Spec §7.1: row name 17/700 — 1.0625rem IS that 17px at the
                      default root, in rem so it follows the text setting. */}
                  <span className="td-name" style={{ fontSize: '1.0625rem' }}>{item.name}</span>
                  <span className="td-sub num">{item.sub}</span>
                </span>
                <span className="chev td-chev" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))
          ) : (
            <div className="card td-row td-empty">
              <span style={{ minWidth: 0 }}>
                <span className="td-name" style={{ fontSize: '1.0625rem' }}>You&rsquo;re up to date</span>
                <span className="td-sub">Nothing expected of you today is outstanding.</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* RESTORED 8 September 2026. The redesign removed this because the
          reference does not draw it and "the to-do list is the page's only
          actionable list now" — but the to-do list holds what an athlete owes
          the club, not what the club has asked of them today. Without this
          section an athlete had no way to see when or where they were training,
          on any screen: My data's training tab is history, and Programme is the
          gym plan, not the day.

          Each row is the session's name and one line — start, place, and
          whether it has finished, is under way, or starts within two hours
          (sessionMeta, club time). Nothing here claims to know who is in a
          session or what they may do in it: no data supports that (S5). */}
      <section aria-labelledby="today-title">
        <h2 className="eyebrow today-sect" id="today-title">
          Today
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing scheduled"
            body="You are not named in a session today. Rest or check with your coach."
          />
        ) : (
          <div className="td-list">
            {sessions.map((session) => {
              const cancelled = session.status === 'cancelled';
              return (
                <div key={session.id} className="card day-row" style={{ opacity: cancelled ? 0.55 : 1 }}>
                  <p className="day-name">
                    <span style={{ textDecoration: cancelled ? 'line-through' : 'none' }}>{session.title}</span>
                    {/* screens/schedule.md's realtime broadcast on
                     * cancellation is not built here — see
                     * lib/queries/schedule.ts's header comment. An
                     * athlete only learns of a cancellation by opening
                     * this screen, not the moment it happens, which is
                     * a real, documented gap for the case the spec
                     * calls out as the one to get right. */}
                    {cancelled ? <span className="pill pill-bad">Cancelled</span> : null}
                  </p>
                  <p className="day-meta num">{sessionMeta(session, nowMs, timezone)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* "Working towards" keeps its card below Today; the seven-day strip
          that shared it moved above To do (see the section under the
          greeting). Fydr Athlete App.dc.html 23a: what the week is building
          towards. Not a link: there is no athlete-facing fixture screen to
          open, and the design's chevron would promise one. Not showing a meet
          time either — the design has "meet 12:15" but fixtures carry only a
          kickoff_at, so that clause would be invented. The whole card is
          absent when nothing is scheduled, rather than an empty box: a club
          with no fixture on the calendar is not working towards anything this
          app knows about, and saying so on the screen an athlete opens every
          morning is noise. */}
      {nextFixture ? (
        <div className="card wk-card">
          <div className="wk-towards">
            <div>
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
            {/* NO CHEVRON, though the reference draws one. There is no athlete
                fixture screen for it to open, and a chevron with no destination
                is a control that lies about being one. The row is laid out with
                room for it, so adding one is a line when the screen exists. */}
          </div>
        </div>
      ) : null}

      <AvailabilityBanner
        status={availability.current?.status ?? null}
        restrictions={availability.current?.restrictions ?? []}
        reasonCategory={availability.current?.reason_category ?? null}
        /* Already fetched above and, until 2026-09-08, thrown away on every
           load. fetchAthleteAvailability only resolves this when the
           availability row actually names the injury, so an athlete who is out
           for a non-injury reason with an unrelated injury on file gets null
           rather than the wrong injury attached to the wrong absence. */
        injury={availability.injury}
        /* RESTORED 8 September 2026. The redesign dropped this prop because the
           reference's Modified row has no third line; dropping it took away the
           only place an athlete reads what medical staff actually wrote about
           their own availability, which is a worse outcome than a taller card. */
        note={availability.current?.note ?? null}
        timezone={timezone}
      />

      {/* RESTORED with the note above, and this is the one that mattered most.
          Diagnosis and mechanism were scoped, built, age-gated (migration 0093),
          confirmed on production for a real athlete, and then the Today redesign
          removed their ONLY route — leaving the component, the query and the
          view all live and unreachable.

          Renders nothing when there is no clinical record, no injury, or the
          reader is a minor: the view draws that last line, not this page. Each
          field is guarded inside the component, because a record can carry one
          and not the other. */}
      <InjuryClinical
        diagnosis={injuryClinical.diagnosis}
        mechanism={injuryClinical.mechanism}
      />


      {/* Plain text below the card, as drawn: a fact, not a status banner. */}
      {myAllocation ? (
        <p className="team-line" role="status">
          Team this week: {myAllocation.team_name}. <span className="dot">Set by your coach.</span>
        </p>
      ) : null}

    </>
  );
}
