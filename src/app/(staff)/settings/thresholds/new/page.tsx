import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThresholdEditorForm } from '@/components/ThresholdEditorForm/ThresholdEditorForm';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New threshold · Fydr' };

export default async function NewThresholdPage() {
  const { orgId, claims } = await requireStaff();
  if (!claims.roles.includes('coach')) redirect('/settings/thresholds');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/thresholds">Thresholds</Link> · New
          </p>
          <h1>New threshold</h1>
        </div>
      </div>

      <ThresholdEditorForm orgId={orgId} userId={claims.userId} />
    </>
  );
}
