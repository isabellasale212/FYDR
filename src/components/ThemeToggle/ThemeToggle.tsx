'use client';

import { useEffect, useState } from 'react';

type Choice = 'light' | 'dark';

const STORAGE_KEY = 'fydr-theme';

/** 06-design-system.md §2.4's routes, made visible and reversible.
 *
 *  TWO buttons, Light and Dark, per the design (Design.pdf p45). It had three;
 *  "System" was dropped there and this follows it.
 *
 *  The reason System existed still has to be answered, though, and dropping the
 *  BUTTON is not the same as dropping the STATE. Route 2 — no `data-theme`, the
 *  OS preference applying through `@media (prefers-color-scheme: dark)` — is
 *  where every user starts, and it is still where a user sits until they press
 *  something here. A two-button control that assumed "Light" on load would tell
 *  a user on an OS-dark machine that they are on Light while the app renders
 *  dark around them. That is the exact complaint the three-state control was
 *  built to answer ("the theme switches when I click on different pages"), and
 *  it is not worth re-introducing to save a button.
 *
 *  So: with nothing stored, the live button is whichever theme is ACTUALLY
 *  showing, resolved from matchMedia. Pressing either writes an explicit choice
 *  and pins it. The control therefore never claims a theme the user is not
 *  looking at, and there are two buttons on screen, which is what the design
 *  asks for.
 *
 *  The root layout's blocking inline script still applies a stored choice
 *  before first paint on every route; this component only reads and writes it.
 */
const CHOICES: { key: Choice; label: string; hint: string }[] = [
  { key: 'light', label: 'Light', hint: 'Always light' },
  { key: 'dark', label: 'Dark', hint: 'Always dark' },
];

export function ThemeToggle() {
  /* null until mounted: the server cannot read localStorage, and rendering a
     guess would light up the wrong segment for a frame. */
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      setChoice(stored);
      return;
    }
    /* Nothing stored: the OS is driving. Mark whichever theme is actually on
       screen, so the control reports the truth rather than a default. */
    setChoice(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  function pick(next: Choice) {
    setChoice(next);
    document.documentElement.setAttribute('data-theme', next);
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
