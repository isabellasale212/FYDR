import Link from 'next/link';
import { NewInjuryForm } from '@/components/NewInjuryForm/NewInjuryForm';
import { requireInjuryAccess } from '@/lib/session';
import { CLINICAL_ONLY, SITE_ALWAYS, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New injury · Fydr' };

/** screens/27-new-injury.md. Every injury role reaches it (INJURY_ACCESS,
 *  requireInjuryAccess — §3.2 gives "+ Log injury" to all four); the form
 *  itself is split by permission (PATTERN-S3 C9): the clinical column and the
 *  availability block are the medic's, the body site follows the club's
 *  coach-sees-site setting (C8). */
type SearchParams = Promise<{ athlete?: string }>;

export default async function NewInjuryPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireInjuryAccess();
  const params = await searchParams;

  const [athletesRes, siteRow] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club')
      .order('last_name'),
    /* C8: the coach's site fields follow the club's setting, as the list does. */
    db.from('organisations').select('coach_sees_injury_site').eq('id', orgId).maybeSingle(),
  ]);
  const { data: athletes, error } = athletesRes;
  if (error) throw new Error(error.message);
  const siteVisible = hasAnyRole(claims.roles, SITE_ALWAYS) || siteRow.data?.coach_sees_injury_site === true;

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
        clinical={hasAnyRole(claims.roles, CLINICAL_ONLY)}
        siteVisible={siteVisible}
      />
    </>
  );
}
