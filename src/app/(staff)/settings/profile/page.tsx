import Link from 'next/link';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { MfaEnrollment } from '@/components/MfaEnrollment/MfaEnrollment';
import { StaffProfileEditForm } from '@/components/StaffProfileEditForm/StaffProfileEditForm';
import { mfaRequiredForRoles } from '@/lib/mfa';
import { requireStaff } from '@/lib/session';
import { staffRoleLabel } from '@/lib/access';

export const metadata = { title: 'Your account · Settings · Fydr' };

/** PATTERN-S8 C2 (2026-09-13): the hub became four groups on one screen, and
 *  the long forms moved one level down. This is the You level: this person's
 *  profile and avatar, their phone, their password, and two-factor
 *  authentication (MfaEnrollment — login-security checklist item 3). Real,
 *  preserved, edit-in-place forms, moved from the hub verbatim with their
 *  reasoning. The hub's "Profile and password" row carries the two-factor
 *  state as its count and links here; `#password` anchors still resolve. */
export default async function SettingsAccountPage() {
  const { db, orgId, orgName, timezone, fullName, claims } = await requireStaff();
  const roleRequiresMfa = mfaRequiredForRoles(claims.roles);
  const [userRow, mfaFactors] = await Promise.all([
    db.from('users').select('phone, avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
    db.auth.mfa.listFactors(),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Your account
          </p>
          <h1>Your account</h1>
        </div>
      </div>

      <div className="set-body">
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
            <span className="sub">{staffRoleLabel(claims.roles)}</span>
          </div>
        </section>

      {/* initialAvatarColour is not optional in practice: pickColour writes
          users.avatar_colour immediately, so omitting it left the picker
          reopening on "Default" — aria-pressed on the wrong chip — while the
          database held a real colour. Same read the athlete /me page does. */}
      <AvatarUploadForm orgId={orgId} userId={claims.userId} fullName={fullName} initialAvatarUrl={userRow.data?.avatar_url ?? null} initialAvatarColour={userRow.data?.avatar_colour ?? null} />
      <StaffProfileEditForm userId={claims.userId} initialFullName={fullName} initialPhone={userRow.data?.phone ?? ''} />

      

      <div id="password" className="stack">
        <ChangePasswordForm />
        <MfaEnrollment timezone={timezone} roleRequiresMfa={roleRequiresMfa} initialFactors={mfaFactors.data?.totp ?? []} />
      </div>
      </div>
    </>
  );
}
