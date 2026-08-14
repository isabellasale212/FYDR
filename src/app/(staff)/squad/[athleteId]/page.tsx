import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { Dial } from '@/components/Dial/Dial';
import { DomainChips } from '@/components/DomainChips/DomainChips';
import { PlayerProfileFlags } from '@/components/PlayerProfileFlags/PlayerProfileFlags';
import { BodyWeightPanel } from '@/components/BodyWeightPanel/BodyWeightPanel';
import { SetAvailabilityFormCoach } from '@/components/SetAvailabilityFormCoach/SetAvailabilityFormCoach';
import { fetchPlayerProfile, bandTone, type Tone } from '@/lib/queries/playerProfile';
import { fetchBodyCompositionEntries } from '@/lib/queries/bodyComposition';
import { enumLabel, formatDate, formatNumber, initials, ordinal, todayIso } from '@/lib/format';
import { availabilityStatus } from '@/lib/status';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Athlete · Fydr' };

/* PLAYER-PROFILE-SPEC.md, built to spec section by section — see
 * lib/queries/playerProfile.ts's own header for what is real data and what
 * is an honest, documented cut. Four things the brief flagged explicitly:
 *
 *   §2 — every two-column grid on this page uses minmax(0, 1fr), never
 *   bare 1fr: with .mono's tabular numbers throughout, a bare 1fr lets that
 *   content set the column's minimum width and the grid overflows. Athleticism
 *   and Position benchmarks are one card below, not two — the composite score
 *   is computed from the benchmark rows, so splitting them would separate a
 *   number from its own working.
 *
 *   §5 — the dial geometry lives in one place, components/Dial/Dial.tsx, not
 *   copied three times. offset = round(251 × (1 − pct/100)), verbatim.
 *
 *   §9 — ACWR is a ratio, not a percentage. Plotting it raw against an
 *   unbounded scale would mean the ring never means the same thing twice; it
 *   is instead plotted as a percentage of the shared display band's top
 *   (lib/acwr.ts's ACWR_BAND_HIGH, 1.5), so a full ring always means "at
 *   the top of the band" and the ACWR and Wellness dials share one visual
 *   scale. The centre text still shows the real, unscaled ratio. The
 *   "flags above X" meta line quotes the org's real active threshold row
 *   (acwr.flagRuleValue), never a hardcoded number — the audit (S1) caught
 *   this page claiming 1.50 while the seeded rule fires above 1.30.
 *
 *   §11 — a missing value is an em dash, never a zero, everywhere on this
 *   page (this file's own EM_DASH/emDash(), not lib/format.ts's usual
 *   BLANK — see that constant's own comment below for why). Every
 *   aggregate states its sample
 *   (n=, "of 7 days", "players"). Benchmark percentiles are computed
 *   against the athlete's real positional group, never the whole squad.
 *   Nutrition is read-only here, and says so. ACWR's dial ring is the
 *   shared band top (1.5), not an arbitrary maximum. */

const TONE_VAR: Record<Tone, string> = {
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  faint: 'var(--faint)',
};
const TONE_TEXT_VAR: Record<Tone, string> = {
  accent: 'var(--accent-text)',
  accent2: 'var(--accent2-text)',
  warn: 'var(--warn-text)',
  bad: 'var(--bad-text)',
  faint: 'var(--faint)',
};

const HAND_LABEL: Record<string, string> = { left: 'L', right: 'R', both: 'A' };

/* §11 rule 1, verbatim: "a missing value is an em dash, never a zero." This
 * page's own missing-value glyph, deliberately not this app's usual
 * lib/format.ts BLANK (a middle dot, chosen elsewhere for the athlete
 * mockup this app was built from) — the brief singled out "em dash" by
 * name as a rule to preserve exactly, so this page follows the spec's own
 * glyph rather than folding it into the app-wide convention. */
const EM_DASH = '—';
function emDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  return String(value);
}

/** §10's sparkline is "real SVG, not a placeholder": the same fill-under-
 *  line shape the spec's own markup shows, built from the athlete's real
 *  body_composition history rather than the spec's literal example points.
 *  A flat line at mid-height when every reading is identical (n≥2, zero
 *  spread) rather than a division by zero. */
