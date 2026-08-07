import Link from 'next/link';
import { GroupEditorForm } from '@/components/GroupEditorForm/GroupEditorForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New group · Fydr' };

export default async function NewGroupPage() {
  const { orgId } = await requireStaff();

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/groups">Groups</Link> · New
          </p>
          <h1>New group</h1>
        </div>
        <ThemeToggle />
      </div>

      <GroupEditorForm orgId={orgId} />
    </>
  );
}
