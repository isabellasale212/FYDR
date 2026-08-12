import Link from 'next/link';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ClubDetailsEditForm } from '@/components/ClubDetailsEditForm/ClubDetailsEditForm';
import { StaffProfileEditForm } from '@/components/StaffProfileEditForm/StaffProfileEditForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchThresholds } from '@/lib/queries/thresholds';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Settings · Fydr' };

/** SETTINGS-SPEC.md, rebuilt from the ground up: the Plan card (real
 * organisations.tier, read-only — see lib/tier.ts's own header for why
 * this doesn't self-serve), the Integrations card (Catapult and CSV import
 * are real, linking to the GPS import screen this app already has; Apple
 * Health has no integration to connect to and says so), and the row list
 * (Thresholds and Log out are real; Passwords jumps to the real password
 * form below rather than a 2FA policy screen this build doesn't have;
 * Exports stays honestly not built, as the previous version of this page
 * already said in its own words).
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
  const onPremium = isPremium(tier);

  const [userRow, orgRow, athleteCount, activeThresholds] = await Promise.all([
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
  ]);

  const squadSize = athleteCount.count ?? 0;

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
                  ? 'Premium · GPS, the training report, heatmaps and Apple Health are on.'
                  : 'Basic · wellness, gym, nutrition, schedule, reports and bar charts.'}
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
                <span>Apple Health connection</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Apple Health</span>
                  {!onPremium ? <span className="gold-badge">Premium</span> : null}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  Sleep, resting heart rate and body mass from the athlete&apos;s phone
                </p>
              </div>
              {onPremium ? (
                <button type="button" className="set-row-btn" data-variant="connect" disabled aria-disabled="true" title="HealthKit connection requires the athlete mobile app, which isn't available yet.">
                  Connect
                </button>
              ) : (
                <span className="set-row-btn" data-variant="locked" style={{ cursor: 'default' }}>
                  Locked
                </span>
              )}
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
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>Passwords</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Staff sign in — two-factor isn&apos;t built yet</span>
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              —
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }}>
              ›
            </span>
          </a>

          <div className="set-list-row" data-disabled="true" aria-disabled="true" title="Not available yet.">
            <span>
              <span style={{ fontSize: 14.5, fontWeight: 600, display: 'block', color: 'var(--faint)' }}>Exports</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Not built yet</span>
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              —
            </span>
            <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--faint)' }} />
          </div>

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

        <div id="password">
          <ChangePasswordForm />
        </div>
      </div>
    </>
  );
}
