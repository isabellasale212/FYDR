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
  const { db, orgId, orgName, timezone, fullName, claims, tier } = await requireStaff();
  const isAdmin = claims.roles.includes('admin');
  const isAdminOnly = isAdmin && !claims.roles.includes('coach') && !claims.roles.includes('medical');
  const onPremium = isPremium(tier);

  const [userRow, orgRow, athleteCount, activeThresholds, mfaFactors] = await Promise.all([
    db.from('users').select('phone, avatar_url').eq('id', claims.userId).maybeSingle(),
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

      {isAdminOnly ? (
        // Governance finding 8 / lib/supabase/claims.ts homeRoute(): an
        // admin-only sign-in lands here now instead of /dashboard, which
        // isn't in this sidebar at all. Worth saying so in the same honest
        // register /flags and /reports already use for the reverse case —
        // this is the "here's why your nav is small" line, not an apology.
        <div className="note" style={{ marginBottom: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>Your sidebar has three rows on purpose.</b> Admin manages the club — users,
            billing, retention, the audit log — and deliberately does not read athlete
            wellness, load, gym, nutrition or medical detail, see
            01-roles-and-permissions.md §1. Reports and Leaderboard show what admin can see
            of each; hold a coach or medical role as well to open the rest.
          </p>
        </div>
      ) : null}

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
                  ? 'Premium · GPS, the training report and heatmaps are on.'
                  : 'Basic · wellness, gym, nutrition, schedule, reports, bar charts and Apple Health.'}
              </p>
            </div>
            <div className="plan-switch" title="Plan changes are a sales conversation with your Fydr contact, not a self-service toggle — see the note below.">
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
                <span>Analytics · bar charts</span>
                <span>Settings and exports</span>
                <span>Apple Health connection</span>
              </div>
            </div>
            <div className="plan-compare-card" data-active={onPremium}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Premium</p>
                <span className="gold-badge">everything in Basic, plus</span>
              </div>
              <div className="plan-compare-list">
                <span>GPS exports</span>
                <span>Training report</span>
                <span>Analytics · heatmaps</span>
              </div>
            </div>
          </div>

          <p className="cap" style={{ marginTop: 14 }}>
            Plan changes are a sales conversation with your Fydr contact, not a self-service toggle —
            billing decisions like this one aren&apos;t something a club flips on its own.
          </p>
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
                <span style={{ fontSize: 14, fontWeight: 600 }}>Apple Health</span>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  Sleep, resting heart rate and body mass from the athlete&apos;s phone
                </p>
              </div>
              {/* No tier gate here, on either plan — O-862 (12-product-tiers.md §3.4)
               *  asked the client to confirm HealthKit's placement, calling it "the
               *  weakest line in Premium": near-zero marginal cost, athlete-initiated,
               *  and section 4.3's own athlete-features principle argues for Basic.
               *  Resolved: HealthKit moved to Basic, available regardless of tier.
               *  Still honestly disabled either way -- the connection itself needs the
               *  athlete mobile app, which this build doesn't have (same reason this
               *  button has always been disabled, unrelated to billing). */}
              <button type="button" className="set-row-btn" data-variant="connect" disabled aria-disabled="true" title="HealthKit connection requires the athlete mobile app, which isn't available yet.">
                Connect
              </button>
            </div>

            <div className="set-row">
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>CSV import</span>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  Squad roster, historic wellness and test results
                </p>
              </div>
              <Link href="/settings/imports" className="set-row-btn">
                Open
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
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              {activeThresholds.length} active
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </Link>

          <a href="#password" className="set-list-row">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Password and two-factor</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Staff sign in</span>
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              {(mfaFactors.data?.totp.length ?? 0) > 0 ? 'On' : roleRequiresMfa ? 'Required' : '—'}
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </a>

          {claims.roles.includes('coach') || claims.roles.includes('medical') ? (
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
            <div className="set-list-row" data-disabled="true" aria-disabled="true" title="Requires the coach or medical role, per 01-roles-and-permissions.md §1.">
              <span>
                <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block', color: 'var(--faint)' }}>Exports</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Coach or medical role required</span>
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
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

          {claims.roles.includes('coach') || claims.roles.includes('medical') ? (
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

          {isAdmin || claims.roles.includes('medical') ? (
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

        <AvatarUploadForm orgId={orgId} userId={claims.userId} fullName={fullName} initialAvatarUrl={userRow.data?.avatar_url ?? null} />
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
