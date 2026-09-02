'use client';

import { CR10_ANCHORS, CR10_SCALE } from '@/lib/validation/training';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
};

/**
 * The ten-row CR10 rating list. screens/training-entry.md "Why not a slider":
 * ten stops across a mobile-width track give under 40px between centres, well
 * under the 48px tap target floor, so this is a vertical list tapped directly
 * instead — the classic Borg chart orientation, every anchor visible at once,
 * one tap, no drag.
 *
 * Real radio inputs so the keyboard, the screen reader and the browser's own
 * group semantics come free, same approach as ScaleInput. Tapping the row
 * already selected is a no-op, not a toggle: an athlete cannot accidentally
 * clear an answer by tapping twice.
 */
export function CR10List({ value, onChange }: Props) {
  return (
    <fieldset className="cr10">
      <legend className="visually-hidden">Session rating, 1 to 10</legend>
      {CR10_SCALE.map((step) => {
        const anchor = CR10_ANCHORS[step];
        const selected = value === step;
        return (
          <label className="cr10-row" key={step} data-selected={selected}>
            <input
              type="radio"
              name="rpe"
              value={step}
              checked={selected}
              onChange={() => onChange(step)}
            />
            <span className="cr10-n num" aria-hidden="true">
              {step}
            </span>
            <span className="cr10-a">
              {anchor ?? <span aria-hidden="true">·</span>}
            </span>
            <span className="cr10-tick" aria-hidden="true">
              {selected ? '✓' : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
