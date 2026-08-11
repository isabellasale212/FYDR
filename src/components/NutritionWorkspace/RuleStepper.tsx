'use client';

/* NUTRITION-SPEC.md §4's rule tile: a 10.5px uppercase label, a 32px/1fr/32px
 * stepper with the value centred in mono 20px/500 over a unit line, and a mono
 * 10.5px footnote. */

type Props = {
  label: string;
  value: number;
  displayValue?: string;
  unit: string;
  footnote: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function RuleStepper({ label, value, displayValue, unit, footnote, min, max, step, onChange, disabled }: Props) {
  const dec = (v: number) => Math.round((v - step) * 100) / 100;
  const inc = (v: number) => Math.round((v + step) * 100) / 100;

  return (
    <div className="nutr-rule-tile">
      <div className="nutr-rule-label">{label}</div>
      <div className="nutr-rule-stepper">
        <button
          type="button"
          className="nutr-stepper-btn"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, dec(value)))}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <div className="nutr-rule-value">
          <span>{displayValue ?? value.toFixed(1)}</span>
          <div className="nutr-rule-unit">{unit}</div>
        </div>
        <button
          type="button"
          className="nutr-stepper-btn"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, inc(value)))}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
      <div className="nutr-rule-footnote">{footnote}</div>
    </div>
  );
}
