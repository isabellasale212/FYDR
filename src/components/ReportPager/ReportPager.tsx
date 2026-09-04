'use client';

import { Fragment, useState } from 'react';
import { ReportHeader, type ReportHeaderProps } from '@/components/ReportHeader/ReportHeader';

type Page = { label: string; content: React.ReactNode };

type Props = {
  pages: Page[];
  /** Rendered at the far end of the tab row. For a control that scopes every
   *  tab at once — the period, on the reports that have one. It sat on a row
   *  of its own above, which read as if it belonged to the page rather than to
   *  the tabs, and cost a whole row to say one word. */
  right?: React.ReactNode;
  /** The screen's header. Passed through rather than rendered by the page,
   *  because the design puts the tab segment in the header's last row and the
   *  tab state lives here. Everything except the tabs comes from the page. */
  header?: Omit<ReportHeaderProps, 'tabs' | 'period'>;
};

/** screens/reports.md's own pager, web version: tabs plus a "N of M" indicator
 *  rather than swipe, which the spec itself frames as the mobile expression of
 *  the same control ("left/right reports... is where the swipe instruction
 *  actually lives" — on mobile; the web mock shows tabs and prev/next arrows). */
export function ReportPager({ pages, right, header }: Props) {
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? pages[0];
  if (!page) return null;

  /* With a header, the tab row moves into it and the prev/next arrows go with
     the tabs they bracket. Without one, the old in-body row is kept, so the
     screens that have not been reworked are unaffected. */
  if (header) {
    return (
      <div>
        <ReportHeader
          {...header}
          tabs={pages.map((p, i) => ({
            label: p.label,
            selected: i === index,
            onSelect: () => setIndex(i),
          }))}
          period={right}
        />
        <Fragment key={page.label}>{page.content}</Fragment>
      </div>
    );
  }

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
      {/* KEYED, and the key is why this is a Fragment rather than a bare
          `{page.content}`.

          Two things it fixes, one of them invisible until you look for it.

          The visible one is React's "Each child in a list should have a unique
          key prop... Check the render method of `ReportPager`". This div's
          children are the array [tab row, content], and the content element is
          built by a SERVER component and arrives over the RSC wire. Flight
          outlines a large element into its own chunk, so what lands here is a
          lazy wrapper rather than the element itself; jsx's key check marks the
          WRAPPER as validated, the reconciler unwraps it, and the element
          inside still reads as an unkeyed child of a list. Hence the warning on
          the tab whose content happened to be outlined — and only when you
          switch to it, because an unvisited tab's chunk is never resolved. A
          key on this slot ends it: React does not ask for one twice.

          The other is real. Without a key, every tab's content occupies the
          same position in the same parent, so React RECONCILES ONE TAB'S
          SUBTREE INTO THE NEXT — a chart's internal state, a details/summary's
          open flag, a scroll position, all carried across a switch into a
          report that never asked for it. Keying by label makes each tab its own
          subtree, which is what a tab set means. */}
      <Fragment key={page.label}>{page.content}</Fragment>
    </div>
  );
}
