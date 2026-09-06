import Link from 'next/link';
import { NewInjuryForm } from '@/components/NewInjuryForm/NewInjuryForm';
import { requireInjuryAccess } from '@/lib/session';

export const metadata = { title: 'New injury · Fydr' };

/** screens/injury-record.md: "Injury dashboard, '+ Injury' | Tap | Create mode,
 *  athlete picker". Medical only — a coach reaching this URL directly is sent back,
 *  the same treatment as every other medical-only write path in this build. */
type SearchParams = Promise<{ athlete?: string }>;

export default async function NewInjuryPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireInjuryAccess();
  const params = await searchParams;


  const { data: athletes, error } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club')
    .order('last_name');
  if (error) throw new Error(error.message);

  /* Validated against the athletes this page already fetched rather than
     trusted from the URL. That list is org-scoped, excludes soft-deleted rows
     and excludes anyone who has left, so a stale bookmark, a hand-edited id or
     an athlete from another club all fall through to "no pre-selection" instead
     of putting a name on a medical record that should not carry it. Cheap,
     because the round trip already happened. */
  const requested = typeof params.athlete === 'string' ? params.athlete : undefined;
  const initialAthleteId = (athletes ?? []).some((a) => a.id === requested) ? requested : undefined;

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

      <NewInjuryForm
        orgId={orgId}
        userId={claims.userId}
        timezone={timezone}
        athletes={athletes ?? []}
        initialAthleteId={initialAthleteId}
      />
    </>
  );
}
