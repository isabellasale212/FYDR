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
        <p className="import-sub">No targets set yet.</p>
        {mealIdeas}
      </div>
    );
  }
  /* BIGGER NUMBERS, LESS WORDING (Isabella, 16 Sept 2026, 1.1): the four
     figures as a 2×2 grid at --fs-28 with the unit beside, the label under;
     the only sentence left is PATTERN-S5 C7's provenance line (whose numbers
     these are — Isabella's own rule of 13 Sept), and a matchday-specific
     rule says which day it is for as a pill beside the title. The
     "guidance only — nothing to log" sentence is gone from the card: the
     card has nothing to log on it, which says the same. */
  return (
    <div className="card">
      <div className="fuel-head">
        <H className="card-title" style={{ margin: 0 }}>
          {title}
        </H>
        {target.md_specific ? (
          /* Not the audit-B2 bug class: nutrition_targets.md_offset is an
             authored rule ("apply on MD-2"), resolved for the day server-side
             by resolve_nutrition_targets — no fixture_id, nothing that could
             drift against a different week's fixture the way sessions.md_offset
             (schedule) can. */
          <span className="pill pill-accent num" title={mdExplainer(target.md_offset) ?? undefined}>
            {mdLabel(target.md_offset) ?? 'Today'}
          </span>
        ) : null}
      </div>
      <div className="fuel-grid">
        {TARGET_ROWS.map((row) => {
          const raw = target[row.key];
          if (raw === null) return null;
          const value = row.litres ? (raw / 1000).toFixed(1) : raw;
          return (
            <div className="fuel-cell" key={row.key}>
              <span className="fuel-v num">
                {value}
                <span className="fuel-u">{row.unit.trim()}</span>
              </span>
              <span className="fuel-k">{row.label}</span>
            </div>
          );
        })}
      </div>
      <p className="tiny fuel-prov">
        {targetProvenanceLine({ sourceScope: target.source_scope, hasWeighIn, you: true })}
      </p>
      {mealIdeas}
    </div>
  );
}
