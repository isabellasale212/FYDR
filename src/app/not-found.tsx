import Link from 'next/link';
import { NOT_FOUND, NOT_FOUND_HOME } from '@/lib/notFoundCopy';

export const metadata = { title: 'Not found · Fydr' };

/** The root not-found — decision-batch-2026-09-15.md #3. An address that
 *  matches no route at all lands here, outside either shell (a route group
 *  owns no URL prefix, so Next cannot know whose shell a stray address
 *  belongs to). The same words as the two shells', on the tokens, so it
 *  reads in both themes where Next's default was black on the athlete
 *  app's dark ground. "/" sends a signed-in person to their own home and
 *  everyone else to sign in. */
export default function RootNotFound() {
  return (
    <main id="main" style={{ padding: 'var(--sp-24) var(--sp-16)', maxWidth: 560, margin: '0 auto' }}>
      <div className="page-head">
        <p className="eyebrow">{NOT_FOUND.eyebrow}</p>
        <h1>{NOT_FOUND.title}</h1>
      </div>
      <div className="card">
        <p style={{ margin: '0 0 var(--sp-16)' }}>{NOT_FOUND.body}</p>
        <Link href={NOT_FOUND_HOME.root.href} className="btn-primary" style={{ display: 'inline-flex' }}>
          {NOT_FOUND_HOME.root.label}
        </Link>
      </div>
    </main>
  );
}
