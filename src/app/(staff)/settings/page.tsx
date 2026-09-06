import Link from 'next/link';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ClubDetailsEditForm } from '@/components/ClubDetailsEditForm/ClubDetailsEditForm';
import { MfaEnrollment } from '@/components/MfaEnrollment/MfaEnrollment';
import { StaffProfileEditForm } from '@/components/StaffProfileEditForm/StaffProfileEditForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchThresholds } from '@/lib/queries/thresholds';
import { mfaRequiredForRoles } from '@/lib/mfa';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import { PlanPreviewSwitch } from '@/components/PlanPreviewSwitch/PlanPreviewSwitch';
import { isPlatformStaff } from '@/lib/platformStaff';
import { GPS_IMPORT, REPORT_ACCESS, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Settings · Fydr' };

/** SETTINGS-SPEC.md, rebuilt from the ground up: the Plan card (real
 * organisations.tier, read-only — see lib/tier.ts's own header for why
 * this doesn't self-serve), the Integrations card (Catapult and CSV import
 * are real, linking to the GPS import screen this app already has; Apple
 * Health has no integration to connect to and says so), and the row list
 * (Thresholds and Log out are real; Passwords jumps to the real password
 * form below, which now sits beside a real "Two-factor authentication" card
 * (MfaEnrollment) rather than the "2FA policy screen this build doesn't
 * have" this comment used to say — login-security checklist item 3;
 * Exports now links to a real builder at /settings/exports — job 1 of
 * docs/screens/exports.md, see that route's own header for scope. Coach or
 * medical only, same gate as every report page: an admin-only row shows the
 * reason rather than a dead link).
 *
 * The previous version of this page (screens/settings.md, screen 29) had
 * roughly ten real, working features this new design's three cards don't
 * show at all: Groups, GPS imports, Notifications, Users, Subject access
 * requests, Data retention, Club details, and this person's own profile
 * and password. None of that is speculative or a mockup — every one of
 * those links goes to a real screen with real data behind it, some with
 * their own hard-won bug fixes earlier this build. Deleting them to match
 * a 3-card mockup would be a real regression dressed up as a redesign, so
 * they're preserved: appended to the row list as more real rows (the same
 * "navigate to a sub-screen" shape the spec's own four rows already use),
 * or kept as their own real edit-in-place cards below, for the two things
 * that are forms rather than navigation (profile/avatar, club details). */
export default async function SettingsPage() {
  const { db, orgId, orgName, timezone, fullName, claims, tier, realTier, previewingTier } = await requireStaff();
  const isAdmin = claims.roles.includes('sport_scientist');
  const onPremium = isPremium(tier);
  /* Not `isAdmin`: a club's own administrator does not get to try the other
     plan on. lib/platformStaff.ts has the reasoning; requireStaff() enforces
     the same rule on the cookie, so this only decides whether the control is
     drawn. Premium-only because the preview is downgrade-only — offering it to
     a Basic club would be a switch that provably cannot do anything. */
  const canPreviewTier = isPlatformStaff(claims.email) && isPremium(realTier);

  const [userRow, orgRow, athleteCount, activeThresholds, mfaFactors] = await Promise.all([
    db.from('users').select('phone, avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
    isAdmin
      ? db.from('organisations').select('name, sport, timezone, country_code, logo_url').eq('id', orgId).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('athletes')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club'),
    fetchThresholds(db, orgId, false),
    db.auth.mfa.listFactors(),
  ]);

  const squadSize = athleteCount.count ?? 0;
  const roleRequiresMfa = mfaRequiredForRoles(claims.roles);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            Organisation · {orgName} · {squadSize} athlete{squadSize === 1 ? '' : 's'}
          </p>
          <h1>Settings</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* A notice used to sit here telling an admin-only user their sidebar had
          three rows on purpose. Removed 2026-09-05: the sport scientist that role
          became has every row, so the notice was telling the least restricted
          role in the product that it was the most restricted. */}

      <div className="set-body">
        {/* -------- §3 Plan card -------- */}
        <section className="card set-card" aria-labelledby="plan-title" id="plan">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="card-title" id="plan-title" style={{ margin: 0 }}>
                Plan
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>
                {onPremium
                  ? 'Premium · GPS, the training report, the analytics bar chart and Apple Health are on.'
                  : 'Basic · wellness, gym, nutrition, schedule, reports and exports.'}
              </p>
              {/* Never let a preview be mistaken for the real plan. Without
                  this, an admin who forgot the switch was on would find GPS
                  and the training report gone and reasonably report it as a
                  fault. Says what is happening and how to undo it. */}
              {previewingTier ? (
                <p className="pill" style={{ background: 'var(--wash-warn)', color: 'var(--warn-pill-text)', marginTop: 8 }}>
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
              <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Basic</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Premium</p>
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
                <span>Apple Health connection</span>
              </div>
            </div>
          </div>

        </section>

        {/* -------- §4 Integrations card -------- */}
        <section className="card set-card" aria-labelledby="integrations-title">
          <h2 className="card-title" id="integrations-title" style={{ margin: 0 }}>
            Integrations
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 0' }}>
            Devices and files that write into Fydr.
          </p>

          <div style={{ marginTop: 12 }}>
            <div className="set-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Catapult Openfield</span>
                  {!onPremium ? <span className="gold-badge">Premium</span> : null}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  GPS session files, CSV import
                </p>
              </div>
              {onPremium ? (
                <Link href="/settings/imports" className="set-row-btn" data-variant="connected">
                  Connected
                </Link>
              ) : (
                <Link href="/settings/imports" className="set-row-btn" data-variant="locked">
                  Locked
                </Link>
              )}
            </div>

            <div className="set-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Apple Health</span>
                  {!onPremium ? <span className="gold-badge">Premium</span> : null}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  Sleep, resting heart rate and body mass from the athlete&apos;s phone
                </p>
              </div>
              {/* NO BUTTON HERE, DELIBERATELY. This row used to offer "Connect",
               *  disabled, with a title explaining that the connection needs the
               *  athlete mobile app. That was a control a coach could never make
               *  work: Apple Health is a connection to ONE PERSON'S PHONE, so
               *  only that person can make it. The athlete now does it in their
               *  own Me tab (src/app/(athlete)/me/page.tsx).
               *
               *  It also cannot report state. Migration 0012's athlete_consents
               *  note is explicit — "Coach and medical get nothing: a consent
               *  state is not performance data and knowing that an athlete
               *  declined HealthKit sync tells a coach nothing they are entitled
               *  to act on" — so there is no connected count here and no per
               *  athlete indicator. RLS would refuse the read anyway; this row
               *  does not ask for it.
               *
               *  The tier gate stays, because the tier is genuinely the club's:
               *  what the plan buys is whether athletes are offered it at all. */}
              {onPremium ? (
                <span className="tiny" style={{ color: 'var(--faint)', textAlign: 'right', maxWidth: 260 }}>
                  Each athlete turns this on in their own Me tab
                </span>
              ) : (
                <span
                  className="set-row-btn"
                  data-variant="locked"
                  style={{ cursor: 'default' }}
                  title="Apple Health is a Premium feature. Plan changes are a sales conversation with your Fydr contact."
                >
                  Locked
                </span>
              )}
            </div>

            {/* This row was the only link to /settings/imports with no badge
                and no tier condition, and it described a feature that page
                does not offer — /settings/imports is the GPS vendor importer,
                not a roster or wellness importer, and there is no such screen
                to point at. Relabelled to what it actually opens, and given
                the same Premium treatment as the two GPS rows beside it. */}
            <div className="set-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Vendor CSV import</span>
                  {!onPremium ? <span className="gold-badge">Premium</span> : null}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
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

        {/* -------- §5 Row list card, extended with the real settings the
             new design doesn't show a place for — see this file's own
             header for why they're kept rather than dropped. -------- */}
        <section className="card set-card" style={{ padding: '6px 18px 6px' }} aria-label="More settings">
          <Link href="/settings/thresholds" className="set-list-row">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Thresholds</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>The rules that raise a flag</span>
            </span>
            {/* An amber pill, not faint text. "Fydr Settings.dc.html" gives this
                count the warn pill (fill 0.28, text #6b4708) — which is what
                .pill-warn already resolves to — because the number of live
                thresholds is a standing state a coach should be able to read
                without hunting for it, and at --faint it read as a caption. */}
            <span className="pill pill-warn num">{activeThresholds.length} active</span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </Link>

          <a href="#password" className="set-list-row">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Password and two-factor</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Staff sign in</span>
            </span>
            <span className="num" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              {(mfaFactors.data?.totp.length ?? 0) > 0 ? 'On' : roleRequiresMfa ? 'Required' : '—'}
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </a>

          {/* §3.6 Exports is V for four roles and X for the nutritionist, and the
              page behind this gates on requireReportAccess(). This link was
              coach-or-medic, so the sport scientist and the S&C were shown no way
              in to a page that would have let them straight through. */}
          {hasAnyRole(claims.roles, REPORT_ACCESS) ? (
            <Link href="/settings/exports" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Exports</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Pick what, pick who, pick when, get a CSV</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : (
            <div className="set-list-row" data-disabled="true" aria-disabled="true" title="Requires a role with athlete-level export access, see the access matrix.">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block', color: 'var(--faint)' }}>Exports</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Coach or medical role required</span>
              </span>
              <span className="num" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                —
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }} />
            </div>
          )}

          <Link href="/settings/groups" className="set-list-row">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Groups</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>The named subsets every filter uses</span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </Link>

          {/* §3.6 Import GPS is VC for the sport scientist alone. This link was
              shown to the coach and the medic, whom the route refuses, and hidden
              from the role that owns it. Approved 2026-09-05. */}
          {hasAnyRole(claims.roles, GPS_IMPORT) ? (
            <Link href="/settings/imports" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>GPS imports</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Upload a vendor CSV export</span>
              </span>
              {!onPremium ? <span className="gold-badge">Premium</span> : null}
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : null}

          <Link href="/settings/notifications" className="set-list-row">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Notifications</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>What pushes and emails you get</span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </Link>

          {isAdmin ? (
            <Link href="/settings/users" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Users</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Who can sign in, and what roles they hold</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : null}

          {isAdmin || claims.roles.includes('medic') ? (
            <Link href="/settings/subject-access" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Subject access requests</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Article 15 requests and their deadline</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : null}

          {isAdmin ? (
            <Link href="/settings/retention" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Data retention</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>The club&apos;s retention schedule</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : null}

          {isAdmin ? (
            <Link href="/settings/audit" className="set-list-row">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Audit log</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Who did what, and to what, across the club</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </Link>
          ) : null}

          <form action="/auth/sign-out" method="post" className="set-list-row" style={{ width: '100%' }}>
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block', color: 'var(--bad-text)' }}>Log out</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Ends this session on this browser only</span>
            </span>
            <button
              type="submit"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
              aria-label="Log out"
            >
              <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
                ›
              </span>
            </button>
          </form>
        </section>

        {/* -------- Real, preserved: profile, avatar, club details, password.
             Edit-in-place forms, not navigation targets, so they stay as
             their own cards rather than row-list entries. -------- */}
        <section className="card" aria-labelledby="profile-title">
          <h2 className="card-title" id="profile-title">
            Profile
          </h2>
          <div className="kv">
            <span className="sub">Name</span>
            <span className="sub">{fullName || '—'}</span>
          </div>
          <div className="kv">
            <span className="sub">Club</span>
            <span className="sub">{orgName}</span>
          </div>
          <div className="kv">
            <span className="sub">Role</span>
            <span className="sub">{claims.roles.join(', ') || '—'}</span>
          </div>
          <div className="kv">
            <span className="sub">Timezone</span>
            <span className="sub">{timezone}</span>
          </div>
        </section>

        {/* initialAvatarColour is not optional in practice: pickColour writes
            users.avatar_colour immediately, so omitting it left the picker
            reopening on "Default" — aria-pressed on the wrong chip — while the
            database held a real colour. Same read the athlete /me page does. */}
        <AvatarUploadForm orgId={orgId} userId={claims.userId} fullName={fullName} initialAvatarUrl={userRow.data?.avatar_url ?? null} initialAvatarColour={userRow.data?.avatar_colour ?? null} />
        <StaffProfileEditForm userId={claims.userId} initialFullName={fullName} initialPhone={userRow.data?.phone ?? ''} />

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

        <div id="password" className="stack">
          <ChangePasswordForm />
          <MfaEnrollment timezone={timezone} roleRequiresMfa={roleRequiresMfa} initialFactors={mfaFactors.data?.totp ?? []} />
        </div>
      </div>
    </>
  );
}
