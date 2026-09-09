import Link from 'next/link';

/* The two chrome pieces all three per-athlete domain pages share
 * (/squad/[athleteId]/nutrition, /wellness, /gym). Presentation only — the
 * gate itself is in lib/athleteDomain.server.ts, which decides `denied` before
 * any per-athlete query runs. */

/** The role refusal. Identical wording to squad/[athleteId]/page.tsx's own,
 *  because it is the identical refusal for the identical reason: an athlete's
 *  performance, wellness, load and injury-availability detail is admin's
 *  clearest "cannot" (01-roles-and-permissions.md (superseded) §1/§2). Naming the domain
 *  rather than saying "this page" so a reader who followed a link from
 *  somewhere knows what they were refused. */
export function AthleteDomainDenied({ orgName, domain }: { orgName: string; domain: string }) {
  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>{domain}</h1>
        </div>
      </div>
      <div className="empty">
        <h2>Not part of this role</h2>
        <p>
          An athlete&apos;s {domain.toLowerCase()} detail is named performance and wellness data.
          Admin manages the club and does not read athlete performance data &mdash; see
          01-roles-and-permissions.md (superseded) §1.
        </p>
      </div>
    </>
  );
}

/** The one banner that makes "view only" a statement rather than an absence.
 *
 *  The client's clarification, verbatim: *"dont allow editing of gym,
 *  nutrition, or wellness in players profile just make it veiwable and only
 *  editable by the staff incharge"*. A page with no edit controls and no
 *  explanation reads as a page whose edit controls are broken, so each of
 *  these three says out loud that it is read-only AND where the one real edit
 *  path is — because "only editable by the staff in charge" is a statement
 *  about WHO, and a coach who cannot find the who is going to ask for an edit
 *  button here instead.
 *
 *  `href` is always a real destination whose owner is named in `owner`. If a
 *  domain ever has no real edit path, pass none and say so — never link
 *  somewhere approximate. */
export function ViewOnlyNotice({
  what,
  owner,
  href,
  linkLabel,
  note,
}: {
  /** "Wellness entries", "Nutrition targets", "This gym programme". */
  what: string;
  /** Who owns the edit, in role words: "coach or medical". */
  owner: string;
  href: string | null;
  linkLabel: string | null;
  /** Anything domain-specific worth one more sentence — the immutability rule,
   *  the rehab split. */
  note?: string;
}) {
  return (
    <section className="card pp-card" aria-label="Editing">
      <p className="pp-goal-line" style={{ margin: 0 }}>
        <span className="pp-goal-label">View only.</span> {what} &mdash; changed by {owner}, in one
        place only.
      </p>
      {note ? (
        <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
          {note}
        </p>
      ) : null}
      {href && linkLabel ? (
        <p style={{ margin: '10px 0 0' }}>
          <Link href={href} className="btn-ghost-pill accent">
            {linkLabel} &rsaquo;
          </Link>
        </p>
      ) : null}
    </section>
  );
}
