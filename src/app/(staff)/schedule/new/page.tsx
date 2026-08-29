import Link from 'next/link';
import { NewSessionForm } from '@/components/NewSessionForm/NewSessionForm';
import { fetchGroups } from '@/lib/queries/groups';
import { todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New session · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, claims, timezone } = await requireStaff();
  const params = await searchParams;
  const defaultDate =
    typeof params.date === 'string' ? params.date : todayIso(timezone);

  const groups = await fetchGroups(db, orgId);

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
        orgId={orgId}
        userId={claims.userId}
        groups={groups}
        defaultDate={defaultDate}
        timezone={timezone}
      />
    </>
  );
}
