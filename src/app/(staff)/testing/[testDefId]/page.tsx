import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TestLogGrid } from '@/components/TestLogGrid/TestLogGrid';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchResultsForLogging, fetchTestDefinitions } from '@/lib/queries/testing';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Log results · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TestLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ testDefId: string }>;
  searchParams: SearchParams;
}) {
  const { testDefId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const sp = await searchParams;

  const today = todayIso(timezone);
  const testDate = typeof sp.date === 'string' ? sp.date : today;

  const definitions = await fetchTestDefinitions(db, orgId);
  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition) notFound();

  const athletes = await fetchResultsForLogging(db, orgId, testDefId, testDate);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/testing">Testing</Link> · {definition.name}
          </p>
          <h1>{definition.name}</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Squad · {orgName}
      </p>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Link href={`/testing/${testDefId}?date=${addDays(testDate, -1)}`} className="btn-ghost">
          ‹ Previous day
        </Link>
        <span className="nm mono">{formatDate(testDate)}</span>
        <Link href={`/testing/${testDefId}?date=${addDays(testDate, 1)}`} className="btn-ghost">
          Next day ›
        </Link>
      </div>

      <TestLogGrid
        orgId={orgId}
        userId={claims.userId}
        testDefinitionId={testDefId}
        testDate={testDate}
        defaultAttempts={definition.default_attempts}
        sideMode={definition.side_mode}
        decimalPlaces={definition.decimal_places}
        unit={definition.unit}
        athletes={athletes}
      />
    </>
  );
}
