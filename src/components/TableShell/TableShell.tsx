import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** The order the rows are in, said in words — "Worst first — the athlete to
   *  chase is at the top". Null when the table is not a ranking. */
  sort: string | null;
  /** The rows over their denominator — "24 of 30 athletes". */
  count: string;
  /** For a table whose body brings its own inset (the `flush` cards). */
  className?: string;
  /** The heading's id when a page labels the section by it. */
  titleId?: string;
  children: ReactNode;
};

/** PATTERN-S7 C1 (2026-09-13): the table shell every report's main table sits
 *  in — the board's "TableShell": one heading row with the title, the sort
 *  order in words (the constitution's "lowest or worst first, never
 *  alphabetically, wherever there is someone to chase — and the header says
 *  so") and the row count with its denominator; then the body, which scrolls
 *  sideways on a narrow screen rather than the page. The body is whatever
 *  table the report already draws; the shell composes the card and the
 *  heading and nothing else. */
export function TableShell({ title, sort, count, className, titleId, children }: Props) {
  return (
    <section className={`card rtable${className ? ` ${className}` : ''}`} aria-labelledby={titleId}>
      <div className="rtable-head">
        <h2 className="card-title rtable-title" id={titleId}>
          {title}
        </h2>
        <span className="rtable-meta">
          {sort ? <span className="rtable-sort">{sort}</span> : null}
          <span className="rtable-count num">{count}</span>
        </span>
      </div>
      <div className="rtable-body">{children}</div>
    </section>
  );
}
