import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { UserDetailPanel } from '@/components/UserDetailPanel/UserDetailPanel';
import { fetchSportScientistCount, fetchUnlinkedAthletes, fetchUserAuditHistory, fetchUserDetail } from '@/lib/queries/userManagement';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'User · Fydr' };

/** docs/screens/user-management.md, "User detail, web" — the wireframe
 *  this build's own Users list has pointed at as a real, named gap since
 *  it first shipped ("No dedicated per-user detail page or visible
 *  role-history timeline"). Admin only, same gate as the rest of Users.
 *  Cut against the wireframe, and real: Resend invite (no email
 *  provider), and Consent (tracked for athletes, not staff, in this
 *  schema — see lib/subjectAccess/manifest.ts's own category list, which
 *  has no staff-consent row either).
 *
 *  MFA is no longer one of the cuts (login-security checklist item 3): the row used to
 *  hardcode "Not enrolled" for every user, unconditionally, which is the specific bug this
 *  page's own header used to describe as the reason the row existed at all. It now reads
 *  supabase.auth.admin.mfa.listFactors({ userId }) — the real admin-scoped MFA API, which
 *  needs the service role key, which is why this read lives here (a Server Component this
 *  file already gates admin-only, the same "requireStaff() plus an explicit role check
 *  before the service-role client is touched" discipline settings/users/create/route.ts's
 *  own header names) rather than in lib/queries/userManagement.ts's plain RLS-scoped
 *  fetchers. */
export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) redirect('/settings');

  const [user, history, unlinked, mfaFactors, sportScientistCount] = await Promise.all([
    fetchUserDetail(db, orgId, userId),
    fetchUserAuditHistory(db, orgId, userId),
    fetchUnlinkedAthletes(db, orgId),
    createAdminClient().auth.admin.mfa.listFactors({ userId }),
    fetchSportScientistCount(db, orgId),
  ]);
  if (!user) notFound();

  const verifiedMfaFactor = (mfaFactors.data?.factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/users">Users</Link> · {user.full_name}
          </p>
          <h1>{user.full_name}</h1>
        </div>
      </div>

      <UserDetailPanel
        orgId={orgId}
        currentUserId={claims.userId}
        currentActorRole="sport_scientist"
        user={user}
        history={history}
        unlinkedAthletes={unlinked}
        isSelf={user.id === claims.userId}
        sportScientistCount={sportScientistCount}
        timezone={timezone}
        mfaFactor={verifiedMfaFactor ? { id: verifiedMfaFactor.id, created_at: verifiedMfaFactor.created_at } : null}
      />
    </>
  );
}
