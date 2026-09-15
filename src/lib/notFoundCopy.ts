/* The not-found screens' words, once, for both shells and the root —
 * decision-batch-2026-09-15.md #3 (Isabella, 15 Sept 2026).
 *
 * Next's default not-found is black text on its own white-ish assumption;
 * on the athlete app's dark ground it measured 1.23:1 (the a11y sweep, C1–
 * C2), which is invisible. The replacement inherits the tokens like every
 * other screen, and says something honest.
 *
 * HONEST MEANS VAGUE HERE, ON PURPOSE. notFound() catches two things and
 * must not tell them apart: a thing that was removed, and a thing that
 * exists but belongs to someone else — another athlete's gym session, an
 * injury in another club. Every self-only read is RLS self-only, so the
 * missing row and the foreign row arrive as the same empty result, and the
 * screen must not undo that by wording (docs/athlete/screens/09-one-gym-
 * session-logged.md §10: "a 403 would confirm the row exists"). So: it may
 * have been removed, or the link may be out of date — never "you cannot see
 * this", which is a confirmation. */

export const NOT_FOUND = {
  eyebrow: 'Not found',
  title: 'There is nothing here',
  body: 'It may have been removed, or the link may be out of date. If someone sent you the link, ask them to check it.',
} as const;

/** Where each shell sends the person on: its own home. */
export const NOT_FOUND_HOME = {
  athlete: { href: '/today', label: 'Go to Today' },
  staff: { href: '/dashboard', label: 'Go to the dashboard' },
  root: { href: '/', label: 'Go to Fydr' },
} as const;
