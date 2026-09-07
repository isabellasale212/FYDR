import { redirect } from 'next/navigation';
import { fetchEstablishedTitles } from '@/lib/queries/sessionTitles';
import Link from 'next/link';
import { NewSessionForm } from '@/components/NewSessionForm/NewSessionForm';
import { fetchGroups } from '@/lib/queries/groups';
import { todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New session · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, claims, timezone } = await requireStaff();
  /* creating a session is sessions_staff_insert — the sport scientist and the coach (0070). Offering the form and refusing the save is the G-34 shape. */
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) redirect('/schedule');
  const params = await searchParams;
  const defaultDate =
    typeof params.date === 'string' ? params.date : todayIso(timezone);

  const groups = await fetchGroups(db, orgId);

  /* The club's own established session names, for the title field's
     datalist. Read here rather than in the client component so it is one
     server-side query on a page that is already fetching groups. */
  const titleSuggestions = await fetchEstablishedTitles(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · New
          </p>
          <h1>New session</h1>
        </div>
      </div>

      <NewSessionForm
        titleSuggestions={titleSuggestions}
        orgId={orgId}
        userId={claims.userId}
        groups={groups}
        defaultDate={defaultDate}
        timezone={timezone}
      />
    </>
  );
}
