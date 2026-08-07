import Link from 'next/link';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ClubDetailsEditForm } from '@/components/ClubDetailsEditForm/ClubDetailsEditForm';
import { StaffProfileEditForm } from '@/components/StaffProfileEditForm/StaffProfileEditForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Settings · Fydr' };

/** screens/settings.md, screen 29. What Phase 0 actually scopes for this
 *  screen — "password change, log out only" — plus the things every role
 *  needs a way to reach: Groups, which otherwise has no entry point for an
 *  admin (see docs/screens/groups.md's own entry point list, "Settings,
 *  Organisation, Squad structure"), GPS import for coach/medical, added
 *  once lib/queries/gpsImport.ts's reduced-scope pipeline existed to link to,
 *  notifications, added once 08-notifications.md's own catalogue gave it a
 *  real shape, profile editing (display name, phone), added once
 *  lib/queries/profile.ts gave it a real, narrow write path, Users (admin
 *  only), added once lib/queries/userManagement.ts and the service-role
 *  account-creation route gave it a real, if reduced, shape, club details
 *  (admin only: name, sport, timezone, logo), added once
 *  lib/queries/orgDetails.ts and lib/queries/orgLogo.ts gave them real
 *  write paths — see orgDetails.ts's header for what's still cut (season
 *  dates, subscription tier) — and a real photo upload for the signed-in
 *  person, added once migration 0030 gave avatar_url a Storage bucket to
 *  point at (see lib/queries/avatar.ts), and Subject access requests
 *  (admin and medical), added once lib/queries/sarPack.ts gave
 *  09-security-and-compliance.md §6's Article 15 pack a real, if
 *  synchronous rather than worker-queued, shape — see that file's header
 *  for the reduced scope. Exports, billing and retention are named
 *  honestly as not built rather than left to look finished. */
export default async function SettingsPage() {
  const { db, orgId, orgName, timezone, fullName, claims } = await requireStaff();
  const isAdmin = claims.roles.includes('admin');

  const [userRow, orgRow] = await Promise.all([
    db.from('users').select('phone, avatar_url').eq('id', claims.userId).maybeSingle(),
    isAdmin ? db.from('organisations').select('name, sport, timezone, country_code, logo_url').eq('id', orgId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Club</p>
          <h1>Settings</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="stack">
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

        <section className="card" aria-labelledby="structure-title">
          <h2 className="card-title" id="structure-title">
            Squad structure
          </h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            The named subsets of the squad every filter in the app uses.
          </p>
          <Link href="/settings/groups" className="btn-ghost">
            Manage groups →
          </Link>
        </section>

        {claims.roles.includes('coach') ? (
          <section className="card" aria-labelledby="thresholds-title">
            <h2 className="card-title" id="thresholds-title">
              Flag rules
            </h2>
            <p className="import-sub" style={{ marginBottom: 10 }}>
              The thresholds that raise a flag when someone crosses them.
            </p>
            <Link href="/settings/thresholds" className="btn-ghost">
              Manage thresholds →
            </Link>
          </section>
        ) : null}

        {claims.roles.includes('coach') || claims.roles.includes('medical') ? (
          <section className="card" aria-labelledby="imports-title">
            <h2 className="card-title" id="imports-title">
              GPS data
            </h2>
            <p className="import-sub" style={{ marginBottom: 10 }}>
              Upload a CSV export from your GPS vendor&apos;s software.
            </p>
            <Link href="/settings/imports" className="btn-ghost">
              Manage GPS imports →
            </Link>
          </section>
        ) : null}

        <section className="card" aria-labelledby="notifications-title">
          <h2 className="card-title" id="notifications-title">
            Notifications
          </h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            Choose what pushes and emails you get for your role.
          </p>
          <Link href="/settings/notifications" className="btn-ghost">
            Manage notifications →
          </Link>
        </section>

        {isAdmin ? (
          <section className="card" aria-labelledby="users-title">
            <h2 className="card-title" id="users-title">
              Users
            </h2>
            <p className="import-sub" style={{ marginBottom: 10 }}>
              Who can sign in, what roles they hold, and whether their account is active.
            </p>
            <Link href="/settings/users" className="btn-ghost">
              Manage users →
            </Link>
          </section>
        ) : null}

        {isAdmin || claims.roles.includes('medical') ? (
          <section className="card" aria-labelledby="sar-title">
            <h2 className="card-title" id="sar-title">
              Subject access requests
            </h2>
            <p className="import-sub" style={{ marginBottom: 10 }}>
              Article 15 requests, their statutory deadline, and the clinical review a request with health data needs
              before it can be released.
            </p>
            <Link href="/settings/subject-access" className="btn-ghost">
              View requests →
            </Link>
          </section>
        ) : null}

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

        <ChangePasswordForm />

        <section className="card" aria-labelledby="more-title">
          <h2 className="card-title" id="more-title">
            Not built yet
          </h2>
          <p className="cap">Exports, billing and data retention. Each gets its own pass.</p>
        </section>
      </div>
    </>
  );
}
