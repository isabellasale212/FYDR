import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThresholdEditorForm } from '@/components/ThresholdEditorForm/ThresholdEditorForm';
import { requireStaff } from '@/lib/session';
import { THRESHOLD_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New threshold · Fydr' };

export default async function NewThresholdPage() {
  const { orgId, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, THRESHOLD_EDIT)) redirect('/settings/thresholds');

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
