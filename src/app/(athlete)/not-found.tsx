import Link from 'next/link';
import { NOT_FOUND, NOT_FOUND_HOME } from '@/lib/notFoundCopy';

export const metadata = { title: 'Not found · Fydr' };

/** The athlete shell's not-found — decision-batch-2026-09-15.md #3. Rendered
 *  inside the shell (tab bar, the layout's Back button) wherever a page
 *  under (athlete) calls notFound(): a gym session that is not theirs or no
 *  longer exists, a logged session id that resolves to nothing. The words
 *  are lib/notFoundCopy.ts's and do not say which; the head is the one
 *  /me/status draws. Tokens throughout, so it reads in both themes. */
export default function AthleteNotFound() {
  return (
    <>
      <div className="hd">
        <h1 className="d">{NOT_FOUND.eyebrow}</h1>
      </div>
      <div className="stack">
        <section className="card" aria-labelledby="nf-title">
          <h2 className="card-title" id="nf-title">
            {NOT_FOUND.title}
          </h2>
          <p>{NOT_FOUND.body}</p>
          <Link href={NOT_FOUND_HOME.athlete.href} className="btn-primary" style={{ display: 'inline-flex' }}>
            {NOT_FOUND_HOME.athlete.label}
          </Link>
        </section>
      </div>
    </>
  );
}