function sparklinePaths(history: { kg: number }[]): { line: string; fill: string } | null {
  if (history.length < 2) return null;
  const values = history.map((h) => h.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * 600;
    const norm = span === 0 ? 0.5 : (h.kg - min) / span;
    const y = 82 - norm * 74; // 4px top/bottom margin inside the 90-tall viewBox
    return { x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const fill = `${line} L${last?.x.toFixed(1)} 90 L${first?.x.toFixed(1)} 90 Z`;
  return { line, fill };
}

export default async function AthletePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const { db, orgId, orgName, timezone, claims } = await requireStaff();

  // Same gate as /squad, applied before any per-athlete query runs: a
  // direct link or a bookmark can reach this route without passing through
  // the roster page's own check. 01-roles-and-permissions.md §1/§2 — an
  // individual athlete profile is named performance, wellness, load and
  // injury-availability detail, admin's clearest "cannot" case.
  const hasAccess = claims.roles.includes('coach') || claims.roles.includes('medical');
  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">Squad · {orgName}</p>
            <h1>Athlete</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            An athlete profile is named performance, wellness, load and injury-availability
            detail. Admin manages the club and does not read athlete performance data
            &mdash; see 01-roles-and-permissions.md §1.
          </p>
        </div>
      </>
    );
  }

  const today = todayIso(timezone);

  const profile = await fetchPlayerProfile(db, orgId, athleteId, timezone);
  if (!profile) notFound();

  // body_composition's own RLS (migration 0024) grants insert/update to
  // coach and medical only, same as the query functions this button calls —
  // gating the control on the same two roles means it never offers an
  // action RLS is just going to reject.
  const canLogWeighIn = claims.roles.includes('coach') || claims.roles.includes('medical');
  const weighIns = canLogWeighIn ? await fetchBodyCompositionEntries(db, orgId, athleteId) : [];
  // Same two roles, for the same reason: availability_coach_insert_noninjury
  // (0041) and availability_medical_insert (0012) between them cover exactly
  // coach and medical, so this never offers an action RLS would reject.
  const canSetAvailability = claims.roles.includes('coach') || claims.roles.includes('medical');

  const { athlete, athleticism, acwr, wellnessRating, headerWellness, programme, nutrition, bodyWeight } = profile;
  const spark = sparklinePaths(bodyWeight.history);
  const openInjuries = profile.injuries.filter((i) => i.status !== 'closed');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/squad">Squad overview</Link> · Athlete
          </p>
          <h1>
            {athlete.first_name} {athlete.last_name}
          </h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="pp-col">
        {programme ? (
          <div className="pp-banner">
            <div className="pp-banner-left">
              <span className="pp-banner-eyebrow">Development plan</span>
              <span className="pp-banner-title">{programme.name}</span>
            </div>
            <span className="mono sub">
              {programme.weekTotal !== null
                ? `week ${programme.weekNow} of ${programme.weekTotal}`
                : `week ${programme.weekNow}`}
              {programme.endsOn ? ` · ends ${formatDate(programme.endsOn, timezone)}` : ''}
            </span>
            <Link href={`/programmes/${programme.programmeId}`} className="btn-ghost-pill accent">
              Change plan
            </Link>
          </div>
        ) : null}

        <section className="card pp-card" aria-labelledby="pp-name">
          <div className="pp-header-top">
            <Link href="/squad" className="btn-ghost-pill">
              <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                ‹
              </span>
              Squad
            </Link>
            <div className="pp-avatar" aria-hidden="true">
              {initials(athlete)}
            </div>
            <div className="pp-name-block">
              <span className="pp-name" id="pp-name">
                {athlete.first_name} {athlete.last_name}
              </span>
              <Pill status={availabilityStatus(athlete.availability?.status ?? null)} />
            </div>
            <DomainChips />
            <button type="button" className="btn-ghost-pill" disabled aria-disabled="true" title="Staff-side profile editing isn't available yet.">
              Edit
            </button>
            <div className="pp-wellness-mini" aria-label="Today's wellness entry">
              <div>
                <div className="v mono">{headerWellness.pct !== null ? Math.round(headerWellness.pct) : EM_DASH}</div>
                <div className="l">wellness</div>
              </div>
            </div>
          </div>

          {athlete.availability && athlete.availability.status !== 'available' ? (
            <p className="sub" style={{ margin: '2px 0 0' }}>
              {/* Restrictions shown ahead of reason_category, same priority order and
               * same enumLabel-joined format as AvailabilityBanner.tsx uses for the
               * athlete's own Today page (integration-audit majors, Bug 2). Before this,
               * this page rendered only reason_category + note and never the restriction
               * list at all, even for real athletes with real restrictions (e.g. "no
               * contact / no scrummaging / running 80% volume / gym lower modified") —
               * a coach had to open the separate linked injury record to see what the
               * athlete's own app already showed them front and centre. */}
              {athlete.availability.restrictions && athlete.availability.restrictions.length > 0
                ? athlete.availability.restrictions.map(enumLabel).join(' · ')
                : athlete.availability.reason_category
                  ? enumLabel(athlete.availability.reason_category)
                  : 'No reason recorded'}
              {athlete.availability.note ? ` — ${athlete.availability.note}` : ''}
            </p>
          ) : null}

          <div className="pp-detail-row">
            <div className="pp-detail-cell">
              <div className="l">Position</div>
              <div className="v">{emDash(athlete.position)}</div>
            </div>
            <div className="pp-detail-cell">
              <div className="l">Jersey</div>
              <div className="v">{athlete.squad_number !== null ? `#${athlete.squad_number}` : EM_DASH}</div>
            </div>
            <div className="pp-detail-cell">
              <div className="l">Height</div>
              <div className="v">{athlete.height_cm !== null ? `${athlete.height_cm} cm` : EM_DASH}</div>
            </div>
            <div className="pp-detail-cell">
              <div className="l">Age</div>
              <div className="v">{emDash(profile.age)}</div>
            </div>
            <div className="pp-detail-cell">
              <div className="l">Hand</div>
              <div className="v">{athlete.dominant_side ? (HAND_LABEL[athlete.dominant_side] ?? EM_DASH) : EM_DASH}</div>
            </div>
            <div className="pp-detail-cell">
              <div className="l">Weight</div>
              <div className="v">{bodyWeight.latestKg !== null ? `${formatNumber(bodyWeight.latestKg, 1)} kg` : EM_DASH}</div>
            </div>
          </div>
        </section>

        <div className="pp-grid">
          <div className="pp-grid-col">
            {/* §5: Athleticism and Position benchmarks are one card. */}
            <section className="card pp-card" aria-labelledby="pp-athleticism-title">
              <div className="pp-card-head">
                <h2 className="card-title" id="pp-athleticism-title" style={{ margin: 0 }}>
                  Athleticism
                </h2>
                <span className="mono s">
                  {athleticism.positionGroupName
                    ? `vs ${athleticism.positionGroupName} · ${athleticism.positionGroupSize} player${athleticism.positionGroupSize === 1 ? '' : 's'}`
                    : 'not in a positional group'}
                </span>
              </div>

              <div className="pp-athleticism-row">
                <Dial size={88} pct={athleticism.compositePct} tone={TONE_VAR[athleticism.band.tone]}>
                  <div>
                    <div className="mono pp-dial-value">{athleticism.compositePct ?? EM_DASH}</div>
                    <div className="pp-dial-unit">athleticism</div>
                  </div>
                </Dial>
                <div>
                  <p className="pp-athleticism-band" style={{ color: TONE_TEXT_VAR[athleticism.band.tone], margin: 0 }}>
                    {athleticism.band.label}
                  </p>
                  <p className="pp-athleticism-desc">
                    Composite of the position-relative percentiles below.
                    {athleticism.positionGroupName ? ` 50 ≈ average for a ${athlete.position ?? athleticism.positionGroupName} player.` : ''}
                  </p>
                </div>
              </div>

              <div className="pp-bench-head">
                <p className="t" style={{ margin: 0 }}>
                  Position benchmarks
                </p>
                <p className="mono s" style={{ margin: 0 }}>
                  {athleticism.rows.length === 0
                    ? 'no tests defined for this club'
                    : `the ${athleticism.rows.length} measure${athleticism.rows.length === 1 ? '' : 's'} behind the score`}
                </p>
              </div>

              {athleticism.rows.map((row) => (
                <div className="pp-bench-row" key={row.testDefinitionId}>
                  <div className="pp-bench-top">
                    <span className="pp-bench-name">{row.name}</span>
                    <span className="mono pp-bench-value">
                      {row.value !== null ? `${formatNumber(row.value, row.decimals)} ${row.unit}` : EM_DASH}
                    </span>
                  </div>
                  <div className="pp-bench-bar">
                    <div
                      className="pp-bench-fill"
                      style={{
                        width: `${row.pct ?? 0}%`,
                        background: TONE_VAR[row.pct !== null ? bandTone(row.pct) : 'faint'],
                      }}
                    />
                  </div>
                  <div className="pp-bench-bottom">
                    <span
                      className="pp-bench-band"
                      style={{ color: row.pct !== null ? TONE_TEXT_VAR[bandTone(row.pct)] : 'var(--faint)' }}
                    >
                      {row.pct !== null ? `${ordinal(row.pct)} percentile` : 'No data'}
                    </span>
                    <span className="mono pp-bench-meta">
                      {row.n > 0
                        ? `median ${formatNumber(row.median, row.decimals)} · best ${formatNumber(row.best, row.decimals)} · n=${row.n}`
                        : 'n=0'}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="card pp-card" aria-labelledby="pp-sc-title">
              <h2 className="card-title" id="pp-sc-title">
                S&amp;C history log
              </h2>
              <p className="import-sub" style={{ margin: '4px 0 0' }}>
                Injury history and training adaptations — a reminder of how to adjust this athlete&apos;s
                sessions.
              </p>
              <EmptyState
                headingLevel={3}
                title="No adaptation log entries"
                body="Adaptation notes are planned but not available yet. Nothing has been recorded here."
              />
            </section>

            <section className="card pp-card pp-injuries-card" aria-labelledby="pp-injuries-title">
              <div>
                <h2 className="card-title" id="pp-injuries-title">
                  Injuries
                </h2>
                {profile.injuries.length === 0 ? (
                  <p className="import-sub" style={{ margin: '4px 0 0' }}>
                    No injuries on record.
                  </p>
                ) : (
                  <>
                    <p className="import-sub" style={{ margin: '4px 0 0' }}>
                      {openInjuries.length} open of {profile.injuries.length} on record.
                    </p>
                    <div className="pp-injury-list">
                      {profile.injuries.map((injury) => (
                        <p className="sub" key={injury.id} style={{ margin: 0 }}>
                          <b className="nm" style={{ fontSize: 13 }}>
                            {enumLabel(injury.body_area)}
                          </b>
                          {injury.side ? ` (${enumLabel(injury.side)})` : ''} — {enumLabel(injury.status)}
                          {injury.actual_return
                            ? `, returned ${formatDate(injury.actual_return, timezone)}`
                            : injury.expected_return
                              ? `, back ${formatDate(injury.expected_return, timezone)}`
                              : ''}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {claims.roles.includes('medical') ? (
                <Link href="/injuries/new" className="btn-ghost-pill" style={{ padding: '8px 16px' }}>
                  + Log injury
                </Link>
              ) : null}
            </section>

            {/* ADR-008 / migration 0041: non-injury availability, reachable by
             * coach or medical, without an injury record existing at all —
             * the entry point the audit found missing (gameplan 2.6). Gated
             * on the same two roles as the weigh-in button above, since
             * availability_coach_insert_noninjury (0041) and
             * availability_medical_insert (0012) are exactly those two roles. */}
            {canSetAvailability ? (
              <section className="card pp-card" aria-labelledby="pp-availability-title">
                <h2 className="card-title" id="pp-availability-title">
                  Availability
                </h2>
                <SetAvailabilityFormCoach orgId={orgId} userId={claims.userId} athleteId={athlete.id} />
              </section>
            ) : null}
          </div>

          <div className="pp-grid-col">
            <PlayerProfileFlags flags={profile.flags} orgId={orgId} userId={claims.userId} today={today} timezone={timezone} />

            <section className="card pp-card" aria-label="ACWR and wellness rating">
              <div className="pp-dials">
                <div className="pp-dial-col">
                  <p className="pp-dial-title pp-dial-col-head">ACWR</p>
                  <p className="mono pp-dial-window pp-dial-col-head">acute 7d over chronic 28d</p>
                  <div className="pp-big-dial">
                    <Dial size={116} pct={acwr.pct} tone={TONE_VAR[acwr.status.tone]}>
                      <div>
                        <div className="mono pp-big-dial-value">{acwr.value !== null ? acwr.value.toFixed(2) : EM_DASH}</div>
                        <div className="pp-big-dial-unit">ratio</div>
                      </div>
                    </Dial>
                  </div>
                  <p className="pp-dial-status" style={{ color: TONE_TEXT_VAR[acwr.status.tone] }}>
                    {acwr.status.label}
                  </p>
                  <p className="mono pp-dial-meta">
                    {acwr.flagRuleValue !== null
                      ? `flags above ${acwr.flagRuleValue.toFixed(2)}`
                      : 'no flag rule active'}
                    {' · '}n = {acwr.sessionsN} sessions
                  </p>
                </div>
                <div className="pp-dial-col">
                  <p className="pp-dial-title pp-dial-col-head">Wellness rating</p>
                  <p className="mono pp-dial-window pp-dial-col-head">mean readiness, last 7 days</p>
                  <div className="pp-big-dial">
                    <Dial size={116} pct={wellnessRating.meanPct} tone="var(--accent)">
                      <div>
                        <div className="mono pp-big-dial-value">
                          {wellnessRating.meanPct !== null ? `${wellnessRating.meanPct}%` : EM_DASH}
                        </div>
                        <div className="pp-big-dial-unit">of 100</div>
                      </div>
                    </Dial>
                  </div>
                  <p className="pp-dial-status" style={{ color: TONE_TEXT_VAR[wellnessRating.status.tone] }}>
                    {wellnessRating.status.label}
                  </p>
                  <p className="mono pp-dial-meta">{wellnessRating.submittedN} of 7 days submitted</p>
                </div>
              </div>
            </section>

            <section className="card pp-card" aria-labelledby="pp-goals-title">
              <div className="pp-card-row">
                <h2 className="card-title" id="pp-goals-title">
                  Goals
                </h2>
                {programme ? (
                  <Link href={`/programmes/${programme.programmeId}`} className="pp-link">
                    Edit ›
                  </Link>
                ) : null}
              </div>
              <p className="pp-goal-line">
                <span className="pp-goal-label">Goal:</span> {programme?.goal ?? 'No active programme goal on record.'}
              </p>
              <p className="pp-goal-note">
                No coaching note on record — only the programme&apos;s own stated goal is shown
                here.
              </p>
            </section>

            <section className="card pp-card" aria-labelledby="pp-nutrition-title">
              <div className="pp-card-row">
                <h2 className="card-title" id="pp-nutrition-title">
                  Nutrition plan
                </h2>
                <Link href="/nutrition" className="btn-ghost">
                  Edit
                </Link>
              </div>
              <div className="pp-macro-tiles">
                <div className="pp-macro-tile">
                  <p className="mono pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.energy_kcal !== null && nutrition?.energy_kcal !== undefined ? formatNumber(nutrition.energy_kcal, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    kcal
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="mono pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.protein_g !== null && nutrition?.protein_g !== undefined ? formatNumber(nutrition.protein_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    protein g
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="mono pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.carbs_g !== null && nutrition?.carbs_g !== undefined ? formatNumber(nutrition.carbs_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    carbs g
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="mono pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.fat_g !== null && nutrition?.fat_g !== undefined ? formatNumber(nutrition.fat_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    fat g
                  </p>
                </div>
              </div>
              <p className="cap" style={{ marginTop: 14 }}>
                View only — plans are managed by the nutritionist.
              </p>
            </section>

            <section className="card pp-card" aria-labelledby="pp-weight-title">
              <div className="pp-weight-top">
                <div>
                  <h2 className="card-title" id="pp-weight-title">
                    Body weight
                  </h2>
                  {bodyWeight.latestKg !== null ? (
                    <p className="pp-weight-value mono" style={{ margin: '2px 0 0' }}>
                      {formatNumber(bodyWeight.latestKg, 1)}
                      <span className="u"> kg</span>
                    </p>
                  ) : (
                    <p className="cap" style={{ marginTop: 8 }}>
                      No weigh-in recorded.
                    </p>
                  )}
                  <p className="pp-weight-note">No target range on record.</p>
                </div>
                {bodyWeight.deltaKg !== null && bodyWeight.deltaDays !== null ? (
                  <div className="pp-weight-right">
                    <p className="mono pp-weight-trend" style={{ margin: 0 }}>
                      {bodyWeight.deltaKg === 0 ? '▬' : bodyWeight.deltaKg > 0 ? '▲' : '▼'}{' '}
                      {Math.abs(bodyWeight.deltaKg).toFixed(1)} kg · {bodyWeight.deltaDays}d
                    </p>
                  </div>
                ) : null}
              </div>

              {spark ? (
                <svg className="pp-sparkline" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
                  <path d={spark.fill} fill="rgb(var(--accent2-rgb) / 0.14)" />
                  <path d={spark.line} fill="none" stroke="var(--accent2)" strokeWidth="2.4" strokeLinejoin="round" />
                </svg>
              ) : null}

              <BodyWeightPanel
                orgId={orgId}
                athleteId={athleteId}
                userId={claims.userId}
                timezone={timezone}
                entries={weighIns}
                canLog={canLogWeighIn}
              />
            </section>
          </div>
        </div>

        {claims.roles.includes('admin') ? (
          <section className="card pp-card" aria-labelledby="sar-title">
            <h2 className="card-title" id="sar-title">
              Subject access request
            </h2>
            <p className="cap" style={{ marginBottom: 10 }}>
              Article 15, UK GDPR. Generates every row referencing {athlete.first_name} across every
              table, once medical has reviewed any clinical detail. Not part of the visual spec above —
              kept here because it is real, working compliance functionality with no other home on this
              page.
            </p>
            <form action={`/squad/${athleteId}/subject-access`} method="post">
              <button type="submit" className="btn-ghost">
                Generate subject access pack →
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </>
  );
}
