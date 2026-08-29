import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NutritionTargetForm } from '@/components/NutritionTargetForm/NutritionTargetForm';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New nutrition target · Fydr' };

export default async function NewNutritionTargetPage() {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  if (!isCoach && !isMedical) {
    redirect('/nutrition');
  }

  const [athletes, groups] = await Promise.all([
    fetchSquadList(db, orgId, []),
    fetchGroups(db, orgId),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/nutrition">Nutrition</Link> · New target
          </p>
          <h1>New nutrition target</h1>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      <div className="card">
        <NutritionTargetForm
          orgId={orgId}
          userId={claims.userId}
          athletes={athletes}
          groups={groups}
          canPickAnyScope={isCoach}
          timezone={timezone}
        />
      </div>
    </>
  );
}
