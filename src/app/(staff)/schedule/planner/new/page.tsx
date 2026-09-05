import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewTemplateForm } from '@/components/NewTemplateForm/NewTemplateForm';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New week template · Fydr' };

export default async function NewWeekTemplatePage() {
  const { orgId, claims } = await requireStaff();
  if (!claims.roles.includes('coach') && !claims.roles.includes('medic')) redirect('/schedule/planner');

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
