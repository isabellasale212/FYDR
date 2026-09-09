import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProgrammeForm } from '@/components/ProgrammeForm/ProgrammeForm';
import { requireStaff } from '@/lib/session';
import { PROGRAMME_AUTHOR, PROGRAMME_EDIT, REHAB_PROGRAMME, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New programme · Fydr' };

export default async function NewProgrammePage() {
  const { orgId, orgName, claims } = await requireStaff();
  /* docs/access-matrix.md §3.3, Programme builder: VEC V V VEC V. The gym
     programme belongs to the S&C and the sport scientist; a coach and a medic
     read it but do not build it. This gate used to admit coach or medic, which
     was the four-role model's way of saying "any staff who is not an admin". */
  if (!hasAnyRole(claims.roles, PROGRAMME_AUTHOR)) {
    redirect('/programmes');
  }

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> · New programme
          </p>
          <h1>New programme</h1>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 'var(--sp-14)' }}>
        Squad · {orgName}
      </p>

      <div className="card">
        <ProgrammeForm
          orgId={orgId}
          userId={claims.userId}
          canCreateGym={hasAnyRole(claims.roles, PROGRAMME_EDIT)}
          canCreateRehab={hasAnyRole(claims.roles, REHAB_PROGRAMME)}
        />
      </div>
    </>
  );
}
