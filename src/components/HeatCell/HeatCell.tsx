import type { Band } from '@/lib/queries/trainingReport';

/* screens/training-report.md's HeatCell, simplified: one alpha table shared by
 * both themes (a hue layered over transparent, which adapts reasonably to
 * either surface without the spec's own separately-tuned and
 * contrast-verified light/dark tables — a real, documented gap against the
 * spec's accessibility care, noted in trainingReport.ts's header). */

const TINT_ALPHA = [0.08, 0.18, 0.3, 0.44, 0.6];
const HUES: Record<'accent' | 'pink' | 'green', string> = {
  accent: '18, 70, 200',
  pink: '214, 51, 108',
  green: '0, 123, 63',
};

type Props = {
  value: number | null;
  band: Band;
  hue: 'accent' | 'pink' | 'green';
  fill?: 'tint' | 'solid';
  unit?: string;
  label: string;
};

export function HeatCell({ value, band, hue, fill = 'tint', unit = '', label }: Props) {
  if (value === null) {
    return (
      <td className="r mono tiny" aria-label={`${label}: no data`} style={{ color: 'var(--faint)' }}>
        &ndash;
      </td>
    );
  }

  if (band === null) {
    return (
      <td className="r mono" aria-label={`${label}: ${value}${unit}`}>
        {value}
        {unit}
      </td>
    );
  }

  const rgb = HUES[hue];
  const solidDark = ['rgba(0,123,63,0.25)', 'rgba(0,123,63,0.45)', 'rgba(0,123,63,0.65)', 'rgba(0,123,63,0.85)', '#007b3f'];

  const style =
    fill === 'solid'
      ? { backgroundColor: solidDark[band], color: band >= 3 ? '#e9ffef' : 'var(--text)' }
      : { backgroundColor: `rgba(${rgb}, ${TINT_ALPHA[band]})`, color: 'var(--text)' };

  return (
    <td
      className="r mono"
      style={{ ...style, borderRadius: 6 }}
      aria-label={`${label}: ${value}${unit}. Band ${band + 1} of 5, versus squad, last 28 days.`}
      title={`Band ${band + 1} of 5`}
    >
      {value}
      {unit}
    </td>
  );
}
