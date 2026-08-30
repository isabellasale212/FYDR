import { renderToBuffer } from '@react-pdf/renderer';
import { fetchGroups } from '@/lib/queries/groups';
import { recordReportView } from '@/lib/queries/reports';
import {
  fetchMatchBoard,
  fetchMatchOverview,
  fetchMatchSessions,
  fetchTrainingBoard,
  fetchTrainingOverview,
  fetchTrainingSessions,
  scoreTone,
} from '@/lib/queries/trainingReport';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, todayIso } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse } from '@/lib/pdf';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** lib/pdf.tsx has the "this was actually buildable" story. Sixth report to
 *  get a PDF, after Squad weekly, Injury & availability, Compliance, the
 *  Athlete report and Testing — this one was the one still saying "no PDF
 *  for this report" in its own page caption, left over from before the
 *  pipeline existed anywhere in this build. Same real numbers as the
 *  on-screen board and the CSV export at ../export/route.ts; a printed page
 *  is a rendering of them, not a third calculation. Two real differences
 *  from that CSV, both deliberate:
 *
 *  - `Unit` is a data column here too, exactly like the CSV, not a section
 *    break — PdfTable has no notion of a sub-heading row, and inventing one
 *    for a single report would be a bigger change than this file's job.
 *  - The overview dials (Intensity / High speed / Endurance, or their
 *    match equivalents) are real, the same fetchTrainingOverview /
 *    fetchMatchOverview scoring used on screen, added as a tile row because
 *    a coach printing this for a Monday meeting wants the one-line read on
 *    the session before the full board, same reasoning squad/pdf's own
 *    tile row gives for its four headline numbers. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the PDF resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and the
  // header meta names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const mode = url.searchParams.get('mode') === 'match' ? 'match' : 'training';
  const requested = url.searchParams.get('session');

  const groups = await fetchGroups(db, orgId);
  const scopeLabel = groupScopeLabel(groups, groupIds);
  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  // Same bands scoreTone() already gives the on-screen dials — 'accent' and
  // 'accent2' have no PdfTile equivalent (both render as the default,
  // untinted tile), so only 'bad' and 'warn' carry a tone through.
  const dialTone = (value: number): 'bad' | 'warn' | undefined => {
    const tone = scoreTone(value).tone;
    return tone === 'bad' || tone === 'warn' ? tone : undefined;
  };

  if (mode === 'match') {
    const sessions = await fetchMatchSessions(db, orgId, timezone);
    const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
    if (!selected) {
      const buffer = await renderToBuffer(
        <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)}`}>
          <PdfHeader eyebrow={`Match day GPS report · ${orgName}`} title="Match day GPS report" meta="No match GPS data on file yet." />
        </PdfReport>,
      );
      return pdfResponse(buffer, 'match-report.pdf');
    }

    const [overview, board] = await Promise.all([fetchMatchOverview(db, orgId, groupIds, selected), fetchMatchBoard(db, orgId, groupIds, selected)]);

    const buffer = await renderToBuffer(
      <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(selected.date, timezone)} · not for redistribution without the club's own policy`}>
        <PdfHeader
          eyebrow={`Match day GPS · v ${selected.opponent} · ${orgName}`}
          title="Match day GPS report"
          meta={`${formatDate(selected.date, timezone)}${selected.result ? ` · ${selected.result}` : ''} · Scope: ${scopeLabel}${overview ? ` (${overview.athleteCount} athletes)` : ''}`}
        />

        {overview ? (
          <>
            <PdfTileRow>
              {overview.dials.map((d) => (
                <PdfTile key={d.key} label={d.label} value={`${d.value}%`} tone={dialTone(d.value)} />
              ))}
            </PdfTileRow>
            <PdfSectionTitle title="Read" caption={overview.headline} />
          </>
        ) : null}

        <PdfSectionTitle
          title="Board"
          caption={`Whole-match totals only, real per-athlete GPS · no H1/H2 split — this schema has nothing to split from · n = ${board.rows.length} played`}
        />
        <PdfTable
          emptyText="No one in this filter played in this match."
          rows={board.rows}
          columns={[
            { key: 'unit', label: 'Unit', width: '18%', render: (r) => r.group_name },
            { key: 'name', label: 'Player', width: '24%', render: (r) => `${r.last_name}, ${r.first_name}` },
            { key: 'mins', label: 'Mins', width: '10%', align: 'right', render: (r) => (r.mins !== null ? String(r.mins) : '—') },
            { key: 'td', label: 'TD (m)', width: '12%', align: 'right', render: (r) => (r.td !== null ? Math.round(r.td).toLocaleString() : '—') },
            { key: 'hsr', label: 'HSR (m)', width: '12%', align: 'right', render: (r) => (r.hsr !== null ? Math.round(r.hsr).toLocaleString() : '—') },
            { key: 'hie', label: 'HIE', width: '8%', align: 'right', render: (r) => (r.hie !== null ? String(r.hie) : '—') },
            { key: 'maxv', label: 'MaxV (km/h)', width: '16%', align: 'right', render: (r) => (r.maxv_kmh !== null ? String(r.maxv_kmh) : '—') },
          ]}
        />
      </PdfReport>,
    );

    await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, format: 'pdf', mode }, 'export');
    return pdfResponse(buffer, `match-report-${selected.date}.pdf`);
  }

  const sessions = await fetchTrainingSessions(db, orgId, timezone);
  const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
  if (!selected) {
    const buffer = await renderToBuffer(
      <PdfReport footer={`${orgName} · Fydr`}>
        <PdfHeader eyebrow={`Training report · ${orgName}`} title="Training report" meta="No GPS data imported yet." />
      </PdfReport>,
    );
    return pdfResponse(buffer, 'training-report.pdf');
  }

  const [overview, board] = await Promise.all([fetchTrainingOverview(db, orgId, groupIds, selected), fetchTrainingBoard(db, orgId, groupIds, selected)]);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Fydr · generated ${formatDate(selected.date, timezone)} · not for redistribution without the club's own policy`}>
      <PdfHeader
        eyebrow={`Training · ${selected.title} · ${orgName}`}
        title="Training report"
        meta={`${formatDate(selected.date, timezone)} · Scope: ${scopeLabel}${overview ? ` (${overview.athleteCount} athletes)` : ''}`}
      />

      {overview ? (
        <>
          <PdfTileRow>
            {overview.dials.map((d) => (
              <PdfTile key={d.key} label={d.label} value={`${d.value}%`} tone={dialTone(d.value)} />
            ))}
          </PdfTileRow>
          <PdfSectionTitle title="Read" caption={overview.headline} />
        </>
      ) : null}

      <PdfSectionTitle
        title="Board"
        caption={`Raw session values · vs self is the athlete's own mean for this session type, vs unit is their positional unit's · n = ${board.rows.length} athletes`}
      />
      <PdfTable
        emptyText="No one in this filter has a GPS record for this session."
        rows={board.rows}
        columns={[
          { key: 'unit', label: 'Unit', width: '16%', render: (r) => r.group_name },
          { key: 'name', label: 'Player', width: '22%', render: (r) => `${r.last_name}, ${r.first_name}` },
          { key: 'td', label: 'TD (m)', width: '11%', align: 'right', render: (r) => (r.td !== null ? Math.round(r.td).toLocaleString() : '—') },
          { key: 'run', label: 'RUN (m)', width: '11%', align: 'right', render: (r) => (r.run !== null ? Math.round(r.run).toLocaleString() : '—') },
          { key: 'hsr', label: 'HSR (m)', width: '11%', align: 'right', render: (r) => (r.hsr !== null ? Math.round(r.hsr).toLocaleString() : '—') },
          { key: 'hie', label: 'HIE', width: '7%', align: 'right', render: (r) => (r.hie !== null ? String(r.hie) : '—') },
          { key: 'maxv', label: 'MaxV', width: '11%', align: 'right', render: (r) => (r.maxv_kmh !== null ? String(r.maxv_kmh) : '—') },
          { key: 'vs_self', label: 'vs self', width: '11%', align: 'right', render: (r) => (r.vs_self !== null ? `${r.vs_self}%` : '—') },
        ]}
      />
    </PdfReport>,
  );

  await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, format: 'pdf', mode }, 'export');
  return pdfResponse(buffer, `training-report-${selected.date}.pdf`);
}
