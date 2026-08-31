'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type ReportSelectOption = {
  value: string;
  label: string;
  /** Rendered but not choosable. screens/analytics.md's own rule for a
   *  visualisation that is illegal for the current query shape: "Illegal
   *  combinations are disabled with the reason, not hidden." Hiding an option
   *  makes a control look shorter on some screens than others and gives the
   *  user nothing to reason about; disabling it shows the capability and
   *  leaves the caller to print why. Optional, so every existing call site is
   *  unaffected. */
  disabled?: boolean;
};

type Props = {
  /** Visible label rendered beside the control. */
  label: string;
  /** Query string key this control reads and writes. */
  paramKey: string;
  /** Current value — the caller resolves this the same way the page itself
   *  resolves the param, so the control always reflects what actually
   *  rendered rather than the raw, possibly-absent URL value. */
  value: string;
  options: readonly ReportSelectOption[];
  /** Selecting this value removes `paramKey` from the URL entirely instead
   *  of writing it — for a control whose "default" state is "no param set",
   *  same convention GroupFilter.tsx uses for "Whole squad". */
  clearValue?: string;
  ariaLabel?: string;
};

/** A `<select>` that jumps to a different value of one query param, every
 *  other param on the URL preserved untouched — group filter, mode, scope,
 *  lens, whichever athlete is selected, all carried over automatically
 *  because this reads the real browser URL via useSearchParams() rather
 *  than reconstructing one from a fixed list of known keys (the difference
 *  from TestDateNav.tsx's own hand-built href, which only had to preserve
 *  two params and could afford to). Same navigate-on-change shape as
 *  TestDateNav.tsx's own "past sessions" dropdown and GroupFilter.tsx's
 *  own apply(), both already established for exactly this: a control that
 *  is real data-backed, not every possible date, only ones that actually
 *  have a session behind them. */
export function ReportSelectNav({ label, paramKey, value, options, clearValue, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (clearValue !== undefined && next === clearValue) params.delete(paramKey);
    else params.set(paramKey, next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  if (options.length === 0) return null;

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="tiny" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <select className="field" style={{ padding: '4px 8px' }} value={value} onChange={(e) => go(e.target.value)} aria-label={ariaLabel ?? label}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
