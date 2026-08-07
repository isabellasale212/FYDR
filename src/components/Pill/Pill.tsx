import type { Status, Tone } from '@/lib/status';

const TONE_CLASS: Record<Tone, string> = {
  good: 'pill pill-good',
  warn: 'pill pill-warn',
  bad: 'pill pill-bad',
  accent: 'pill pill-accent',
  neutral: 'pill pill-neutral',
};

type Props = {
  status: Status;
  /** Overrides the status word where the row already says it, for example
   *  "80% volume" beside a Running restriction. The glyph never changes. */
  label?: string;
};

/** 06-design-system.md §4.4. The fill is identity, the edge reinforces, and the
 *  label and the glyph carry the status. Neither of the last two is optional,
 *  which is why the glyph is a required part of Status and not a prop. */
export function Pill({ status, label }: Props) {
  return (
    <span className={TONE_CLASS[status.tone]}>
      {status.glyph ? (
        <span className="glyph" aria-hidden="true">
          {status.glyph}
        </span>
      ) : null}
      {label ?? status.label}
    </span>
  );
}
