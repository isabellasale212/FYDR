import Link from 'next/link';
import { NutritionTargetsList } from '@/components/NutritionTargetsList/NutritionTargetsList';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchTargets } from '@/lib/queries/nutritionTargets';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Nutrition · Fydr' };

/** screens/nutrition-plans.md, cut down hard to the Targets tab only — see
 *  lib/queries/nutritionTargets.ts's header for exactly what and why the Squad
 *  and Athlete tabs (both need logged intake that will never exist) are not
 *  here. */
export default async function NutritionPage() {
  const { db, orgId, orgName, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');

  const targets = await fetchTargets(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Nutrition targets</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isCoach || isMedical ? (
            <Link href="/nutrition/new" className="btn-primary">
              + New target
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      <p className="cap" style={{ marginBottom: 14 }}>
        Resolved athlete, then group, then whole-squad default, each optionally narrowed to
        one day. An athlete sees their own resolved target on Today &mdash; nothing is logged
        against these, guidance only.
      </p>

      <NutritionTargetsList orgId={orgId} targets={targets} isCoach={isCoach} isMedical={isMedical} />
    </>
  );
}
