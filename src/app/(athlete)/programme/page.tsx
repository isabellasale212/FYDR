import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchMyProgrammeSessions } from '@/lib/queries/programmes';
import { mdLabel } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My programme · Fydr' };

/** screens/my-programme.md, screen 7, cut down to the gym/rehab session list —
 *  see lib/queries/programmes.ts's header. No nutrition-targets panel here
 *  (that reached Today directly, see today/page.tsx's "Fuelling today" card)
 *  and no rehab-phase card (that's the Injuries clinical boundary's own
 *  territory, not this screen's). */
export default async function MyProgrammePage() {
  const { db, athleteId, firstName, lastName } = await requireAthlete();
  const sessions = await fetchMyProgrammeSessions(db, athleteId);

  const programmeName = sessions[0]?.programme_name ?? null;
  const programmeType = sessions[0]?.programme_type ?? null;

  return (
    <>
      <div className="hd">
        <h1 className="d">My programme</h1>
        <ThemeToggle />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No programme assigned"
          body="Nothing has been assigned to you yet. Check back once your coach or physio sets one up."
        />
      ) : (
        <>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            {programmeName} {programmeType === 'rehab' ? '· Rehab' : ''}
          </p>
          <div className="card flush">
            {sessions.map((s, index) => (
              <div key={s.session_id}>
                {index > 0 ? <div className="hair" /> : null}
                <Link
                  href={`/gym/${s.session_id}`}
                  className="load-row"
                  style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
                >
                  <div>
                    <span className="nm">{s.session_name}</span>
                    <div className="tiny">
                      {s.block_name} · Week {s.week_number}
                      {s.day_number ? ` · Day ${s.day_number}` : ''}
                      {mdLabel(s.md_offset) ? ` · ${mdLabel(s.md_offset)}` : ''}
                    </div>
                  </div>
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="cap">
        {firstName} {lastName} · your own resolved plan only.
      </p>
    </>
  );
}
