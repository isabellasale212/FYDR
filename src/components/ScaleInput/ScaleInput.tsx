'use client';

import { SCALE_COPY, type WellnessScale } from '@/lib/validation/wellness';

type Props = {
  name: WellnessScale;
  value: number | null;
  onChange: (value: number) => void;
};

/**
 * One 1 to 5 scale. Five dots, one thumb, labelled at both ends.
 *
 * Both end labels are always shown, because 5 = no soreness is
 * counter-intuitive and an unlabelled scale is a guess. The word is larger than
 * the numeral for the same reason. Real radio inputs, so the keyboard, the
 * screen reader and the browser's own group semantics come free; the dot is the
 * label, at a 44px target.
 *
 * ATHLETE-APP-SPEC.md §6 adds a "+ Where?" chip on soreness for body-site
 * marking. wellness_entries.soreness_areas is a real column and this app's
 * own wellness-entry.md even anticipates a chip-grid fallback for exactly
 * this case (no silhouette artwork to mark a body outline against), but
 * the spec itself lists that picker's contents under "Not designed" — left
 * out here rather than shipping a chip that opens onto nothing.
 */
export function ScaleInput({ name, value, onChange }: Props) {
  const copy = SCALE_COPY[name];

  return (
    <fieldset className="sc">
      <div className="sc-h">
        <legend className="sc-l">{copy.label}</legend>
        {value === null ? (
          <span className="sc-v un">Not set</span>
        ) : (
          <span className="sc-v">
            {copy.words[value - 1]} <span className="n num">· {value}</span>
          </span>
        )}
      </div>

      <div className="dots">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            className="opt"
            key={step}
            data-filled={value !== null && step <= value}
          >
            <input
              type="radio"
              name={name}
              id={`${name}-${step}`}
              value={step}
              checked={value === step}
              onChange={() => onChange(step)}
            />
            <span aria-hidden="true" />
            <label htmlFor={`${name}-${step}`} className="visually-hidden">
              {step}, {copy.words[step - 1]}
            </label>
          </span>
        ))}
      </div>

      <div className="sc-a">
        <span>{copy.low}</span>
        <span>{copy.high}</span>
      </div>
    </fieldset>
  );
}
