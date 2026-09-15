import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThresholdEditorForm } from '@/components/ThresholdEditorForm/ThresholdEditorForm';
import { requireStaff } from '@/lib/session';
import { BODY_MASS_VIEW, THRESHOLD_EDIT, hasAnyRole } from '@/lib/access';
import { todayIso } from '@/lib/format';

export const metadata = { title: 'New threshold · Fydr' };

export default async function NewThresholdPage() {
  const { orgId, claims, timezone } = await requireStaff();
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

      <ThresholdEditorForm orgId={orgId} userId={claims.userId} today={todayIso(timezone)} canSeeBodyMass={hasAnyRole(claims.roles, BODY_MASS_VIEW)} />
    </>
  );
}
