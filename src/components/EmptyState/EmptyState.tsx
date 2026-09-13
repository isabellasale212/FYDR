import Link from 'next/link';
import { ClearGroupFilterAction } from './ClearGroupFilterAction';

type Props = {
  title: string;
  body: string;
  headingLevel?: 2 | 3;
  /** PATTERN-S6 C8 (2026-09-13): the one action an empty state may carry —
   *  it widens the window or the filter, never anything else. Null draws
   *  nothing. `clearsGroupFilter` is for the filter kind: the href carries no
   *  `groups`, and the action clears the shared cookie before it navigates
   *  (§0ak) — a plain link would fall straight back to the same filter. */
  action?: { href: string; label: string; clearsGroupFilter?: boolean } | null;
};

/** A named absence. An empty panel with no explanation reads as a broken panel,
 *  and 06-design-system.md §11.3 requires each panel to fail on its own. */
export function EmptyState({ title, body, headingLevel = 2, action = null }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      <p>{body}</p>
      {!action ? null : action.clearsGroupFilter ? (
        <ClearGroupFilterAction href={action.href} label={action.label} />
      ) : (
        <Link href={action.href} className="btn-ghost empty-action">
          {action.label}
        </Link>
      )}
    </div>
  );
}
