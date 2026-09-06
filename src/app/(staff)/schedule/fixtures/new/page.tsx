import { redirect } from 'next/navigation';
import Link from 'next/link';
import { NewFixtureForm } from '@/components/NewFixtureForm/NewFixtureForm';
import { todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New fixture · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Sits beside /schedule/new, not under /schedule/fixtures/[fixtureId], because
 *  it creates a fixture rather than editing one — the same relationship
 *  /schedule/new has to /schedule/[sessionId]. */
export default async function NewFixturePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { orgId, claims, timezone } = await requireStaff();
  /* creating a fixture was narrowed to the same two roles by 0073. Offering the form and refusing the save is the G-34 shape. */
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) redirect('/schedule');
  const params = await searchParams;
  const defaultDate = typeof params.date === 'string' ? params.date : todayIso(timezone);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · New fixture
          </p>
          <h1>New fixture</h1>
        </div>
      </div>

      <NewFixtureForm
        orgId={orgId}
        userId={claims.userId}
        defaultDate={defaultDate}
        timezone={timezone}
      />
    </>
  );
}
