import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { UserDetailPanel } from '@/components/UserDetailPanel/UserDetailPanel';
import { fetchUnlinkedAthletes, fetchUserAuditHistory, fetchUserDetail } from '@/lib/queries/userManagement';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'User · Fydr' };

/** docs/screens/user-management.md, "User detail, web" — the wireframe
 *  this build's own Users list has pointed at as a real, named gap since
 *  it first shipped ("No dedicated per-user detail page or visible
 *  role-history timeline"). Admin only, same gate as the rest of Users.
 *  Cut against the wireframe, and real: Resend invite (no email
 *  provider), MFA ("Not enrolled" is simply always true — nothing in this
 *  build's auth layer offers it), and Consent (tracked for athletes, not
 *  staff, in this schema — see lib/subjectAccess/manifest.ts's own
 *  category list, which has no staff-consent row either). */
export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { db, orgId, claims } = await requireStaff();
  if (!claims.roles.includes('admin')) redirect('/settings');

  const [user, history, unlinked] = await Promise.all([fetchUserDetail(db, orgId, userId), fetchUserAuditHistory(db, orgId, userId), fetchUnlinkedAthletes(db, orgId)]);
  if (!user) notFound();

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

      <UserDetailPanel orgId={orgId} currentUserId={claims.userId} currentActorRole="admin" user={user} history={history} unlinkedAthletes={unlinked} isSelf={user.id === claims.userId} />
    </>
  );
}
