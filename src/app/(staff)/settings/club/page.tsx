import Link from 'next/link';
import { ClubDetailsEditForm } from '@/components/ClubDetailsEditForm/ClubDetailsEditForm';
import { PlanPreviewSwitch } from '@/components/PlanPreviewSwitch/PlanPreviewSwitch';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import { isPlatformStaff } from '@/lib/platformStaff';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Club · Settings · Fydr' };

/** PATTERN-S8 C2 (2026-09-13): the hub became four groups on one screen, and
 *  the long forms and the two big cards moved one level down. This is the
 *  Club level: the Plan card (real organisations.tier, read-only — see
 *  lib/tier.ts's own header for why this doesn't self-serve; the platform
 *  staff's Basic preview), the Integrations card (Catapult and the vendor CSV
 *  import are real, linking to the GPS import screen), and the club details
 *  form for an administrator. The cards are the hub's own, moved verbatim
 *  with their reasoning. */
export default async function SettingsClubPage() {
  const { db, orgId, claims, tier, realTier, previewingTier } = await requireStaff();
  const isAdmin = hasAnyRole(claims.roles, SETTINGS_ADMIN);
  const onPremium = isPremium(tier);
  /* Not `isAdmin`: a club's own administrator does not get to try the other
     plan on. lib/platformStaff.ts has the reasoning; requireStaff() enforces
     the same rule on the cookie, so this only decides whether the control is
     drawn. Premium-only because the preview is downgrade-only — offering it to
     a Basic club would be a switch that provably cannot do anything. */
  const canPreviewTier = isPlatformStaff(claims.email) && isPremium(realTier);
  const orgRow = isAdmin
    ? await db.from('organisations').select('name, sport, timezone, country_code, logo_url').eq('id', orgId).maybeSingle()
    : { data: null };

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Club
          </p>
          <h1>Club</h1>
        </div>
      </div>

      <div className="set-body">
      <section className="card set-card" aria-labelledby="plan-title" id="plan">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--sp-16)', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="card-title" id="plan-title" style={{ margin: 0 }}>
              Plan
            </h2>
            <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 0' }}>
              {onPremium
                ? 'Premium · GPS, the training report and the analytics bar chart are on.'
                : 'Basic · wellness, gym, nutrition, schedule, reports and exports.'}
            </p>
            {/* Never let a preview be mistaken for the real plan. Without
                this, an admin who forgot the switch was on would find GPS
                and the training report gone and reasonably report it as a
                fault. Says what is happening and how to undo it. */}
            {previewingTier ? (
              <p className="pill" style={{ background: 'var(--wash-warn)', color: 'var(--warn-pill-text)', marginTop: 'var(--sp-8)' }}>
                Previewing Basic · this club’s real plan is still Premium
              </p>
            ) : null}
          </div>
          {/* Live for an admin whose club is really on Premium — it previews
              the product on Basic, it does not change the plan. Everyone
              else gets the same painted indicator as before, because there
              is nothing they could preview: a coach has no business
              downgrading their own view, and a Basic club can only preview
              upward, which lib/tierPreview.ts refuses on entitlement
              grounds. */}
          <PlanPreviewSwitch onPremium={onPremium} canPreview={canPreviewTier} />
        </div>

        <div className="plan-compare">
          <div className="plan-compare-card" data-active={!onPremium}>
            <p style={{ fontSize: 'var(--fs-13)', fontWeight: 700, margin: 0 }}>Basic</p>
            <div className="plan-compare-list">
              <span>Gym programme</span>
              <span>Nutrition</span>
              <span>Schedule and fixtures</span>
              <span>Wellness</span>
              <span>Reports · gym, wellness, testing, nutrition</span>
              {/* This line used to read "Analytics · bar charts". The BAR
                  CHART moved to the Premium column below, on the coach's own
                  instruction ("move the analytics bar chart ... onto the
                  premium plan side") — the screen did not. This is not a
                  copy change: /analytics renders a locked panel in place of
                  the bar view for a Basic club and leaves the rest of the
                  screen live, so this list and the real gate agree line for
                  line. The narrow scope, and what it does and does not
                  contradict in 12-product-tiers.md §3.3 and
                  screens/analytics.md, is argued in full in the analytics
                  page component's own header. */}
              <span>Analytics · metric builder, trends and table</span>
              <span>Settings and exports</span>
            </div>
          </div>
          <div className="plan-compare-card" data-active={onPremium}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
              <p style={{ fontSize: 'var(--fs-13)', fontWeight: 700, margin: 0 }}>Premium</p>
              {/* The design gives this badge the WARN pill, not the highlight
                  gold the gated-row "Premium" markers use. Two different jobs:
                  those mark a row as out of reach, this labels what the
                  adjacent column contains. Following the design for the one it
                  specifies and leaving the gate badges on gold. */}
              <span className="pill pill-warn">everything in Basic, plus</span>
            </div>
            <div className="plan-compare-list">
              <span>GPS exports</span>
              <span>Training report</span>
              {/* Was "Analytics · heatmaps", which promised a visualisation
                  /analytics has never rendered. Named for the one analytics
                  capability that is actually Premium — the bar chart, which
                  is what the instruction names. Heatmaps stay unbuilt in
                  both tiers, so neither column may claim them; see
                  screens/analytics.md. */}
              <span>Analytics · bar chart, by athlete</span>
              {/* "Apple Health connection" was the fourth line until
                  2026-09-13: Apple Health is removed from the product
                  (docs/platform-decision.md) — there is no native app and
                  none is planned, and it was the one thing that needed
                  one. Not a Premium feature, not deferred: gone. */}
            </div>
          </div>
        </div>

      </section>

      <section className="card set-card" aria-labelledby="integrations-title">
        <h2 className="card-title" id="integrations-title" style={{ margin: 0 }}>
          Integrations
        </h2>
        <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 0' }}>
          Devices and files that write into Fydr.
        </p>

        <div style={{ marginTop: 'var(--sp-12)' }}>
          <div className="set-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)' }}>
                <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>Catapult Openfield</span>
                {!onPremium ? <span className="gold-badge">Premium</span> : null}
              </div>
              <p style={{ fontSize: 'var(--fs-12)', color: 'var(--muted)', margin: '2px 0 0' }}>
                GPS session files, CSV import
              </p>
            </div>
            {onPremium ? (
              /* PATTERN-S8 A7 (2026-09-13): what it is — a CSV file drop —
                 not "Connected", which claims a live connection nobody has
                 (the board's own open question about Catapult). */
              <Link href="/settings/imports" className="set-row-btn" data-variant="connected">
                Import files
              </Link>
            ) : (
              <Link href="/settings/imports" className="set-row-btn" data-variant="locked">
                Locked
              </Link>
            )}
          </div>

          {/* The Apple Health row stood here until 2026-09-13 ("Sleep,
              resting heart rate and body mass from the athlete's phone",
              Premium, "Not available yet · needs the Fydr iOS app" — S8
              A3). Apple Health is removed from the product
              (docs/platform-decision.md): no native app, none planned, and
              it was the only capability that required one. The consent
              purpose and the device_metrics table stay in the database,
              dormant; nothing reads or writes them. */}

          {/* This row was the only link to /settings/imports with no badge
              and no tier condition, and it described a feature that page
              does not offer — /settings/imports is the GPS vendor importer,
              not a roster or wellness importer, and there is no such screen
              to point at. Relabelled to what it actually opens, and given
              the same Premium treatment as the two GPS rows beside it. */}
          <div className="set-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
                <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>Vendor CSV import</span>
                {!onPremium ? <span className="gold-badge">Premium</span> : null}
              </div>
              <p style={{ fontSize: 'var(--fs-12)', color: 'var(--muted)', margin: '2px 0 0' }}>
                Catapult, STATSports and Polar GPS session files
              </p>
            </div>
            <Link
              href="/settings/imports"
              className="set-row-btn"
              data-variant={onPremium ? undefined : 'locked'}
            >
              {onPremium ? 'Open' : 'Locked'}
            </Link>
          </div>
        </div>
      </section>

        {isAdmin && orgRow.data ? (
          <ClubDetailsEditForm
            orgId={orgId}
            initialName={orgRow.data.name}
            initialSport={orgRow.data.sport}
            initialTimezone={orgRow.data.timezone}
            initialCountryCode={orgRow.data.country_code}
            initialLogoUrl={orgRow.data.logo_url}
          />
        ) : null}
      </div>
    </>
  );
}
