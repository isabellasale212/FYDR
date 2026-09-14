import Link from 'next/link';
import { ClubDetailsEditForm } from '@/components/ClubDetailsEditForm/ClubDetailsEditForm';
import { RpeSettingSwitch } from '@/components/RpeSettingSwitch/RpeSettingSwitch';
import { InjurySiteSettingSwitch } from '@/components/InjurySiteSettingSwitch/InjurySiteSettingSwitch';
import { PlanPreviewSwitch } from '@/components/PlanPreviewSwitch/PlanPreviewSwitch';
import { requireStaff } from '@/lib/session';
import { PREMIUM_INVENTORY } from '@/lib/premiumWords';
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
  const { db, orgId, claims, tier, realTier, previewingTier, collectsRpe } = await requireStaff();
  const isAdmin = hasAnyRole(claims.roles, SETTINGS_ADMIN);
  const onPremium = isPremium(tier);
  /* Not `isAdmin`: a club's own administrator does not get to try the other
     plan on. lib/platformStaff.ts has the reasoning; requireStaff() enforces
     the same rule on the cookie, so this only decides whether the control is
     drawn. Premium-only because the preview is downgrade-only — offering it to
     a Basic club would be a switch that provably cannot do anything. */
  const canPreviewTier = isPlatformStaff(claims.email) && isPremium(realTier);
  /* The site setting is read for every role (the sentence for non-admins). */
  const siteRow = await db.from('organisations').select('coach_sees_injury_site').eq('id', orgId).maybeSingle();
  const siteSetting = siteRow.data?.coach_sees_injury_site ?? false;
  const orgRow = isAdmin
    ? await db.from('organisations').select('name, sport, timezone, country_code, logo_url, coach_sees_injury_site').eq('id', orgId).maybeSingle()
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
                ? 'Premium · the GPS import and everything built on it, and Analytics, are on.'
                : 'Basic · everything but the Premium column below.'}
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

        {/* The two columns read one list, the plan page's inventory
            (lib/premiumWords PREMIUM_INVENTORY): the Basic column is the
            product without it, the Premium column is it. Until 15 September
            2026 these lines were hand-typed here and had drifted — "Analytics
            · metric builder, trends and table" under Basic, "bar chart" under
            Premium — against a product where the whole destination is
            Premium. The plan page is where the list is explained. */}
        <div className="plan-compare">
          <div className="plan-compare-card" data-active={!onPremium}>
            <p style={{ fontSize: 'var(--fs-13)', fontWeight: 700, margin: 0 }}>Basic</p>
            <div className="plan-compare-list">
              <span>Wellness, RPE and gym logging</span>
              <span>Gym and rehab programmes</span>
              <span>Nutrition</span>
              <span>Schedule and fixtures</span>
              <span>Injuries and availability</span>
              <span>Testing and leaderboards</span>
              <span>Reports and exports</span>
              <span>Settings, users and the audit log</span>
            </div>
          </div>
          <div className="plan-compare-card" data-active={onPremium}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
              <p style={{ fontSize: 'var(--fs-13)', fontWeight: 700, margin: 0 }}>Premium</p>
              {/* The design gives this badge the WARN pill, not the highlight
                  gold the gated-row "Premium" markers use. Two different jobs:
                  those mark a row as out of reach, this labels what the
                  adjacent column contains. */}
              <span className="pill pill-warn">everything in Basic, plus</span>
            </div>
            <div className="plan-compare-list">
              {PREMIUM_INVENTORY.map((item) => (
                <span key={item.label}>{item.label}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
          <Link href="/settings/plan">What each of these is, what is kept on Basic, and the price</Link> — the plan page.
        </p>

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

        {/* The RPE club setting (2026-09-13, migration 0118): the sport
            scientist's switch; other staff read where it stands. */}
        <section className="card set-card" aria-labelledby="rpe-title" id="rpe">
          <h2 className="card-title" id="rpe-title" style={{ margin: 0 }}>
            Session RPE
          </h2>
          <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 var(--sp-10)' }}>
            Whether athletes are asked to rate each session. The base tier&apos;s only load measure rests on it.
          </p>
          {isAdmin ? (
            <RpeSettingSwitch orgId={orgId} userId={claims.userId} initial={collectsRpe} />
          ) : (
            <p className="tiny">
              {collectsRpe ? 'On — athletes rate each session on the CR-10 scale.' : 'Off — nobody is asked to rate a session.'} The sport scientist changes it.
            </p>
          )}
        </section>

        {/* PATTERN-S3 C8 (0122): body site and side are not coach-visible, a
            club setting defaulting to off. The sport scientist's switch; the
            database enforces it (injuries_staff). Other roles read the state
            from the setting row read below. */}
        <section className="card set-card" aria-labelledby="site-title" id="injury-site">
          <h2 className="card-title" id="site-title" style={{ margin: 0 }}>
            Coaches and the injury site
          </h2>
          <p style={{ fontSize: 'var(--fs-13)', color: 'var(--muted)', margin: '2px 0 var(--sp-10)' }}>
            Whether a coach reads where an athlete&apos;s injury is. Off by default: a coach reads the status, the restriction line
            and the expected return, nothing else.
          </p>
          {isAdmin ? (
            <InjurySiteSettingSwitch orgId={orgId} userId={claims.userId} initial={orgRow.data?.coach_sees_injury_site ?? false} />
          ) : (
            <p className="tiny">
              {siteSetting ? 'On — a coach reads the body site and side of an open injury.' : 'Off — a coach reads the status, the restriction line and the expected return only.'} The sport scientist changes it.
            </p>
          )}
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
