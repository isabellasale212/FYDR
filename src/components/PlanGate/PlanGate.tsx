import Link from 'next/link';
import type { CSSProperties } from 'react';

type Props = {
  featureName: string;
  body: string;
  metadata: string;
};

/* SETTINGS-SPEC.md §6. Rendered instead of a real screen when the org's
 * tier is Basic and the destination is gated — the real, live gate, not a
 * mockup of one: lib/tier.ts's isPremium() decides whether this renders,
 * and the two real call sites are /reports/training and /settings/imports,
 * the two features 12-product-tiers.md §3.1 and this spec both name as
 * Premium (the Training report needs GPS records, GPS import is how they
 * arrive).
 *
 * "Switch to Premium" does not flip the tier — see lib/tier.ts's own
 * header and orgDetails.ts's: 12-product-tiers.md §7.2 is explicit this
 * product is sold, not self-served, so there is no button anywhere in
 * this build that lets a club change its own tier. The spec's own §7
 * "Notes for production" already anticipates this: "This prototype
 * toggles instantly so the gating can be demonstrated; production needs a
 * confirmation step." This build goes one step further, matching the
 * decision already recorded elsewhere in this codebase: production needs
 * a sales conversation, not a confirmation step, so the button is real —
 * it goes to Settings, where the real plan comparison lives — rather than
 * a fake "instant upgrade" affordance this app doesn't actually offer. */
export function PlanGate({ featureName, body, metadata }: Props) {
  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Premium feature</p>
          <h1>{featureName}</h1>
        </div>
      </div>

      <PlanGateCard body={body} metadata={metadata} style={{ maxWidth: 680, marginTop: 20 }} />
    </>
  );
}

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
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
        <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{heading}</p>
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--text)', margin: '14px 0 0' }}>{body}</p>
      <p className="mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 12 }}>
        {metadata}
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Link href="/settings#plan" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          See plans
        </Link>
        <Link href="/settings" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          See what each plan includes
        </Link>
      </div>
    </div>
  );
}
