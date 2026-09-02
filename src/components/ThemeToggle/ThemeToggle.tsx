'use client';

import { useEffect, useState } from 'react';

type Choice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'fydr-theme';

/** 06-design-system.md §2.4's three routes, made visible and reversible.
 *
 *  This was a blind two-state toggle labelled "◐ Theme". Two things were wrong
 *  with it, and they are the same thing twice:
 *
 *    1. It never said which theme you were on. The only way to find out was to
 *       press it and see what changed.
 *    2. It could not express SYSTEM. Route 2 — no `data-theme`, the OS
 *       preference applying through `@media (prefers-color-scheme: dark)` — is
 *       the state every user starts in, and the old control had no way back to
 *       it. One press wrote a hard value to localStorage forever.
 *
 *  Together those made the product look like it was switching theme on its
 *  own: a club on macOS auto (light by day, dark at night) IS on route 2, so
 *  the app correctly followed the OS, and nothing on screen explained why.
 *  Reported as "the theme switches when I click on different pages" — it does
 *  not; navigation was a coincidence of when people looked.
 *
 *  So: three explicit states, the live one marked with aria-pressed. Choosing
 *  System REMOVES both the attribute and the stored key, which is what hands
 *  control back to the media query rather than freezing today's OS value.
 *
 *  The root layout's blocking inline script still applies a stored choice
 *  before first paint on every route; this component only reads and writes it.
 */
const CHOICES: { key: Choice; label: string; hint: string }[] = [
  { key: 'system', label: 'System', hint: 'Follow the device setting' },
  { key: 'light', label: 'Light', hint: 'Always light' },
  { key: 'dark', label: 'Dark', hint: 'Always dark' },
];

export function ThemeToggle() {
  /* null until mounted: the server cannot read localStorage, and rendering a
     guess would light up the wrong segment for a frame. */
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setChoice(stored === 'light' || stored === 'dark' ? stored : 'system');
  }, []);

  function pick(next: Choice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === 'system') {
      // Both, not just one. Leaving either behind keeps the page pinned to a
      // literal theme while the control claims it is following the device.
      root.removeAttribute('data-theme');
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    root.setAttribute('data-theme', next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div className="theme-seg" role="group" aria-label="Theme">
      {CHOICES.map((c) => (
        <button
          key={c.key}
          type="button"
          className="theme-seg-btn"
          /* Before mount nothing is marked active rather than the wrong thing
             being marked active — an unlit control for one frame is honest,
             a confidently wrong one is not. */
          aria-pressed={choice === null ? undefined : choice === c.key}
          data-active={choice === c.key ? '' : undefined}
          title={c.hint}
          onClick={() => pick(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
