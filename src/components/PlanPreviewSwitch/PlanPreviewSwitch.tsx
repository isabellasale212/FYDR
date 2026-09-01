'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TIER_PREVIEW_COOKIE, TIER_PREVIEW_VALUE } from '@/lib/tierPreview';

type Props = {
  /** The tier currently being RENDERED — real plan or preview. Drives the knob. */
  onPremium: boolean;
  /** True when the club's real plan is Premium, i.e. there is something to
   *  preview. A Basic club gets the static indicator instead: it cannot
   *  preview upward, so a switch would be a control that never moves. */
  canPreview: boolean;
};

/* The Plan card's Basic/Premium switch.
 *
 * This was a painted-on indicator: three divs with data-attributes and a title
 * explaining that plan changes are a sales conversation. That reasoning was
 * right about BILLING and is unchanged — nothing here writes
 * organisations.tier, and the club's paid plan cannot be altered from this UI.
 * What the switch now does is change what this admin's own session renders, so
 * the product can be seen the way a Basic club sees it.
 *
 * A cookie rather than component state, because every tier gate in this app is
 * server-side: the analytics chart, the training report, GPS import and the
 * leaderboard metric picker are all decided in a server component from
 * requireStaff()'s `tier`. Client state cannot reach any of them; a cookie plus
 * router.refresh() re-renders the whole tree with the new tier, which is why
 * flipping this changes four screens the switch has never heard of.
 *
 * The cookie is a preference, not a permission. It is browser-written and
 * therefore untrusted, and lib/tierPreview.ts's effectiveTier() is what decides
 * whether it means anything — it refuses every value except a downgrade, so the
 * worst a tampered cookie achieves is showing its own author fewer features.
 */
export function PlanPreviewSwitch({ onPremium, canPreview }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(onPremium);

  if (!canPreview) {
    return (
      <div
        className="plan-switch"
        title="Plan changes are a sales conversation with your Fydr contact, not a self-service toggle."
      >
        <span className="plan-switch-label plan-switch-label-basic" data-active={!onPremium}>
          Basic
        </span>
        <div className="plan-switch-track" data-on={onPremium} aria-hidden="true">
          <div className="plan-switch-knob" data-on={onPremium} />
        </div>
        <span className="plan-switch-label plan-switch-label-premium" data-active={onPremium}>
          Premium
        </span>
      </div>
    );
  }

  function flip() {
    const next = !optimistic;
    setOptimistic(next);
    // Session cookie deliberately — no Max-Age. A preview is a thing you do for
    // a few minutes to look at something, not a state to be found still in
    // three weeks having forgotten it was on. Closing the browser ends it.
    // SameSite=Lax so it survives a normal in-app navigation; not HttpOnly,
    // because this component is what writes it and it guards nothing.
    document.cookie = next
      ? `${TIER_PREVIEW_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
      : `${TIER_PREVIEW_COOKIE}=${TIER_PREVIEW_VALUE}; Path=/; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      className="plan-switch"
      onClick={flip}
      disabled={pending}
      aria-pressed={optimistic}
      /* The control's job is previewing, so that is what it announces. Naming
         the plan alone ("Premium") would read as a billing control. */
      aria-label={
        optimistic
          ? 'Preview this club on the Basic plan'
          : 'Stop previewing Basic and return to this club’s real Premium plan'
      }
      title={
        optimistic
          ? 'See the product as a Basic club sees it. Your club’s real plan does not change.'
          : 'Previewing Basic. Switch back to your club’s real Premium plan.'
      }
      style={{ background: 'none', border: 0, padding: 0, cursor: pending ? 'progress' : 'pointer' }}
    >
      <span className="plan-switch-label plan-switch-label-basic" data-active={!optimistic}>
        Basic
      </span>
      <div className="plan-switch-track" data-on={optimistic} aria-hidden="true">
        <div className="plan-switch-knob" data-on={optimistic} />
      </div>
      <span className="plan-switch-label plan-switch-label-premium" data-active={optimistic}>
        Premium
      </span>
    </button>
  );
}
