import Link from 'next/link';
import { STATE_WORD, type TodoState } from '@/lib/todayStatus';

/* One of Today's three status cards (Isabella, 16 September 2026, 1.1):
 * bigger than the row it replaces, in place whatever its state, the state
 * as a wash and an edge in its tone family AND as the word — colour is never
 * the only carrier. Done is the product's good tone (cyan, tokens.css —
 * the system's own reading of "green", by a recorded decision); to do is
 * the accent; overdue is bad. A card with somewhere to go is a Link; a done
 * card, or one with nothing today, is not a control. */
type Props = {
  domain: 'checkin' | 'gym' | 'nutrition';
  name: string;
  state: TodoState;
  /** One line under the name: the window, the count, the week. */
  sub: string;
  /** Where a tap goes while there is something to do. */
  href: string | null;
};

/** The state word as the product's own pill in its tone family. */
const PILL: Record<TodoState, string> = { done: 'pill-good', todo: 'pill-accent', overdue: 'pill-bad', none: 'pill-neutral' };

export function TodoStatusCard({ domain, name, state, sub, href }: Props) {
  const body = (
    <>
      <span className="td-card-main">
        <span className="td-card-name">{name}</span>
        <span className="td-card-sub">{sub}</span>
      </span>
      <span className={`pill ${PILL[state]} td-card-state`}>{STATE_WORD[state]}</span>
      {href ? (
        <span className="chev td-chev" aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card td-card" data-state={state} data-domain={domain}>
        {body}
      </Link>
    );
  }
  return (
    <div className="card td-card" data-state={state} data-domain={domain}>
      {body}
    </div>
  );
}
