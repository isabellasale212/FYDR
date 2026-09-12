'use client';

import { useId, useState } from 'react';

/* A control the reader may not use, that still says why — the one rule for
 * every permission- or eligibility-blocked control in the staff app
 * (decided by Isabella 2026-09-12, STAFF-SS-02-05 D2 / Builder question 8,
 * closing §0ap's dead "Tap one below to see why" and §0av's three greyed
 * weigh-in buttons):
 *
 *   - `aria-disabled="true"`, never the `disabled` attribute: a disabled
 *     button dispatches no click in any browser and gets no focus, so on a
 *     phone the reason in its `title` was never shown to anyone;
 *   - the reason is shown on tap or focus, beneath the control, as a status
 *     the button is described by — never a `title` attribute, never
 *     silently dead;
 *   - the visible box keeps its design; only the ink is muted.
 *
 * When `blocked` is false it is an ordinary button. The reason is a sibling
 * after the button (a fragment, not a wrapper), so the control keeps its
 * place in whatever row it sits in; `.blocked-why` takes a full line of a
 * wrapping row.
 */
type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'title'> & {
  blocked: boolean;
  /** Why the reader may not use it. Shown on tap or focus while blocked. */
  reason: string;
};

export function BlockedButton({ blocked, reason, onClick, onFocus, onBlur, className, children, ...rest }: Props) {
  const [shown, setShown] = useState(false);
  const whyId = useId();
  if (!blocked) {
    return (
      <button type="button" className={className} onClick={onClick} onFocus={onFocus} onBlur={onBlur} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className={className}
        data-blocked=""
        aria-disabled="true"
        aria-describedby={shown ? whyId : undefined}
        onClick={(e) => {
          e.preventDefault();
          setShown(true);
        }}
        onFocus={(e) => {
          setShown(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setShown(false);
          onBlur?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
      {shown ? (
        <span className="blocked-why" role="status" id={whyId}>
          {reason}
        </span>
      ) : null}
    </>
  );
}
