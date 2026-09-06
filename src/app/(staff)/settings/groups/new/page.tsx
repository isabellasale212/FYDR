import Link from 'next/link';
import { GROUP_EDIT, hasAnyRole } from '@/lib/access';
import { GroupEditorForm } from '@/components/GroupEditorForm/GroupEditorForm';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New group · Fydr' };

export default async function NewGroupPage() {
  const { orgId, claims } = await requireStaff();
  /* A redirect rather than a rendered refusal: the whole content of this page is
     a form the other three roles may not submit, and they arrive here only by
     typing the URL, since the link is hidden from them. Same reasoning as
     /squad/new. Migration 0078 is the authorisation; this is the tidiness. */
  if (!hasAnyRole(claims.roles, GROUP_EDIT)) redirect('/settings/groups');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/groups">Groups</Link> · New
          </p>
          <h1>New group</h1>
        </div>
      </div>

      <GroupEditorForm orgId={orgId} />
    </>
  );
}
