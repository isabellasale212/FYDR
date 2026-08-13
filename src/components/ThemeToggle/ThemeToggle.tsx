'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fydr-theme';

/** 06-design-system.md §2.4 route 3: the explicit user choice, written to
 *  data-theme on the root. With no choice stored the OS preference applies
 *  (route 2, pure CSS — see tokens.css), so the initial state is deliberately
 *  undefined rather than "light".
 *
 *  The root layout's blocking inline script (src/app/layout.tsx) is what
 *  actually applies a stored choice before first paint now, on every route —
 *  this component used to be the only thing that did it, on mount, which
 *  both flashed (post-hydration) and silently no-op'd on any page that
 *  didn't happen to render a ThemeToggle. The mount effect below still
 *  matters: it syncs this component's own state to what's already on the
 *  DOM, so flip() below toggles from the *actual* current theme instead of
 *  assuming light. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const applied = document.documentElement.getAttribute('data-theme');
    if (applied === 'light' || applied === 'dark') setTheme(applied);
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function flip() {
    setTheme((current) => {
      if (current) return current === 'dark' ? 'light' : 'dark';
      const osPrefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      return osPrefersDark ? 'light' : 'dark';
    });
  }

  return (
    <button
      type="button"
      className="toggle"
      onClick={flip}
      aria-label="Switch between the light and dark themes"
    >
      <span aria-hidden="true">◐</span> Theme
    </button>
  );
}
