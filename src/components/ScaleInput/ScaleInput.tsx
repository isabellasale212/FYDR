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
        {/* "Not answered", in neutral --muted — ATH-ADULT-03 A6 (2026-09-11).
            It was amber (23c's "prompt rather than a status"), and five amber
            flags on an untouched form treated a normal starting state as a
            fault. The footer count is what says how far there is to go.
            Answered shows NOTHING here: the raised key already states the
            value, so "4 of 5" was a second copy of it competing with the
            footer's "N of 6" — the only "of N" left on the screen. */}
        {value === null ? <span className="sc-v un">Not answered</span> : null}
      </div>

      <div className="dots">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            className="opt"
            key={step}
            /* Only the chosen one, not every step up to it. A cumulative fill
               reads as a level being filled up; this is one answer out of five,
               and the design fills exactly the key you picked. */
            data-selected={value === step ? '' : undefined}
          >
            <input
              type="radio"
              name={name}
              id={`${name}-${step}`}
              value={step}
              checked={value === step}
              onChange={() => onChange(step)}
            />
            {/* The numeral itself, not a bare dot. Five unlabelled circles
                gave the reader nothing to aim at — which one is 3? — and the
                design draws numbered keys. aria-hidden because the real label
                below already says "3, Moderate" to a screen reader. */}
            <span aria-hidden="true" className="opt-n num">
              {step}
            </span>
            <label htmlFor={`${name}-${step}`} className="visually-hidden">
              {step}, {copy.words[step - 1]}
            </label>
          </span>
        ))}
      </div>

      {/* The ends carry their numeral — "1 · Very sore", "5 · No soreness" —
          as small chips (A5). The number is what ties the word to a key: an
          athlete reading "No soreness" under the right-hand end still had to
          work out that it meant 5. aria-hidden: the radio labels above already
          say "5, No soreness" to a screen reader, so this would read twice. */}
      <div className="sc-a" aria-hidden="true">
        <span>1 · {copy.low}</span>
        <span>5 · {copy.high}</span>
      </div>
    </fieldset>
  );
}
