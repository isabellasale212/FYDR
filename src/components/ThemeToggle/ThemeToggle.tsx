'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fydr-theme';

/** 06-design-system.md §2.4 route 3: the explicit user choice, written to
 *  data-theme on the root. With no choice stored the OS preference applies, so
 *  the initial state is deliberately undefined rather than "light". */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setTheme(stored);
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
