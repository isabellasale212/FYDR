import Link from 'next/link';
import type { CSSProperties } from 'react';

/* SETTINGS-SPEC.md §6 described a locked page rendered instead of a real
 * screen when the club's tier is Basic. That page is gone (below). What is
 * here is the CARD — the premium region inside a base page — and the two
 * links it carries: "See what Premium contains" goes to the plan page, the
 * one place; "Switch to Premium" never existed as a button because the
 * product is sold, not self-served (12-product-tiers.md §7.2). */

/* PlanGate — the locked-destination PAGE — went on 15 September 2026 (D-20
 * without exception: a wholly premium destination is absent from navigation
 * and refuses at the URL; the Settings plan page is where a club learns what
 * Premium contains). PlanGateCard below is the other half of the rule, the
 * card a premium REGION inside a base page shows, and stays. */

/* The locked panel on its own, without the page heading PlanGate wraps it in.
 *
 * Extracted because a tier gate is not always a whole route. /analytics is the
 * first case: the screen itself is on both plans and only ONE visualisation
 * inside it is Premium, so the lock has to sit in the place that visualisation
 * would have been rather than replacing everything around it. Extracted rather
 * than re-drawn there, so the padlock, the wording register and the two links
 * are defined once — a second hand-built locked panel is how "Not on the Basic
 * plan" starts meaning two slightly different things in one product.
 *
 * `heading` defaults to the same sentence the route-level gate uses. A caller
 * gating one capability inside an open screen should name that capability
 * instead, because "Not on the Basic plan" next to a screen the club plainly
 * IS looking at reads as a bug. */
export function PlanGateCard({
  body,
  metadata,
  heading = 'Not on the Basic plan',
  style,
}: {
  body: string;
  metadata: string;
  heading?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="card pp-card" style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 'var(--r)',
            background: 'rgb(var(--highlight-rgb) / 0.22)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--highlight-pill-text)" strokeWidth="1.5">
            <rect x="2.4" y="6" width="9.2" height="7" rx="1.6" />
            <path d="M4.6 6V4.2a2.4 2.4 0 0 1 4.8 0V6" />
          </svg>
        </div>
        <p style={{ fontSize: 'var(--fs-15)', fontWeight: 'var(--w-bold)', margin: 0 }}>{heading}</p>
      </div>

      <p style={{ fontSize: 'var(--fs-13)', color: 'var(--text)', margin: 'var(--s-7) 0 0' }}>{body}</p>
      <p className="num" style={{ fontSize: 'var(--fs-12)', color: 'var(--muted)', marginTop: 'var(--sp-12)' }}>
        {metadata}
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-18)' }}>
        {/* One place: the plan page (14 Sept 2026). Desktop-only, so the
            button is not drawn at phone width (2.2, 16 Sept 2026); the
            Back to Settings way stays. */}
        <Link href="/settings/plan" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} data-desktop-only="">
          See what Premium contains
        </Link>
        <Link href="/settings" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Back to Settings
        </Link>
      </div>
    </div>
  );
}
