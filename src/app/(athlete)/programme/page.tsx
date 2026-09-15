import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchMyProgrammeSessions } from '@/lib/queries/programmes';
import { resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import { fetchLatestBodyMassForAthletes } from '@/lib/queries/bodyComposition';
import { targetProvenanceLine } from '@/lib/nutritionNoWeighIn';
import { Toast } from '@/components/Toast/Toast';
import { enumLabel, formatDate, mdExplainer, mdLabel, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My programme · Fydr' };

const TARGET_ROWS = [
  { key: 'energy_kcal', label: 'Energy', unit: ' kcal', litres: false },
  { key: 'protein_g', label: 'Protein', unit: 'g', litres: false },
  { key: 'carbs_g', label: 'Carbohydrate', unit: 'g', litres: false },
  { key: 'fluid_ml', label: 'Fluid', unit: 'L', litres: true },
] as const;

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
  const [sessions, target, latestMass] = await Promise.all([
    fetchMyProgrammeSessions(db, athleteId),
    resolveTargetForDate(db, athleteId, today),
    /* PATTERN-S5 C7: whether there is a weigh-in to scale the target to,
       for the provenance line — the athlete's own row, RLS. */
    fetchLatestBodyMassForAthletes(db, orgId, [athleteId], { since: '1900-01-01', asOf: today }),
  ]);
  const hasWeighIn = latestMass.has(athleteId);

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

  /* Each live block is its own titled section (Isabella, the pre-deploy
     fixes, 15 Sept 2026, #3): overlap is allowed by rule, so the header
     names the athlete and a rehab block beside a lifting block reads as two
     blocks, not as one programme's sessions under another's name. Grouped
     in the resolver's order: block sequence within a programme, programmes
     as they arrive. */
  const blocks = [...live.reduce((m, s) => {
    const list = m.get(s.programme_id) ?? [];
    list.push(s);
    m.set(s.programme_id, list);
    return m;
  }, new Map<string, typeof live>()).values()];

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
                  <span title={BLOCK_PHASE_EXPLAINER[first.block_name.toLowerCase()]}>{first.block_name}</span>
                  {` · Week ${first.week_number}`}
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
                <h3 className="card-title">Sessions</h3>
                <div className="card flush" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
                  {block.map((s, index) => (
                    <div key={s.session_id}>
                      {index > 0 ? <div className="hair" /> : null}
                      <Link
                        href={`/gym/${s.session_id}`}
                        className="load-row"
                        style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
                      >
                        <div>
                          <span className="nm">{s.session_name}</span>
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

      {target ? (
        <div className="card">
          <h2 className="card-title">Nutrition targets</h2>
          <p className="import-sub">
            {target.md_specific ? (
              <>
                {/* Not the audit-B2 bug class: nutrition_targets.md_offset is an
                    authored rule ("apply on MD-2"), resolved for `today` server-side
                    by resolve_nutrition_targets — no fixture_id, nothing that could
                    drift against a different week's fixture the way sessions.md_offset
                    (schedule) can. */}
                Set for{' '}
                <span title={mdExplainer(target.md_offset) ?? undefined}>{mdLabel(target.md_offset) ?? 'today'}</span>.
              </>
            ) : (
              'Your standing target.'
            )}{' '}
            Guidance only &mdash; nothing to log here.
          </p>
          {/* PATTERN-S5 C7 (Isabella, 2026-09-13): whose numbers these are,
              on the face of the card — the club default is labelled as the
              club default, and an unscaled one says so. */}
          <p className="tiny" style={{ margin: '0 0 var(--sp-10)' }}>
            {targetProvenanceLine({ sourceScope: target.source_scope, hasWeighIn, you: true })}
          </p>
          {TARGET_ROWS.map((row) => {
            const raw = target[row.key];
            if (raw === null) return null;
            const value = row.litres ? (raw / 1000).toFixed(1) : raw;
            return (
              <div className="target-bar" key={row.key}>
                <div className="th">
                  <span className="k">{row.label}</span>
                  <span className="v num">
                    {value}
                    {row.unit}
                  </span>
                </div>
              </div>
            );
          })}
          <Link
            href="/programme/nutrition"
            className="load-row"
            style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
          >
            <span className="nm">Meal ideas</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
      ) : (
        <div className="card">
          <h2 className="card-title">Nutrition</h2>
          <p className="import-sub">Your coach hasn&rsquo;t set targets yet, but meal ideas are ready to browse.</p>
          <Link
            href="/programme/nutrition"
            className="load-row"
            style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
          >
            <span className="nm">Meal ideas</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
      )}
    </>
  );
}
