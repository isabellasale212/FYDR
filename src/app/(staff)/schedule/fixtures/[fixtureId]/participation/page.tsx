import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';
import { formatDateTime, formatLongDate, formatTime } from '@/lib/format';
import { NOT_SELECTED, SELECTION_WORDS, availabilityAtKickOffWords, selectionOf } from '@/lib/matchReport';
import { fetchFixtureSheet } from '@/lib/queries/matchParticipation';
import { fetchStaffName } from '@/lib/queries/staffName';
import { refuse, requireStaff } from '@/lib/session';

export const metadata = { title: 'Post-match sheet · Fydr' };

/** The coach's post-match sheet (Isabella, decision batch 13 September 2026,
 *  "The match report, both halves approved"; 0127). One screen, reached from
 *  the fixture, writable by the coach and the sport scientist (SESSION_EDIT).
 *  Per athlete: started, came on, minutes. Nothing else — no positions, no
 *  events, no score. A form, not a dialog; nothing advances on its own; save
 *  is one button. docs/screens/11-fixture-detail.md. */
export default async function PostMatchSheetPage({ params, searchParams }: { params: Promise<{ fixtureId: string }>; searchParams: Promise<{ s?: string }> }) {
  const { fixtureId } = await params;
  const sp = await searchParams;
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) await refuse(db, 'match_sheet', `/schedule/fixtures/${fixtureId}/participation`);
  const sheet = await fetchFixtureSheet(db, orgId, fixtureId);
  if (!sheet) notFound();
  const recordedBy = sheet.recorded.by ? await fetchStaffName(orgId, sheet.recorded.by) : null;
  const selected = sheet.rows.filter((r) => r.selected);
  const notices: Record<string, string> = {
    saved: 'Saved. The match report reads it now.',
    failed: 'Not saved. Try again.',
    refused: 'Not saved: the post-match sheet is the coach’s and the sport scientist’s to write.',
  };
  const notice = typeof sp.s === 'string' ? (notices[sp.s] ?? (sp.s.startsWith('err:') ? decodeURIComponent(sp.s.slice(4)) : null)) : null;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · <Link href={`/schedule/fixtures/${fixtureId}`}>v {sheet.fixture.opponent}</Link> · Post-match sheet
          </p>
          <h1>Post-match sheet</h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 'var(--sp-14)' }}>
        v {sheet.fixture.opponent} · {formatLongDate(sheet.fixture.kickoff_at, timezone)} · kick off {formatTime(sheet.fixture.kickoff_at, timezone)}. Mark who was selected,
        who started and who came on, and the minutes each played. Leave minutes empty where they are not known — the report says
        &ldquo;not recorded&rdquo;, never zero. Availability is as it stood at kick-off, from the record; it is not edited here.
      </p>
      {notice ? (
        <p className={/^Not saved/.test(notice) ? 'form-error' : 'tiny'} role={/^Not saved/.test(notice) ? 'alert' : 'status'} style={{ marginBottom: 'var(--sp-14)' }} data-sheet-notice>
          {notice}
        </p>
      ) : null}

      <form method="post" action={`/schedule/fixtures/${fixtureId}/participation/save`} className="card" aria-labelledby="sheet-title">
        <div className="tbl-shell-head">
          <h2 className="card-title" id="sheet-title">
            {sheet.rows.length} athlete{sheet.rows.length === 1 ? '' : 's'} on the roster · {selected.length} selected
          </h2>
          <p className="tiny" style={{ margin: 0 }}>
            {sheet.recorded.at ? `Last saved ${formatDateTime(sheet.recorded.at, timezone)}${recordedBy ? ` by ${recordedBy.name}` : ''}` : 'Nothing recorded against this fixture yet'}
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tbl-cards">
            <caption className="visually-hidden">The post-match sheet, one row per athlete</caption>
            <thead>
              <tr>
                <th scope="col">Athlete</th>
                <th scope="col">At kick-off</th>
                <th scope="col">Selection</th>
                <th scope="col" className="r">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => {
                const current = r.selected ? selectionOf(r) : 'none';
                return (
                  <tr key={r.athlete_id} data-athlete={r.athlete_id} data-selection={current}>
                    <td className="nm" data-label="Athlete">
                      {r.first_name} {r.last_name}
                      <span className="sub" style={{ display: 'block', fontWeight: 400 }}>
                        {r.position ?? 'No position set'}
                        {r.squad_number !== null ? ` · #${r.squad_number}` : ''}
                      </span>
                    </td>
                    <td className="sub" data-label="At kick-off">
                      {availabilityAtKickOffWords(r.availability)}
                      {r.restrictions.length > 0 ? ` · ${r.restrictions.join(' · ')}` : ''}
                    </td>
                    <td data-label="Selection">
                      <select name={`sel:${r.athlete_id}`} defaultValue={current} className="field" aria-label={`Selection for ${r.first_name} ${r.last_name}`} style={{ minHeight: 'var(--tap-min)' }}>
                        <option value="none">{NOT_SELECTED}</option>
                        <option value="started">{SELECTION_WORDS.started}</option>
                        <option value="came_on">{SELECTION_WORDS.came_on}</option>
                        <option value="unused">{SELECTION_WORDS.unused}</option>
                      </select>
                    </td>
                    <td className="r" data-label="Minutes">
                      <input
                        name={`min:${r.athlete_id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        step={1}
                        defaultValue={r.minutes ?? ''}
                        className="field num"
                        aria-label={`Minutes for ${r.first_name} ${r.last_name}`}
                        placeholder="Not recorded"
                        style={{ maxWidth: 120, minHeight: 'var(--tap-min)' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center', marginTop: 'var(--sp-14)', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" style={{ minHeight: 'var(--tap-min)' }}>
            Save the sheet
          </button>
          <Link href={`/reports/match?fixture=${fixtureId}`} className="btn-ghost" style={{ minHeight: 'var(--tap-min)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            Open the match report
          </Link>
          <span className="tiny">Saving writes every row: an athlete set back to &ldquo;Not selected&rdquo; is removed from the sheet, and each change is in the audit log.</span>
        </div>
      </form>
    </>
  );
}
