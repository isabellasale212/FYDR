import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchMyOpenGymSessionToday, fetchMyProgrammeSessions } from '@/lib/queries/programmes';
import { resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import { NutritionTargetsCard } from '@/components/NutritionTargetsCard/NutritionTargetsCard';
import { Toast } from '@/components/Toast/Toast';
import { enumLabel, formatDate, mdExplainer, mdLabel, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My programme · Fydr' };

/** Gameplan 4.2 / audit S8: block names are free text a coach types in
 *  ProgrammeBuilder (no fixed list), so this can only explain the
 *  well-known periodisation phase names, not every possible block name.
 *  "Accumulation" is the one confirmed live in this build's own data
 *  (`programme_blocks`); left as an exact, case-insensitive lookup rather
 *  than a guess dressed up as a definition — an unrecognised block name
 *  gets no tooltip rather than a wrong one. */
const BLOCK_PHASE_EXPLAINER: Record<string, string> = {
  accumulation: 'A training phase focused on building work volume and capacity, before the load intensifies.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/my-programme.md / ATHLETE-APP-SPEC.md §11, four cards: programme
 *  header, prescribed exercises (the gym/rehab session list this screen
 *  already had), nutrition targets, and a rehab card only when one exists.
 *
 * The spec's nutrition-targets bars plot intake against target (§11's own
 * numbers: "3,050 / 3,200 kcal · 95%"). There is no real "3,050" anywhere —
 * CLAUDE.md rule 8 and the live schema agree there is no daily intake
 * table to compute one from (see nutritionTargets.ts's own comment on
 * exactly this cut). What's real is the target half only, so these rows
 * show the standing target with no progress fill rather than a fabricated
 * percentage — the same "guidance only, nothing to log" framing Today's
 * card used before this pass folded it in here instead of keeping the
 * same numbers in two places.
 *
 * No "assigned by" line: programme_assignments carries no coach name this
 * query resolves today. No rehab-phase card: still the Injuries clinical
 * boundary's own territory, not this screen's, per this file's own
 * previous note. */
export default async function MyProgrammePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, athleteId, timezone, orgId, firstName } = await requireAthlete();
  const params = await searchParams;
  const today = todayIso(timezone);
  /* The nutrition check-in and outstanding-count queries went with the header
     pill they fed. Nothing else on this screen asks what is still to do, and
     that count belongs on Today, beside the list it counts. Two fewer round
     trips, and one fewer sequential await after the parallel batch. */
  const [sessions, target, openGym, doneToday] = await Promise.all([
    fetchMyProgrammeSessions(db, athleteId),
    resolveTargetForDate(db, athleteId, today),
    /* Reopening (Isabella, 15 Sept 2026, mobile queue #9): a session opened
       today and not finished stays open until it is — startOrGetSessionLog
       finds today's in-progress log and the logger resumes at the next set.
       That already held; what was missing was the way back in from THIS
       list, which read the same for every row. The open session's row now
       says "Under way · 2 of 13 sets", a session finished today says so,
       and tapping either opens the same log. Today's To do carries the
       open one as well. */
    fetchMyOpenGymSessionToday(db, orgId, athleteId, today),
    db
      .from('gym_session_logs')
      .select('programme_session_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .eq('entry_date', today)
      .eq('status', 'complete')
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return new Set((data ?? []).map((r) => r.programme_session_id).filter((id): id is string => !!id));
      }),
  ]);
  /* The weigh-in read (PATTERN-S5 C7) went with the provenance line it fed —
     NutritionTargetsCard, 16 Sept 2026. */

  /* programme-dates.md (Isabella, 15 September 2026; migration 0132): the
     assignment carries a start date and the end falls out of the length. A
     session whose assignment has run out of weeks is OVER — the screen says
     the block finished and when, rather than emptying or listing sessions as
     if they were still to do. An unmapped assignment (no start date) is
     shown as before: it has no dates to be over by. Overlap is allowed, so
     the live sessions are whatever is not finished. No "due today" and no
     "missed" here: each is its own piece of work, not this decision's. */
  const isFinished = (s: (typeof sessions)[number]) => s.assignment_ends_on !== null && s.assignment_ends_on < today;
  const live = sessions.filter((s) => !isFinished(s));
  const finishedBlocks = [...new Map(sessions.filter(isFinished).map((s) => [s.programme_id, s])).values()];

  /* TODAY'S SESSION ONLY (Isabella, 16 Sept 2026, the evening queue, 1.4:
     "show only the gym session scheduled for today; no previous days'
     sessions"). Each live block is still its own titled section (the
     pre-deploy fixes, 15 Sept 2026, #3 — overlap is allowed, so a rehab
     block beside a lifting block reads as two), but a block now lists the
     session whose scheduled_on (0132) is today — plus one opened or logged
     today under a different date, so the way back into an open session
     never disappears — and nothing else. A block with nothing today says so
     and names the next session by its date, as words, so a rest day is not
     an empty screen; the next session is not a row, because the queue asked
     for today's and the rest is after Friday (docs/after-friday.md). An
     undated block (no assignment start) cannot say which session is today's
     and lists its sessions as before. */
  const blocks = [...live.reduce((m, s) => {
    const list = m.get(s.programme_id) ?? [];
    list.push(s);
    m.set(s.programme_id, list);
    return m;
  }, new Map<string, typeof live>()).values()];
  const isDated = (block: typeof live) => block[0]?.assignment_starts_on !== null;
  const todayRows = (block: typeof live) =>
    isDated(block)
      ? block.filter(
          (s) => s.scheduled_on === today || openGym?.programmeSessionId === s.session_id || doneToday.has(s.session_id),
        )
      : block;
  const nextRow = (block: typeof live) =>
    block.filter((s) => s.scheduled_on !== null && s.scheduled_on > today).sort((a, b) => a.scheduled_on!.localeCompare(b.scheduled_on!))[0] ?? null;

  return (
    <>
      <div className="hd">
        <h1 className="d">{firstName}&rsquo;s programme</h1>
      </div>

      {typeof params.submitted === 'string' ? (
        <Toast message="Gym session logged." clearHref="/programme" />
      ) : null}

      {finishedBlocks.map((b) => (
        /* The block finished, and when — never an empty screen with no
           explanation (programme-dates.md). */
        <div className="card" key={b.programme_id} data-finished-block>
          <p className="eyebrow">{enumLabel(b.programme_type)} · finished</p>
          <p style={{ margin: 0 }}>
            <strong>{b.programme_name}</strong> finished on {formatDate(b.assignment_ends_on, timezone)}.
            {live.length === 0 ? ' Nothing new has been assigned yet.' : ''}
          </p>
        </div>
      ))}

      {live.length === 0 ? (
        finishedBlocks.length === 0 ? (
          <EmptyState
            title="No programme assigned"
            body="Nothing has been assigned to you yet. Check back once your coach or physio sets one up."
          />
        ) : null
      ) : (
        blocks.map((block) => {
          const first = block[0]!;
          /* The header names the block and week the athlete is IN — today's
             session's, else the next one's — not the first session's, which
             read "Foundation · Week 1" twelve weeks into the programme once
             the list beneath it stopped showing every week (16 Sept 2026). */
          const current = todayRows(block)[0] ?? nextRow(block) ?? first;
          const startsOn = first.assignment_starts_on;
          const endsOn = first.assignment_ends_on;
          return (
            <section key={first.programme_id} aria-labelledby={`prog-${first.programme_id}`} data-programme-block>
              <div className="prog-header">
                <p className="eyebrow">
                  {/* enumLabel(), not a rehab/else ternary — the real programme_type
                      enum also has conditioning/nutrition values (unreachable with
                      real data today per migration 0021's own comment, since this
                      build only ever writes gym or rehab, but a ternary would
                      silently mislabel either as "Gym" if that ever changed). */}
                  {enumLabel(first.programme_type)}
                  {' · '}
                  <span title={BLOCK_PHASE_EXPLAINER[current.block_name.toLowerCase()]}>{current.block_name}</span>
                  {` · Week ${current.week_number}`}
                </p>
                <h2 id={`prog-${first.programme_id}`}>{first.programme_name}</h2>
                {/* The block's dates, from the assignment (0132): week 1 day 1 and
                    the last day. An unmapped assignment has none, and says nothing
                    rather than something invented. */}
                {startsOn ? (
                  <p className="tiny num" style={{ margin: 'var(--sp-4) 0 0' }}>
                    {startsOn > today ? `Starts ${formatDate(startsOn, timezone)}` : `From ${formatDate(startsOn, timezone)}`}
                    {endsOn ? ` to ${formatDate(endsOn, timezone)}` : ''}
                  </p>
                ) : null}
              </div>

              <div className="card">
                <h3 className="card-title">Today</h3>
                {todayRows(block).length === 0 ? (
                  <p className="tiny" style={{ margin: 0 }} data-no-session-today>
                    {nextRow(block)
                      ? `No session today. Next: ${nextRow(block)!.session_name}, ${formatDate(nextRow(block)!.scheduled_on, timezone)}.`
                      : 'No session today.'}
                  </p>
                ) : null}
                <div className="card flush" style={{ boxShadow: 'none', border: '1px solid var(--border)' }} hidden={todayRows(block).length === 0}>
                  {todayRows(block).map((s, index) => (
                    <div key={s.session_id}>
                      {index > 0 ? <div className="hair" /> : null}
                      <Link
                        href={`/gym/${s.session_id}`}
                        className="load-row"
                        style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
                      >
                        <div>
                          <span className="nm">{s.session_name}</span>
                          {openGym && openGym.programmeSessionId === s.session_id ? (
                            <div className="tiny num prog-row-state" data-state="open">
                              Under way · {openGym.logged} of {openGym.total} sets · continue
                            </div>
                          ) : doneToday.has(s.session_id) ? (
                            <div className="tiny prog-row-state" data-state="done">
                              Logged today
                            </div>
                          ) : null}
                          <div className="tiny">
                            <span title={BLOCK_PHASE_EXPLAINER[s.block_name.toLowerCase()]}>{s.block_name}</span> · Week {s.week_number}
                            {s.day_number ? ` · Day ${s.day_number}` : ''}
                            {/* Not the audit-B2 bug class: fetchMyProgrammeSessions resolves
                                programme_sessions.md_offset, an authored template value with
                                no fixture_id and no starts_at — see programmes/page.tsx's
                                identical note. Nothing to re-anchor via anchorMdOffsetsToWeek. */}
                            {mdLabel(s.md_offset) ? (
                              <>
                                {' · '}
                                <span title={mdExplainer(s.md_offset) ?? undefined}>{mdLabel(s.md_offset)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span className="chev" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })
      )}

      {/* The targets card is shared with Today since 15 Sept 2026 (mobile
          queue #8) — NutritionTargetsCard draws it for both. */}
      <NutritionTargetsCard target={target} title="Nutrition targets" />
    </>
  );
}
