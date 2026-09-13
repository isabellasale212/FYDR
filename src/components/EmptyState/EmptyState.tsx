import Link from 'next/link';

type Props = {
  title: string;
  body: string;
  headingLevel?: 2 | 3;
  /** PATTERN-S6 C8 (2026-09-13): the one action an empty state may carry —
   *  it widens the window or the filter, never anything else. Null draws
   *  nothing. */
  action?: { href: string; label: string } | null;
};

/** A named absence. An empty panel with no explanation reads as a broken panel,
 *  and 06-design-system.md §11.3 requires each panel to fail on its own. */
export function EmptyState({ title, body, headingLevel = 2, action = null }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      <p>{body}</p>
      {action ? (
        <Link href={action.href} className="btn-ghost empty-action">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
