import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewInjuryForm } from '@/components/NewInjuryForm/NewInjuryForm';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New injury · Fydr' };

/** screens/injury-record.md: "Injury dashboard, '+ Injury' | Tap | Create mode,
 *  athlete picker". Medical only — a coach reaching this URL directly is sent back,
 *  the same treatment as every other medical-only write path in this build. */
export default async function NewInjuryPage() {
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!claims.roles.includes('medical')) redirect('/injuries');

  const { data: athletes, error } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club')
    .order('last_name');
  if (error) throw new Error(error.message);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · New
          </p>
          <h1>New injury record</h1>
        </div>
      </div>

      <NewInjuryForm orgId={orgId} userId={claims.userId} timezone={timezone} athletes={athletes ?? []} />
    </>
  );
}
