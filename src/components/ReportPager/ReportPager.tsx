'use client';

import { useState } from 'react';

type Page = { label: string; content: React.ReactNode };

type Props = {
  pages: Page[];
  /** Rendered at the far end of the tab row. For a control that scopes every
   *  tab at once — the period, on the reports that have one. It sat on a row
   *  of its own above, which read as if it belonged to the page rather than to
   *  the tabs, and cost a whole row to say one word. */
  right?: React.ReactNode;
};

/** screens/reports.md's own pager, web version: tabs plus a "N of M" indicator
 *  rather than swipe, which the spec itself frames as the mobile expression of
 *  the same control ("left/right reports... is where the swipe instruction
 *  actually lives" — on mobile; the web mock shows tabs and prev/next arrows). */
export function ReportPager({ pages, right }: Props) {
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
        <span className="tiny num">
          {index + 1} of {pages.length}
        </span>
        {/* The tab row no longer stretches. `flex: 1` pushed the next arrow to
            the far right of the page, so on a three-tab report the ‹ and the ›
            sat several hundred pixels apart with nothing between them — a pair
            of controls that only make sense read together. They bracket the
            tabs now. */}
        <div className="chiprow">
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
        {right ? <div style={{ marginLeft: 'auto' }}>{right}</div> : null}
      </div>
      {page.content}
    </div>
  );
}
