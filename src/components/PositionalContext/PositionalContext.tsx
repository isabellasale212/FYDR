import { formatNumber } from '@/lib/format';
import { rangeBarMark } from '@/lib/nutritionRules';
import { POSITIONAL_MIN_N, type PositionalBand } from '@/lib/queries/positionalContext';

type Props = {
  /** Card heading, e.g. "Compared with their position". */
  title: string;
  /** The id the heading carries, so the card is aria-labelledby-able. */
  titleId: string;
  /** positionalScopeLine() output — the unit, the count and the active group
   *  scope, in one line. Never omit it: a band with no stated denominator is
   *  the thing audit finding S4 was about. */
  scopeLine: string;
  /** One sentence saying what these numbers ARE, in this domain's words. */
  /** Optional: several profile panels have had their explanatory paragraph
   *  removed at the club's request. The scopeLine above still says WHO is in
   *  the comparison, which is the part that changes what the chart means. */
  intro?: string;
  rows: readonly PositionalBand[];
};

/* The positional comparison, rendered. Shared by the three per-athlete domain
 * pages so "compared with their position" looks and means the same thing on all
 * of them.
 *
 * IT DRAWS A BAND AND A MARKER. IT NEVER DRAWS A LIST OF PEOPLE.
 * queries/positionalContext.ts's header sets out why at length; the short
 * version is that supabase/migrations/0016_leaderboards.sql already ruled
 * wellness and body composition off rankings by name, and a "top props by body
 * mass" table on a player profile would be that ruling routed around. This
 * component has no props through which a peer's name could reach it, which is
 * the cheapest way to keep it that way.
 *
 * THE THREE INK CHANNELS, and why they are these three. The screen already has
 * a settled vocabulary for "a range of where people are" versus "a rule
 * somebody drew" (see .nutr-range-band vs .nutr-target-bracket in base.css and
 * lib/nutritionRules.ts's header), and this card sits on pages that also show
 * the staff body-mass target range. So it deliberately borrows NEITHER:
 *
 *   the middle half  a filled, hueless wash (--track)      "where the unit is"
 *   the median       a solid neutral tick (--muted)        "the middle of it"
 *   this athlete     a filled accent dot (--accent)        "and here is them"
 *
 * Fill/stroke, hue and shape all differ, so the athlete's own marker never
 * reads as part of the aggregate, in colour or in greyscale — and neither the
 * wash nor the tick can be mistaken for the dashed staff bracket the Nutrition
 * page draws two cards up.
 *
 * THE AXIS IS THE EXISTING ONE. rangeBarMark() (lib/nutritionRules.ts) is
 * NUTRITION-SPEC §6's own formula — the band plus 40% of its own width as
 * headroom either side, so a marker outside the band still lands on screen —
 * and it is reused verbatim rather than re-derived, so a bar on this card and
 * a bar on /nutrition place a value identically.
 *
 * A DEGENERATE BAND IS NOT DRAWN. When q1 and q3 are equal (a whole unit
 * logging the same integer soreness score, say), the axis has zero width and
 * every mark would clamp to an edge — a bar that looks like a measurement and
 * is not one. The row keeps its numbers and drops the bar, with the reason. */
export function PositionalContext({ title, titleId, scopeLine, intro, rows }: Props) {
  return (
    <section className="card pp-card" aria-labelledby={titleId}>
      <div className="pp-card-head">
        <h2 className="card-title" id={titleId} style={{ margin: 0 }}>
          {title}
        </h2>
        <span className="num s">{scopeLine}</span>
      </div>
      {intro ? <p className="pc-intro">{intro}</p> : null}

      {rows.length === 0 ? (
        <p className="cap">Nothing on record to compare in this window.</p>
      ) : (
        rows.map((row) => <PositionalRow key={row.key} row={row} />)
      )}

      {/* States the rule rather than leaving suppressed rows looking broken —
        * the same move .pp-bench-suppressed makes on the Athleticism card. */}
      {rows.some((r) => r.suppressed) ? (
        <p className="pp-bench-suppressed">
          A median and a middle-half band are withheld where fewer than {POSITIONAL_MIN_N} players in
          the unit have a reading: with three or four, the median is one team-mate&apos;s exact number
          and anyone who knows the others can read off whose. This athlete&apos;s own value is still
          shown &mdash; it is not an aggregate of anybody.
        </p>
      ) : null}
    </section>
  );
}

function PositionalRow({ row }: { row: PositionalBand }) {
  const fmt = (v: number | null) => (v === null ? '—' : `${formatNumber(v, row.decimals)}${row.unit}`);
  const drawable =
    row.q1 !== null && row.q3 !== null && row.median !== null && row.q3 - row.q1 > 0;

  return (
    <div className="pc-row">
      <div className="pc-row-top">
        <span className="pc-row-name">{row.label}</span>
        <span className="num pc-row-value">{fmt(row.athleteValue)}</span>
      </div>

      {drawable && row.q1 !== null && row.q3 !== null ? (
        <div className="pc-track">
          <div
            className="pc-band"
            style={{
              left: `${rangeBarMark(row.q1, row.q1, row.q3)}%`,
              width: `${Math.max(
                0,
                rangeBarMark(row.q3, row.q1, row.q3) - rangeBarMark(row.q1, row.q1, row.q3),
              )}%`,
            }}
          />
          <div
            className="pc-median"
            style={{ left: `${rangeBarMark(row.median as number, row.q1, row.q3)}%` }}
          />
          {row.athleteValue !== null ? (
            <div
              className="pc-marker"
              style={{ left: `${rangeBarMark(row.athleteValue, row.q1, row.q3)}%` }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="pc-row-bottom">
        <span className="pc-row-band">
          {row.suppressed
            ? `Not enough players with a reading (n=${row.n}) — no median shown`
            : drawable
              ? `middle half ${fmt(row.q1)}–${fmt(row.q3)} · median ${fmt(row.median)}`
              : `median ${fmt(row.median)} — the middle half of the unit is a single value, so there is no band to draw`}
        </span>
        <span className="num pc-row-meta">n = {row.n}</span>
      </div>
    </div>
  );
}
