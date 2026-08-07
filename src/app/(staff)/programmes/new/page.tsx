import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProgrammeForm } from '@/components/ProgrammeForm/ProgrammeForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New programme · Fydr' };

export default async function NewProgrammePage() {
  const { orgId, orgName, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  if (!isCoach && !isMedical) {
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
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      <div className="card">
        <ProgrammeForm orgId={orgId} userId={claims.userId} isCoach={isCoach} isMedical={isMedical} />
      </div>
    </>
  );
}
