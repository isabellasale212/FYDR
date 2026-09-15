import Link from 'next/link';
import type { ResolvedTarget } from '@/lib/queries/nutritionTargets';
import { targetProvenanceLine } from '@/lib/nutritionNoWeighIn';
import { mdExplainer, mdLabel } from '@/lib/format';

/* The day's nutrition targets, as one card (Isabella, 15 Sept 2026, mobile
 * queue #8: "the dashboard shows the day's nutrition targets below today's
 * schedule"). Lifted out of the Programme page, which drew this card inline,
 * so Today and Programme show the same numbers the same way — one home for
 * the rendering even though the figure now has two places on screen. The
 * numbers come from resolveTargetForDate for the day in question; the
 * provenance line (PATTERN-S5 C7) says whose numbers they are. Guidance only:
 * nothing to log (CLAUDE.md rule 8). */
const TARGET_ROWS = [
  { key: 'energy_kcal', label: 'Energy', unit: ' kcal', litres: false },
  { key: 'protein_g', label: 'Protein', unit: 'g', litres: false },
  { key: 'carbs_g', label: 'Carbohydrate', unit: 'g', litres: false },
  { key: 'fluid_ml', label: 'Fluid', unit: 'L', litres: true },
] as const;

type Props = {
  target: ResolvedTarget | null;
  hasWeighIn: boolean;
  /** "Nutrition targets" on Programme; "Fuelling today" on Today. */
  title: string;
  headingLevel?: 2 | 3;
};

export function NutritionTargetsCard({ target, hasWeighIn, title, headingLevel = 2 }: Props) {
  const H = headingLevel === 3 ? 'h3' : 'h2';
  const mealIdeas = (
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
  );
  if (!target) {
    return (
      <div className="card">
        <H className="card-title">{title}</H>
        <p className="import-sub">Your coach hasn&rsquo;t set targets yet, but meal ideas are ready to browse.</p>
        {mealIdeas}
      </div>
    );
  }
  return (
    <div className="card">
      <H className="card-title">{title}</H>
      <p className="import-sub">
        {target.md_specific ? (
          <>
            {/* Not the audit-B2 bug class: nutrition_targets.md_offset is an
                authored rule ("apply on MD-2"), resolved for the day server-side
                by resolve_nutrition_targets — no fixture_id, nothing that could
                drift against a different week's fixture the way sessions.md_offset
                (schedule) can. */}
            Set for <span title={mdExplainer(target.md_offset) ?? undefined}>{mdLabel(target.md_offset) ?? 'today'}</span>.
          </>
        ) : (
          'Your standing target.'
        )}{' '}
        Guidance only &mdash; nothing to log here.
      </p>
      {/* PATTERN-S5 C7 (Isabella, 2026-09-13): whose numbers these are, on the
          face of the card — the club default is labelled as the club default,
          and an unscaled one says so. */}
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
      {mealIdeas}
    </div>
  );
}
