import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { Dial } from '@/components/Dial/Dial';
import { DomainChips } from '@/components/DomainChips/DomainChips';
import { PlayerProfileBio } from '@/components/PlayerProfileBio/PlayerProfileBio';
import { PlayerProfileFlags } from '@/components/PlayerProfileFlags/PlayerProfileFlags';
import { BodyWeightPanel } from '@/components/BodyWeightPanel/BodyWeightPanel';
import { SetAvailabilityFormCoach } from '@/components/SetAvailabilityFormCoach/SetAvailabilityFormCoach';
import { EntryCorrectionPanel } from '@/components/EntryCorrectionPanel/EntryCorrectionPanel';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import {
  fetchPlayerProfile,
  bandTone,
  bandIndex,
  BAND_SHADING_MIN_N,
  type Tone,
} from '@/lib/queries/playerProfile';
import { fetchBodyCompositionEntries } from '@/lib/queries/bodyComposition';
import { fetchTargetRangeHistory } from '@/lib/queries/bodyMassTargetRange';
import { massState } from '@/lib/nutritionRules';
import { fetchCurrentSeason } from '@/lib/queries/schedule';
import {
  fetchTrainingWithRevisions,
  fetchWellnessWithRevisions,
} from '@/lib/queries/entryRevisions';
import { addDays, enumLabel, formatDate, formatNumber, initials, ordinal, todayIso } from '@/lib/format';
import { DEFAULT_RANGE, clampPeriod, resolveRange, type RangeKey } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { availabilityStatus } from '@/lib/status';
import { requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';
import { ALL_STAFF, ATHLETE_BIO_EDIT, AVAILABILITY_EDIT, ENTRY_CORRECTION, INJURY_ACCESS, WEIGH_IN_EDIT, editableFlagDomains, hasAnyRole } from '@/lib/access';

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
/* The body-weight sparkline, plus — since migration 0060 — the STAFF-SET target
 * range drawn behind it.
 *
 * THE Y DOMAIN INCLUDES THE TARGET BOUNDS ON PURPOSE. Scaling to the weigh-ins
 * alone and then clipping the band to the viewBox would draw the band flush
 * against an edge whenever the athlete is outside their target, which is exactly
 * the case a coach opened this card to see, and it would make "20 kg out" and
 * "0.2 kg out" render identically. Folding the bounds into min/max costs a
 * slightly flatter line and buys a chart where the gap between where he has been
 * and where staff want him is the thing you can actually see.
 *
 * Returns the band as a rect in the same coordinate space rather than a path, so
 * the caller can style it as a STROKE (see the render site) instead of the fill
 * used for the history area. That distinction is load-bearing, not decorative —
 * lib/queries/bodyMassTargetRange.ts's header sets out why the descriptive band
 * (computeMassBand, where they have been) and the prescriptive one (this, where
 * staff want them) must never be drawn the same way. */
function sparklinePaths(
  history: { kg: number }[],
  target: { low: number; high: number } | null,
): { line: string; fill: string; band: { y: number; height: number } | null } | null {
  if (history.length < 2) return null;
  const values = history.map((h) => h.kg);
  const min = Math.min(...values, ...(target ? [target.low] : []));
  const max = Math.max(...values, ...(target ? [target.high] : []));
  const span = max - min;
  const y = (kg: number) => 82 - (span === 0 ? 0.5 : (kg - min) / span) * 74;
  const points = history.map((h, i) => ({
    x: (i / (history.length - 1)) * 600,
    y: y(h.kg), // 4px top/bottom margin inside the 90-tall viewBox
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const fill = `${line} L${last?.x.toFixed(1)} 90 L${first?.x.toFixed(1)} 90 Z`;
  const band = target
    ? { y: y(target.high), height: Math.max(2, y(target.low) - y(target.high)) }
    : null;
  return { line, fill, band };
}

/* THE PERIOD CONTROL ON THIS PAGE IS PER-PANEL, NOT PAGE-WIDE.
 *
 * docs/screens/athlete-profile.md specs a PeriodSelector here, "applicable and
 * global". Global it is — one control in the header, one `?period=`, sticky
 * across screens like every other. But it does NOT re-scope every panel, and
 * pretending otherwise would have been the bug, for two independent reasons
 * that have nothing to do with each other:
 *
 *  1. THE ACWR DIAL MUST NOT MOVE. ACWR is defined as a trailing 7-day acute
 *     load over a trailing 28-day chronic load (ACWR_ACUTE_WINDOW_DAYS /
 *     ACWR_CHRONIC_WINDOW_DAYS, lib/acwr.ts). There is no season-long or
 *     all-time ACWR — widening the window would not widen the ratio, it would
 *     only change how many already-trailing ratios you were looking at, and
 *     the ONE number the dial shows would print identically at every period
 *     while appearing to have responded to the control.
 *
 *  2. THE CORRECTION PANEL'S 28 DAYS MUST NOT MOVE EITHER, for a completely
 *     different reason: it is a PERFORMANCE bound on a base-table read, not a
 *     view window. See CORRECTION_WINDOW_DAYS below, whose own comment already
 *     said so before this control existed.
 *
 * Rather than let either leak, both now carry a VISIBLE caption naming the
 * fixed window they really use, so a coach who has set the page to "Last 365
 * days" can see at a glance which two panels did not follow. An unlabelled
 * panel that ignores the control is worse than no control at all.
 *
 * `day` is offered but DISABLED with its reason, per this codebase's own rule
 * (docs/screens/analytics.md, "Illegal combinations are disabled with the
 * reason, not hidden"): both panels the control drives are trends — a
 * sparkline and a rolling band — and one day is one point, not a trend. */
const PROFILE_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];
const PROFILE_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'one day is one point, not a trend',
};

/* THIS SCREEN'S DEFAULT IS `season`, NOT DEFAULT_RANGE.
 *
 * DEFAULT_RANGE is `month` (28 days) and is right for most screens. It is wrong
 * here, and shipping it would have quietly destroyed the panel this control
 * exists to serve. The sparkline it drives read a hardcoded 120 days before
 * this control existed, and 120 days was not arbitrary: BODY MASS IS A SLOW
 * SIGNAL. It is watched for drift over months, and at 28 days a coach opening a
 * profile sees a near-flat line through three or four weigh-ins — technically
 * accurate, and useless. Most people never touch a default, so the default IS
 * the screen for almost everyone.
 *
 * `season` rather than a per-panel exception or a bespoke 120-day window: it is
 * the closest real option to the old 120 days, it is the unit a coach actually
 * thinks in for body composition ("since pre-season"), and it stays inside the
 * shared six keys instead of inventing a seventh that only this page knows how
 * to read.
 *
 * DEGRADES TO `month` WITH NO SEASON ROW, and the existing machinery already
 * does it: clampPeriod's own fallback is DEFAULT_RANGE, and PeriodSelector
 * renders "This season" ABSENT (not disabled) for a club that has not set one
 * up. So a club with no season silently gets 28 days and is never offered an
 * option that would resolve against a null season start.
 *
 * APPLIED ONLY WHEN NOTHING WAS EXPRESSED. resolvePeriod reports where the key
 * came from, and this substitution fires for `source: 'default'` alone — no
 * `?period=` on the URL AND no usable `fydr-period` cookie. A coach who has
 * picked a period anywhere in the app keeps it; only a first-time visitor, or
 * one who explicitly cleared the param, lands on `season`.
 *
 * docs/screens/athlete-profile.md said "Default last28". That line predates the
 * control existing — it was describing the 7:28 convention, not a chosen
 * default for a sparkline nobody could resize — and the doc has been corrected
 * rather than followed. */
const PROFILE_DEFAULT_PERIOD: RangeKey = 'season';

/** Below this many days, `season` is not a usable default and the screen falls
 *  back to DEFAULT_RANGE.
 *
 *  A club can legitimately have a current season that starts in the future
 *  (pre-season admin). resolveRange handles that deliberately and correctly by
 *  collapsing the window to a single day rather than returning an inverted
 *  `from > to`, which downstream would read as "no data" instead of "this has
 *  not started" — that behaviour is right and is left alone. But it means the
 *  screen default could land on a ONE-DAY window, on a screen whose own control
 *  disables `day` with the reason "one day is one point, not a trend". A
 *  default that resolves to something the control calls illegal is worth one
 *  guard.
 *
 *  Applies to the DEFAULT ONLY. A coach who explicitly picks "This season" in
 *  pre-season gets exactly that, because honouring a stated choice outranks
 *  second-guessing it, and the card captions state the real day count and
 *  weigh-in sample either way. */
const MIN_USEFUL_DEFAULT_DAYS = 7;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const { db, orgId, timezone, claims } = await requireStaff();
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(athleteId)) notFound();


  // Same gate as /squad, applied before any per-athlete query runs: a
  // direct link or a bookmark can reach this route without passing through
  // the roster page's own check. 01-roles-and-permissions.md (superseded) §1/§2 — an
  // individual athlete profile is named performance, wellness, load and
  // injury-availability detail, admin's clearest "cannot" case.
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

  const today = todayIso(timezone);

  /* URL first, sticky cookie second, DEFAULT_RANGE last — resolvePeriod. Then
   * clamped SERVER-SIDE as well as disabled in the control: the control alone
   * does not stop a hand-typed or bookmarked `?period=day`, and the query and
   * the control must never disagree about what rendered.
   *
   * fetchCurrentSeason, never fetchCurrentSeasonId — the `seasons_one_current`
   * index is partial (`where is_current and deleted_at is null`), so the
   * unfiltered lookup can legally see two rows and throw. starts_on is a
   * `date` column and is passed through as a plain YYYY-MM-DD string; it must
   * NOT go through dateInTz (CLAUDE.md rule 5 governs instants, not calendar
   * dates that are already date-typed). */
  const sp = await searchParams;
  const [requestedPeriod, season] = await Promise.all([
    resolvePeriod(sp),
    fetchCurrentSeason(db, orgId),
  ]);

  /* `source: 'default'` is resolvePeriod's way of saying "nobody expressed a
   * preference" — no `?period=`, and no usable cookie either. That, and only
   * that, is where this screen substitutes its own default (see
   * PROFILE_DEFAULT_PERIOD). Every other source — 'period', 'legacy-range',
   * 'legacy-days', 'cookie' — is a real choice and is honoured untouched, which
   * is what keeps a coach who picked "Last 7 days" on another screen from
   * having it silently widened back to a season here. */
  const expressed = requestedPeriod.source !== 'default';

  /* The pre-season guard (MIN_USEFUL_DEFAULT_DAYS). resolveRange is pure and
   * deterministic, so previewing the season window here and resolving it again
   * inside fetchPlayerProfile cannot disagree — `earliest` is irrelevant to
   * `season`, which anchors on starts_on alone. */
  const seasonPreviewDays =
    season !== null ? resolveRange('season', today, season.starts_on, null).days : 0;
  const screenDefault: RangeKey =
    season !== null && seasonPreviewDays >= MIN_USEFUL_DEFAULT_DAYS ? PROFILE_DEFAULT_PERIOD : DEFAULT_RANGE;

  const requestedKey = expressed ? requestedPeriod.key : screenDefault;
  const period = clampPeriod(requestedKey, {
    allowed: PROFILE_PERIODS,
    seasonAvailable: season !== null,
    // fallback is DEFAULT_RANGE ('month') — deliberately NOT
    // PROFILE_DEFAULT_PERIOD, which is the very value that can be illegal here.
  });

  /* Only a coach's OWN unavailable choice is worth a sentence. When the screen
   * default `season` is coerced because the club has no season row, that is not
   * something the reader asked for or can act on from inside a period control —
   * and PeriodSelector has already removed the option entirely rather than
   * showing it disabled, so there is nothing on screen to explain. Reporting it
   * would be noise about a decision they never made. */
  const coercedFromChoice = expressed ? period.coercedFrom : null;

  const profile = await fetchPlayerProfile(db, orgId, athleteId, timezone, {
    key: period.key,
    seasonStart: season?.starts_on ?? null,
  });
  if (!profile) notFound();

  // body_composition's own RLS (migration 0024) grants insert/update to
  // coach and medical only, same as the query functions this button calls —
  // gating the control on the same two roles means it never offers an
  // action RLS is just going to reject.
  /* body_composition and body_mass_target_ranges admit all five staff roles
     since 0066, so this was narrower than the policy behind it. */
  /* Two questions, not one. Reading a weigh-in is open to every staff role,
     because body mass is not injury data and §3.1 gives the athlete profile V or
     better in all five columns. WRITING one is the sport scientist, the S&C and
     the nutritionist (0073). This was a single flag gating both, so narrowing it
     wholesale would have taken the weigh-in HISTORY away from a coach. */
  const canSeeWeighIns = hasAnyRole(claims.roles, ALL_STAFF);
  const canLogWeighIn = hasAnyRole(claims.roles, WEIGH_IN_EDIT);
  const weighIns = canSeeWeighIns ? await fetchBodyCompositionEntries(db, orgId, athleteId) : [];
  /* The staff-set body-mass target range (migration 0060). Gated on the SAME two
   * roles for the same reason as the weigh-in controls above: body_mass_target_ranges
   * grants select, insert and update to coach and medical and to nobody else, so
   * asking for it as any other role returns an empty list anyway. This boolean only
   * saves the round trip.
   *
   * The role check is NOT what keeps this off the athlete's screen — this whole route
   * is (staff), and the table has no athlete select policy at all. Two independent
   * reasons, which is the point: client rule 2 says the athlete NEVER sees this, and a
   * rule that only one layer enforces is a rule one refactor away from being gone. */
  const targetRanges = canSeeWeighIns ? await fetchTargetRangeHistory(db, orgId, athleteId) : [];
  const liveTargetRange = targetRanges.find((r) => r.effective_to === null) ?? null;
  /* The comment here used to say availability_coach_insert_noninjury and
     availability_medical_insert "between them cover exactly coach and medical",
     which was true until 0068 added the sport scientist to the coach path. The
     union is three roles now, and the principle the old comment stated is the
     one being kept: never offer an action RLS would reject, and never withhold
     one it would allow. */
  const canSetAvailability = hasAnyRole(claims.roles, AVAILABILITY_EDIT);
  // One role only, for the same reason again: athletes_manage_update
  // (migration 0012) grants coach and admin, never medical — "medical reads
  // for context and does not edit the roster," that migration's own words.
  // Admin never reaches this page (hasAccess above is coach/medical only),
  // so this is coach-only in practice, offered only where RLS actually
  // allows the write. See PlayerProfileBio's own header for the rest.
  /* D-26: the medic edits biographical details too, and the sport scientist was
     refused here although the policy allowed it. Both fixed; see 0071. */
  const canEditBio = hasAnyRole(claims.roles, ATHLETE_BIO_EDIT);

  /* The coach-facing correction path the club asked for: "the athlete shouldnt be
   * able to edit an entry only the coach should be able to do it on the system —
   * show me exactly how they can do this and is this a feature in the system for
   * each player profile." It is, and this is where: one card per player profile.
   *
   * The client check and the server check are the same predicate again, after a
   * detour: 0058 narrowed the two RPCs to coach-or-medical, 0065 widened them to
   * all five staff roles with the five-role model, and 0075 settles them at the
   * sport scientist, the coach and the medic. `canCorrect` hides a control the
   * RPC would refuse anyway. CLAUDE.md §2 rule 2: the RPC is the authorisation,
   * this boolean is only the tidiness.
   *
   * 28 days, not the profile's other windows. Long enough that a coach reviewing a
   * block finds the entry they remember being wrong, short enough that the base-
   * table read behind it (see queries/entryRevisions.ts on why it must be the base
   * table and not the _current view) stays a small result set. A correction to an
   * older entry is still possible — it is just not reachable from this card, and
   * the card says which window it is showing rather than implying it is everything. */
  const CORRECTION_WINDOW_DAYS = 28;
  const correctionRange = { from: addDays(today, -(CORRECTION_WINDOW_DAYS - 1)), to: today };
  /* Was ALL_STAFF, because 0065 made all five staff roles count as staff inside
     revise_wellness_entry and revise_training_entry. Narrowed 2026-09-06: the
     S&C may raise a flag but may not edit a wellness entry or an RPE score, and
     the nutritionist's writes on this profile are bodyweight and the nutrition
     plan only. training_entries.rpe is what makes the training half an RPE
     question rather than a separate one.

     Migration 0075 narrows both RPCs to the same three roles, so this hides a
     control the database would refuse anyway -- which is the right order:
     the RPC is the authorisation, this is the tidiness. */
  const canCorrect = hasAnyRole(claims.roles, ENTRY_CORRECTION);
  /* No longer true for every reader, which is the point: this page is open to all
   * five staff roles and two of them now see the panel read-only. */
  const [wellnessRevisions, trainingRevisions] = await Promise.all([
    fetchWellnessWithRevisions(db, orgId, athleteId, correctionRange),
    fetchTrainingWithRevisions(db, orgId, athleteId, correctionRange),
  ]);

  const { athlete, athleticism, acwr, wellnessRating, headerWellness, programme, nutrition, bodyWeight } = profile;
  const spark = sparklinePaths(
    bodyWeight.history,
    liveTargetRange
      ? { low: liveTargetRange.target_low_kg, high: liveTargetRange.target_high_kg }
      : null,
  );
  /* Where the athlete sits against the STAFF target — not against their own trailing
   * band, which is a different question this card does not ask. massState reads only
   * low/high, so the two uses share one function and cannot drift apart in their
   * arithmetic; the WORDS differ ("above target" here, "trending above" in the
   * nutrition workspace) because the two bands mean different things. */
  const targetState =
    liveTargetRange && bodyWeight.latestKg !== null
      ? massState(bodyWeight.latestKg, {
          low: liveTargetRange.target_low_kg,
          high: liveTargetRange.target_high_kg,
        })
      : null;
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PeriodSelector
            value={period.key}
            allowed={PROFILE_PERIODS}
            reasons={PROFILE_PERIOD_REASONS}
            season={season}
            /* Sticky only when the coach actually chose this window. This
             * screen's default is `season` where DEFAULT_RANGE is `month`, and
             * the cookie is account-wide — without this, opening a profile once
             * would carry `season` to Analytics and everywhere else, a window
             * they never picked and could neither see the origin of nor undo.
             * An explicit choice (URL, cookie, or a click on this control) sets
             * `expressed` and still sticks everywhere, which is the behaviour
             * the period model was actually asked for.
             *
             * AND not when that choice was CLAMPED. `expressed` alone was the
             * wrong half of the test on its own: a coach arriving with a
             * perfectly good `day` cookie meets PROFILE_PERIODS, gets coerced to
             * `month`, and the write would push this screen's opinion back out
             * over their real preference. Same rule as periodSticky()
             * (lib/reportPeriod.server.ts) and /dashboard, which is where this
             * failure actually bites. */
            sticky={expressed && period.coercedFrom === null}
            ariaLabel="Period for the body weight and wellness trends"
          />
        </div>
      </div>

      {/* The scope sentence is gone at the club's request. The two facts it
          also carried are NOT the same thing and survive on their own: a
          clipped window and a coerced one both mean the data on screen is not
          the window that was asked for, and neither is visible anywhere else. */}
      {profile.range.clipped || coercedFromChoice !== null ? (
        <p className="cap" style={{ margin: '0 0 12px' }}>
          {profile.range.clipped ? 'Clipped to the two-year maximum this app reads in one window.' : ''}
          {coercedFromChoice !== null
            ? ` "${coercedFromChoice}" is not available on this screen, so ${profile.range.label.toLowerCase()} is shown instead.`
            : ''}
        </p>
      ) : null}

      <div className="pp-col">
        {programme ? (
          <div className="pp-banner">
            <div className="pp-banner-left">
              <span className="pp-banner-eyebrow">Development plan</span>
              <span className="pp-banner-title">{programme.name}</span>
            </div>
            <span className="num sub">
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
          <PlayerProfileBio
            orgId={orgId}
            athleteId={athlete.id}
            canEdit={canEditBio}
            backLink={
              <Link href="/squad" className="btn-ghost-pill">
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                  ‹
                </span>
                Squad
              </Link>
            }
            avatar={
              <div className="pp-avatar" aria-hidden="true">
                {initials(athlete)}
              </div>
            }
            nameBlock={
              <div className="pp-name-block">
                <span className="pp-name" id="pp-name">
                  {athlete.first_name} {athlete.last_name}
                </span>
                <Pill status={availabilityStatus(athlete.availability?.status ?? null)} />
              </div>
            }
            domainChips={<DomainChips athleteId={athlete.id} />}
            wellnessMini={
              <div className="pp-wellness-mini" aria-label="Today's wellness entry">
                <div>
                  <div className="v num">{headerWellness.pct !== null ? Math.round(headerWellness.pct) : EM_DASH}</div>
                  <div className="l">wellness</div>
                </div>
              </div>
            }
            availabilityLine={
              athlete.availability && athlete.availability.status !== 'available' ? (
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
              ) : null
            }
            ageDisplay={emDash(profile.age)}
            weightDisplay={bodyWeight.latestKg !== null ? `${formatNumber(bodyWeight.latestKg, 1)} kg` : EM_DASH}
            initialPosition={athlete.position}
            initialSquadNumber={athlete.squad_number}
            initialHeightCm={athlete.height_cm}
            initialDominantSide={athlete.dominant_side}
          />
        </section>

        <div className="pp-grid">
          <div className="pp-grid-col">
            {/* §5: Athleticism and Position benchmarks are one card. */}
            <section className="card pp-card" aria-labelledby="pp-athleticism-title">
              <div className="pp-card-head">
                <h2 className="card-title" id="pp-athleticism-title" style={{ margin: 0 }}>
                  Athleticism
                </h2>
                <span className="num s">
                  {athleticism.positionGroupName
                    ? `vs ${athleticism.positionGroupName} · ${athleticism.positionGroupSize} player${athleticism.positionGroupSize === 1 ? '' : 's'}`
                    : 'not in a positional group'}
                </span>
              </div>

              <div className="pp-athleticism-row">
                <Dial size={88} pct={athleticism.compositePct} tone={TONE_VAR[athleticism.band.tone]}>
                  <div>
                    <div className="num pp-dial-value">{athleticism.compositePct ?? EM_DASH}</div>
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
                {/* Only the empty case now. "The 5 measures behind the score"
                    counted the rows immediately underneath it, which the reader
                    can see; "no tests defined for this club" is the one thing
                    an empty list cannot say for itself. */}
                {athleticism.rows.length === 0 ? (
                  <p className="num s" style={{ margin: 0 }}>
                    no tests defined for this club
                  </p>
                ) : null}
              </div>

              {/* Light-theme handoff §7's suppression notice. Shown only when
                  at least one row actually had its tint withheld, and it says
                  the percentiles are unchanged because they are — the row
                  still shows its band label, its bar and its n. */}
              {athleticism.rows.some((r) => r.pct !== null && r.n < BAND_SHADING_MIN_N) ? (
                <p className="pp-bench-suppressed">
                  Row shading is off where fewer than {BAND_SHADING_MIN_N} players have a result — a
                  percentile against three team-mates shades further than it should. The percentiles
                  themselves are unchanged.
                </p>
              ) : null}

              {athleticism.rows.map((row) => (
                <div
                  className="pp-bench-row"
                  key={row.testDefinitionId}
                  data-band={
                    row.pct !== null && row.n >= BAND_SHADING_MIN_N ? bandIndex(row.pct) : undefined
                  }
                >
                  <div className="pp-bench-top">
                    <span className="pp-bench-name">{row.name}</span>
                    <span className="num pp-bench-value">
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
                    <span className="num pp-bench-meta">
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
              {/* §3.2 New injury is VC for all four injury roles, and /injuries/new
                  already admits them. The link was medic only. */}
              {hasAnyRole(claims.roles, INJURY_ACCESS) ? (
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
            {/* viewerIsMedical is wording, not authorisation (CLAUDE.md rule 2): a
                flag note is written into a column every coach in the club reads, so
                a clinician is told that before they type. */}
            <PlayerProfileFlags
              flags={profile.flags}
              orgId={orgId}
              userId={claims.userId}
              today={today}
              timezone={timezone}
              viewerIsMedical={claims.roles.includes('medic')}
              /* A list rather than a predicate: this card loops over its own
                 flags, so the answer differs per row and only the component
                 knows which row it is drawing -- but it is a Client Component,
                 and a function prop across that boundary is a runtime 500. */
              editableFlagDomains={editableFlagDomains(claims.roles)}
            />

            {/* CORRECTED. This comment used to read "id is the Wellness domain chip's
             * real destination ... no dedicated per-athlete wellness history page
             * exists anywhere in this app, so this on-page section is the real, whole
             * answer". Both halves are now out of date: the chip navigates to
             * /squad/[athleteId]/wellness, and that page IS the dedicated history the
             * note said did not exist. The id stays because the section is still
             * aria-labelled by it and an existing anchor is somebody's bookmark; this
             * summary stays because a coach scanning the profile wants ACWR and
             * readiness at a glance without a second navigation. The two are a summary
             * and its detail view, not a stand-in and a replacement. */}
            <section className="card pp-card" id="pp-wellness-title" aria-label="ACWR and wellness rating">
              <div className="pp-dials">
                <div className="pp-dial-col">
                  <p className="pp-dial-title pp-dial-col-head">ACWR</p>
                  {/* Names its own fixed windows, and now says they are fixed:
                    * the header's period control does not reach this dial and
                    * cannot, because ACWR IS the 7-over-28 ratio. */}
                  <p className="num pp-dial-window pp-dial-col-head">fixed · acute 7d over chronic 28d</p>
                  <div className="pp-big-dial">
                    <Dial size={116} pct={acwr.pct} tone={TONE_VAR[acwr.status.tone]}>
                      <div>
                        <div className="num pp-big-dial-value">{acwr.value !== null ? acwr.value.toFixed(2) : EM_DASH}</div>
                        <div className="pp-big-dial-unit">ratio</div>
                      </div>
                    </Dial>
                  </div>
                  <p className="pp-dial-status" style={{ color: TONE_TEXT_VAR[acwr.status.tone] }}>
                    {acwr.status.label}
                  </p>
                  <p className="num pp-dial-meta">
                    {acwr.flagRuleValue !== null
                      ? `flags above ${acwr.flagRuleValue.toFixed(2)}`
                      : 'no flag rule active'}
                    {' · '}n = {acwr.sessionsN} sessions
                  </p>
                </div>
                <div className="pp-dial-col">
                  <p className="pp-dial-title pp-dial-col-head">Wellness rating</p>
                  {/* THREE windows on this one card, and they are not the same
                    * — so each is named where it applies rather than one label
                    * being left to stand for all of them:
                    *   the MEAN  — trailing 28 days, capped (here)
                    *   the COUNT — the selected period (meta line below)
                    *   the BAND  — a 14-day rolling baseline (meta line below)
                    * The mean is capped because readiness is a fast signal and
                    * a dial collapses its window to one number; see
                    * queries/playerProfile.ts's header. */}
                  <p className="num pp-dial-window pp-dial-col-head">
                    mean readiness · last {wellnessRating.meanWindowDays} days
                  </p>
                  <div className="pp-big-dial">
                    <Dial size={116} pct={wellnessRating.meanPct} tone="var(--accent)">
                      <div>
                        <div className="num pp-big-dial-value">
                          {wellnessRating.meanPct !== null ? `${wellnessRating.meanPct}%` : EM_DASH}
                        </div>
                        <div className="pp-big-dial-unit">of 100</div>
                      </div>
                    </Dial>
                  </div>
                  <p className="pp-dial-status" style={{ color: TONE_TEXT_VAR[wellnessRating.status.tone] }}>
                    {wellnessRating.status.label}
                  </p>
                  <p className="num pp-dial-meta">
                    {wellnessRating.submittedN} of {wellnessRating.windowDays} days submitted ·{' '}
                    {wellnessRating.windowLabel.toLowerCase()}
                    {wellnessRating.meanWindowDays < wellnessRating.windowDays
                      ? ' — the count follows the period, the mean above does not'
                      : ''}
                    {' · '}status vs his own 14-day baseline
                  </p>
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
                  <p className="num pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.energy_kcal !== null && nutrition?.energy_kcal !== undefined ? formatNumber(nutrition.energy_kcal, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    kcal
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="num pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.protein_g !== null && nutrition?.protein_g !== undefined ? formatNumber(nutrition.protein_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    protein g
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="num pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.carbs_g !== null && nutrition?.carbs_g !== undefined ? formatNumber(nutrition.carbs_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    carbs g
                  </p>
                </div>
                <div className="pp-macro-tile">
                  <p className="num pp-macro-value" style={{ margin: 0 }}>
                    {nutrition?.fat_g !== null && nutrition?.fat_g !== undefined ? formatNumber(nutrition.fat_g, 0) : EM_DASH}
                  </p>
                  <p className="pp-macro-label" style={{ margin: 0 }}>
                    fat g
                  </p>
                </div>
              </div>
            </section>

            <section className="card pp-card" aria-labelledby="pp-weight-title">
              <div className="pp-weight-top">
                <div>
                  <h2 className="card-title" id="pp-weight-title">
                    Body weight
                  </h2>
                  {bodyWeight.latestKg !== null ? (
                    <p className="pp-weight-value num" style={{ margin: '2px 0 0' }}>
                      {formatNumber(bodyWeight.latestKg, 1)}
                      <span className="u"> kg</span>
                    </p>
                  ) : (
                    <p className="cap" style={{ marginTop: 8 }}>
                      No weigh-in recorded.
                    </p>
                  )}
                  {/* This note used to read "No target range on record." with no
                    * condition attached, because there was no column behind it.
                    * Migration 0060 gave it one, so it is now a real empty state OR a
                    * real range. It says "staff target" in words every time — this
                    * card also draws the athlete's own trend as an area fill, and a
                    * reader must never have to work out which band is which. */}
                  {liveTargetRange ? (
                    <p className="pp-weight-note">
                      <span className="pp-target-swatch" aria-hidden="true" /> Staff target{' '}
                      <span className="num">
                        {liveTargetRange.target_low_kg.toFixed(1)}–
                        {liveTargetRange.target_high_kg.toFixed(1)} kg
                      </span>
                      {targetState ? (
                        <>
                          {' · '}
                          <span
                            className={`pill ${
                              targetState === 'in_range'
                                ? 'pill-good'
                                : targetState === 'above'
                                  ? 'pill-warn'
                                  : 'pill-bad'
                            }`}
                          >
                            {targetState === 'in_range'
                              ? 'On target'
                              : targetState === 'above'
                                ? 'Above target'
                                : 'Below target'}
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="pp-weight-note">No staff target range set.</p>
                  )}
                  {liveTargetRange?.rationale ? (
                    <p className="pp-weight-note" style={{ marginTop: 2 }}>
                      {liveTargetRange.rationale}
                    </p>
                  ) : null}
                </div>
                {bodyWeight.deltaKg !== null && bodyWeight.deltaDays !== null ? (
                  <div className="pp-weight-right">
                    <p className="num pp-weight-trend" style={{ margin: 0 }}>
                      {bodyWeight.deltaKg === 0 ? '▬' : bodyWeight.deltaKg > 0 ? '▲' : '▼'}{' '}
                      {Math.abs(bodyWeight.deltaKg).toFixed(1)} kg · {bodyWeight.deltaDays}d
                    </p>
                  </div>
                ) : null}
              </div>

              {spark ? (
                <svg className="pp-sparkline" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
                  {/* TWO BANDS, ONE CHART — and they must never be confusable.
                    *
                    * The weigh-in history is a FILLED area in --accent2: soft, hueless
                    * of judgement, "here is the data". The staff target range is an
                    * unfilled DASHED BRACKET in --muted: a rule somebody drew, not a
                    * measurement. Fill-versus-stroke, solid-versus-dashed, and blue-
                    * versus-neutral are three independent channels, so the distinction
                    * survives greyscale and every common colour-vision deficiency —
                    * and the note above the chart names the target range in words as
                    * well, because a visual convention alone is not a label. */}
                  {spark.band ? (
                    <rect
                      x="0"
                      y={spark.band.y}
                      width="600"
                      height={spark.band.height}
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="1.2"
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  <path d={spark.fill} fill="rgb(var(--accent2-rgb) / 0.14)" />
                  <path d={spark.line} fill="none" stroke="var(--accent2)" strokeWidth="2.4" strokeLinejoin="round" />
                </svg>
              ) : null}
              {/* The sparkline's window was a silent, hardcoded 120 days. It is
                * now whatever the header control says, and the line says which
                * — with the real sample behind it, because a wide window with
                * four weigh-ins in it is not the trend it looks like. */}
              <p className="cap" style={{ marginTop: 6 }}>
                {profile.range.label.toLowerCase()} · {bodyWeight.history.length} weigh-in
                {bodyWeight.history.length === 1 ? '' : 's'} in this window
                {bodyWeight.history.length < 2 ? ' — not enough for a trend line' : ''}
                {spark?.band
                  ? ' · solid line and fill are logged weigh-ins, the dashed bracket is the staff target range'
                  : ''}
              </p>

              <BodyWeightPanel
                orgId={orgId}
                athleteId={athleteId}
                userId={claims.userId}
                timezone={timezone}
                entries={weighIns}
                canLog={canLogWeighIn}
                targetRanges={targetRanges}
              />
            </section>
          </div>
        </div>

        {/* Full width, below the two-column grid rather than inside it: these are
          * wide tables with a per-row expansion, and half a grid column would force
          * either a horizontal scroll on every row or a truncated history. Placed
          * above the admin-only subject-access block so the last thing a coach sees
          * on the page is their own tool, not a compliance one. */}
        {/* Captioned, not moved. CORRECTION_WINDOW_DAYS is a performance bound
          * on a base-table read (see its own comment above), so the header's
          * period control deliberately does not reach it — and a coach who has
          * set the page to a year must be told that, or a correction they
          * cannot find here reads as an entry that does not exist. */}
        <p className="cap" style={{ margin: '0 0 -6px' }}>
          Entry corrections cover a fixed {CORRECTION_WINDOW_DAYS} days ({formatDate(correctionRange.from, timezone)}{' '}
          to {formatDate(correctionRange.to, timezone)}) and do not follow the period control &mdash; it is a
          bound on how much of the entry base table this card reads, not a view window. An older entry is
          still correctable, just not from here.
        </p>

        <EntryCorrectionPanel
          athleteId={athlete.id}
          athleteFirstName={athlete.first_name}
          timezone={timezone}
          canCorrect={canCorrect}
          wellness={wellnessRevisions}
          training={trainingRevisions}
        />

        {claims.roles.includes('sport_scientist') ? (
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
