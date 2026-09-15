import type { Metadata } from 'next';
import { AthleteProfileEditForm } from '@/components/AthleteProfileEditForm/AthleteProfileEditForm';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { requireAthlete } from '@/lib/session';

export const metadata: Metadata = { title: 'Profile settings · Fydr' };

/* Profile settings — its own page behind a row on Me (Isabella, 15 Sept
 * 2026, mobile queue #11): the photo, the phone number and the password,
 * which Me carried inline as three stacked forms. Nothing new is written
 * here; the three forms are the ones Me had, moved. Forms stay pages
 * (B11): each form still submits on its own button, no auto-advance.
 *
 * "Reset password" is the existing ChangePasswordForm — the athlete sets a
 * new password from a signed-in session; the signed-out reset stays at
 * /login/reset. */
export default async function ProfileSettingsPage() {
  const { db, orgId, claims, firstName, lastName } = await requireAthlete();
  const userRow = await db.from('users').select('full_name, phone, avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle();
  const fullName = userRow.data?.full_name ?? `${firstName} ${lastName}`;

  return (
    <>
      <div className="hd">
        <h1 className="d">Profile settings</h1>
      </div>
      <div className="stack">
        <AvatarUploadForm
          orgId={orgId}
          userId={claims.userId}
          fullName={fullName}
          initialAvatarUrl={userRow.data?.avatar_url ?? null}
          initialAvatarColour={userRow.data?.avatar_colour ?? null}
        />
        <AthleteProfileEditForm userId={claims.userId} fullName={fullName} initialPhone={userRow.data?.phone ?? ''} />
        <ChangePasswordForm />
      </div>
    </>
  );
}
