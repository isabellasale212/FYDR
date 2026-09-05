import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BulkInviteForm } from '@/components/BulkInviteForm/BulkInviteForm';
import { fetchUnlinkedAthletes } from '@/lib/queries/userManagement';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Bulk invite · Fydr' };

/** docs/screens/user-management.md's "Bulk invite" section — the gap named
 *  when Users itself first shipped ("No bulk CSV invite, a real separate
 *  feature on its own"). Admin only, same gate as every other write in
 *  this feature (settings/users/page.tsx). Athlete accounts only: the
 *  spec's own title for this screen is "Invite athletes", distinct from
 *  the any-role InviteWizard already built into the main Users list. */
export default async function BulkInvitePage() {
  const { db, orgId, claims } = await requireStaff();
  if (!claims.roles.includes('sport_scientist')) redirect('/settings');

  const unlinked = await fetchUnlinkedAthletes(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/users">Users</Link> · Bulk invite
          </p>
          <h1>Invite athletes</h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 14 }}>
        Paste one row per athlete, or upload a CSV — email, first name, last name, squad number, date of birth. Up to
        100 at a time. A name that exactly matches an existing squad record with no account yet links to it;
        otherwise a new record is created. Date of birth is required even for a match with no date on file yet — an
        account can&apos;t go live until it&apos;s known whether under-18 protections apply.
      </p>

      <BulkInviteForm unlinkedAthletes={unlinked} />
    </>
  );
}
