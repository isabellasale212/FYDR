import Link from 'next/link';
import { AthleteProfileEditForm } from '@/components/AthleteProfileEditForm/AthleteProfileEditForm';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { fetchAthlete } from '@/lib/queries/squad';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Me · Fydr' };

/** screens/settings.md, the athlete's Me tab. Same scope note as the staff
 *  Settings screen: password change is what Phase 0 actually asks for here.
 *  "Export my data" was added once 09-security-and-compliance.md's Article
 *  20 gave it a concrete, small shape — see
 *  src/app/(athlete)/me/export/route.ts. Notifications followed once
 *  08-notifications.md's own catalogue gave it a real shape — see
 *  src/app/(athlete)/me/notifications/page.tsx for what's real there and
 *  what still isn't (nothing sends a push or an email yet). Profile
 *  editing followed once migrations 0027-0029 gave preferred_name a real,
 *  database-backed write path — see
 *  src/components/AthleteProfileEditForm/AthleteProfileEditForm.tsx and
 *  lib/queries/profile.ts for what's editable and what still isn't (legal
 *  name, date of birth, position, squad number). A real photo upload
 *  followed once migration 0030 gave avatar_url a Storage bucket to point
 *  at (see lib/queries/avatar.ts). Privacy controls are still named
 *  honestly as not built. */
export default async function MePage() {
  const { db, orgId, athleteId, claims, firstName, lastName, timezone } = await requireAthlete();

  const [athlete, userRow] = await Promise.all([
    fetchAthlete(db, orgId, athleteId),
    db.from('users').select('full_name, phone, avatar_url').eq('id', claims.userId).maybeSingle(),
  ]);

  return (
    <>
      <div className="hd">
        <h1 className="d">Me</h1>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <section className="card" aria-labelledby="profile-title">
          <h2 className="card-title" id="profile-title">
            Profile
          </h2>
          <div className="kv">
            <span className="sub">Legal name</span>
            <span className="sub">
              {firstName} {lastName}
            </span>
          </div>
          <div className="kv">
            <span className="sub">Timezone</span>
            <span className="sub">{timezone}</span>
          </div>
        </section>

        <AvatarUploadForm
          orgId={orgId}
          userId={claims.userId}
          fullName={userRow.data?.full_name ?? `${firstName} ${lastName}`}
          initialAvatarUrl={userRow.data?.avatar_url ?? null}
        />

        <AthleteProfileEditForm
          userId={claims.userId}
          athleteId={athleteId}
          fullName={userRow.data?.full_name ?? `${firstName} ${lastName}`}
          initialPreferredName={athlete?.preferred_name ?? ''}
          initialPhone={userRow.data?.phone ?? ''}
        />

        <ChangePasswordForm />

        <section className="card" aria-labelledby="export-title">
          <h2 className="card-title" id="export-title">
            Your data
          </h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            Download everything you&apos;ve submitted yourself &mdash; wellness check-ins, training ratings, gym sets, and
            nutrition check-ins and targets &mdash; as a CSV file.
          </p>
          <a href="/me/export" className="btn-ghost">
            Export my data
          </a>
        </section>

        <section className="card" aria-labelledby="notifications-title">
          <h2 className="card-title" id="notifications-title">
            Notifications
          </h2>
          <p className="import-sub" style={{ marginBottom: 10 }}>
            Choose what pushes and emails you get, or pause everything except availability changes and privacy notices.
          </p>
          <Link href="/me/notifications" className="btn-ghost">
            Manage notifications →
          </Link>
        </section>

        <section className="card" aria-labelledby="more-title">
          <h2 className="card-title" id="more-title">
            Not built yet
          </h2>
          <p className="cap">Privacy controls. Gets its own pass.</p>
        </section>
      </div>
    </>
  );
}
