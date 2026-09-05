import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserManagementPanel } from '@/components/UserManagementPanel/UserManagementPanel';
import { fetchUnlinkedAthletes, fetchUsersWithRoles } from '@/lib/queries/userManagement';
import { requireStaff } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Users · Fydr' };

/** docs/screens/user-management.md, screen 32 — "the only screen in Fydr
 *  restricted to a single role." lib/queries/userManagement.ts's header has
 *  the full list of what this pass builds and what it cuts against the
 *  much larger spec (invite email/SMS, a dedicated detail page, role
 *  history). Bulk CSV invite is no longer one of the cuts — see "Bulk
 *  invite athletes" below and settings/users/bulk-invite/. Admin only,
 *  enforced here (redirect) and at every RLS policy the writes go through
 *  — a coach or medical staffer who guesses the URL gets bounced, the same
 *  two-layer pattern GPS import's coach/medical gate already uses. */
export default async function UsersPage() {
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!claims.roles.includes('sport_scientist')) redirect('/settings');

  const [users, unlinked] = await Promise.all([fetchUsersWithRoles(db, orgId), fetchUnlinkedAthletes(db, orgId)]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Users
          </p>
          <h1>Users</h1>
        </div>
      </div>

      <UserManagementPanel
        orgId={orgId}
        currentUserId={claims.userId}
        currentActorRole={'sport_scientist' as AppRole}
        initialUsers={users}
        initialUnlinked={unlinked}
        timezone={timezone}
      />
    </>
  );
}
