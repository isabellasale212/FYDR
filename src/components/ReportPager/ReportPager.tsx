'use client';

import { useState } from 'react';

type Page = { label: string; content: React.ReactNode };

/** screens/reports.md's own pager, web version: tabs plus a "N of M" indicator
 *  rather than swipe, which the spec itself frames as the mobile expression of
 *  the same control ("left/right reports... is where the swipe instruction
 *  actually lives" — on mobile; the web mock shows tabs and prev/next arrows). */
export function ReportPager({ pages }: { pages: Page[] }) {
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? pages[0];
  if (!page) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="tiny mono">
          {index + 1} of {pages.length}
        </span>
        <div className="chiprow" style={{ flex: 1 }}>
          {pages.map((p, i) => (
            <button key={p.label} type="button" className="squad-chip" aria-pressed={i === index} onClick={() => setIndex(i)}>
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={index === pages.length - 1}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      {page.content}
    </div>
  );
}
