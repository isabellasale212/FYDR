import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewTemplateForm } from '@/components/NewTemplateForm/NewTemplateForm';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New week template · Fydr' };

export default async function NewWeekTemplatePage() {
  const { orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) redirect('/schedule/planner');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule/planner">Week templates</Link> · New
          </p>
          <h1>New week template</h1>
        </div>
      </div>

      <NewTemplateForm orgId={orgId} userId={claims.userId} />
    </>
  );
}
