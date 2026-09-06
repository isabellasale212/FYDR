import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { fetchSquadNumbersInUse } from '@/lib/queries/squad';
import { AddAthleteForm } from '@/components/AddAthleteForm/AddAthleteForm';

/** Screen 63, Add athlete, at /squad/new.
 *
 *  The first way this app has ever had of putting a player on the roster. Until
 *  now there was no screen, no route and no insert into `athletes` anywhere,
 *  which is decision D-16 and the reason a club could not be onboarded at all.
 *
 *  SPORT SCIENTIST ONLY, and the same set that gates Club details and Users
 *  rather than a new one. §2: "an administration action, not a coaching one".
 *  A coach still edits an athlete's details once the record exists —
 *  ATHLETE_BIO_EDIT — which is the distinction the spec draws, so the two must
 *  not be collapsed into one set later.
 *
 *  A redirect rather than a rendered refusal, because this page is reached from
 *  a button that only the sport scientist is shown: anybody else arriving here
 *  typed the URL, and has nothing to read on a page whose entire content is a
 *  form they may not submit. That is the opposite of the reports hub, where the
 *  cards are worth seeing even when they cannot be opened.
 *
 *  The squad numbers already in use are read here and handed to the form, so a
 *  clash can name its holder while the number is being typed. Migration 0077's
 *  unique index is what actually enforces it; this is the courtesy. */
export default async function AddAthletePage() {
  const { db, orgId, orgName, claims } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) redirect('/squad');

  const taken = await fetchSquadNumbersInUse(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Add athlete</h1>
        </div>
      </div>
      <AddAthleteForm takenNumbers={taken} />
    </>
  );
}
