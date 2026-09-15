import { csvResponse, toCsv } from '@/lib/csv';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { fetchInjuryAvailabilityReport, recordReportView } from '@/lib/queries/reports';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { reportDefinition } from '@/lib/reportCatalogue';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { exportAuditMetadata, exportCaption, exportFileName, type ExportDescriptor } from '@/lib/exportDescriptor';
import { formatDateTime } from '@/lib/format';
import { periodParamsFromUrl, resolveInjuryPeriod } from '../period';

/** CSV only, see lib/csv.ts's header. The coach export and the medical
 *  export are two different queries, not one CSV with a column hidden after
 *  the fact — isMedical gates which fields fetchInjuryAvailabilityReport
 *  even reads, the same boundary the report page itself holds.
 *
 *  The medic's copy carries THREE clinical columns after Expected return —
 *  Diagnosis, Mechanism, Severity — read from injury_clinical for the open
 *  injuries in the Current list, through the medic-only policy
 *  (clinical_medical_only; nobody else can even run the read, and nobody
 *  else's export calls it). Decision batch 14 September 2026, #5: three, not
 *  four. Clinical notes stay out of every export: they are free text a physio
 *  types, can carry a third party's name, a guess, or something about a
 *  player's family, and an export is the thing that leaves the club. The
 *  notes stay on the medic's screen.
 *
 *  Scoped through resolveGroupFilter (URL param, then the sticky filter
 *  cookie), not parseGroupParam on the URL alone: the audit's S4 finding
 *  (analysis findings 27/49) was a group filter that silently re-scoped
 *  every screen while this export answered a bare URL with differently-
 *  scoped rows and no hint either way. The export now resolves the scope
 *  exactly as the page does, and the `# Scope:` caption line states it. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone, fullName } = await requireReport('injuries');
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);

  /* This line used to be `[28, 90, 180, 365].includes(...)` — the array
   * INLINED as a literal rather than named, which is why a grep for `PERIODS`
   * found seven of the nine copies of the legacy `?days=` allow-list and
   * missed this one. It now resolves through the same module the page and the
   * PDF use, so the CSV covers the window the coach was looking at rather
   * than silently falling back to 28 days the moment it meets `?period=season`.
   * resolveInjuryPeriod also reads the sticky cookie, exactly as the page
   * does — a bare export URL is scoped the way the screen is. */
  const period = await resolveInjuryPeriod(db, orgId, timezone, periodParamsFromUrl(url));
  const fromDate = period.from;
  const today = period.to;

  const [groups, report] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuryAvailabilityReport(db, orgId, groupIds, fromDate, today, isMedical),
  ]);

  /* The medic's three, keyed by the open injury each Current row is linked
     to. Never read for anyone else — the branch, not a filter, is the gate. */
  const clinicalByInjury = new Map<string, { diagnosis: string | null; mechanism: string | null; severity: string | null }>();
  if (isMedical) {
    const injuryIds = report.current.map((r) => r.injury_id).filter((id): id is string => id !== null);
    if (injuryIds.length > 0) {
      const { data, error } = await db
        .from('injury_clinical')
        .select('injury_id, diagnosis, mechanism, severity')
        .eq('org_id', orgId)
        .in('injury_id', injuryIds);
      if (error) throw new Error(error.message);
      for (const c of data ?? []) clinicalByInjury.set(c.injury_id, { diagnosis: c.diagnosis, mechanism: c.mechanism, severity: c.severity });
    }
  }

  const rows = report.current.map((r) => {
    const clinical = r.injury_id ? clinicalByInjury.get(r.injury_id) : undefined;
    return {
      name: r.name,
      position: r.position ?? '',
      squad_number: r.squad_number ?? '',
      status: r.status,
      restrictions: r.restrictions.join('; '),
      body_area: r.body_area ?? '',
      side: r.side ?? '',
      expected_return: r.expected_return ?? '',
      ...(isMedical
        ? {
            diagnosis: clinical?.diagnosis ?? '',
            mechanism: clinical?.mechanism ?? '',
            severity: clinical?.severity ?? '',
          }
        : {}),
    };
  });

  type Row = (typeof rows)[number];
  const headers: [keyof Row, string][] = [
    ['name', 'Name'],
    ['position', 'Position'],
    ['squad_number', 'Squad number'],
    ['status', 'Status'],
    ['restrictions', 'Restrictions'],
    ['body_area', 'Body area'],
    ['side', 'Side'],
    ['expected_return', 'Expected return'],
  ];
  if (isMedical) headers.push(['diagnosis', 'Diagnosis'], ['mechanism', 'Mechanism'], ['severity', 'Severity']);
  const csv = toCsv(rows, headers);

  /* PATTERN-S7 C3 / S8 C8: the same descriptor the dialog showed. The
     medic's copy carries the medical line; the coach's copy names itself as
     the coach view. */
  const descriptor: ExportDescriptor = {
    fileName: exportFileName('injury-availability', fromDate, today),
    report: 'Injury and availability report',
    window: `${period.label} (${fromDate} to ${today})`,
    scope: `${groupScopeLabel(groups, groupIds)} (${report.summary.athleteCount} athlete${report.summary.athleteCount === 1 ? '' : 's'})`,
    rows: rows.length,
    rowNoun: 'athlete not fully available',
    filters: [isMedical ? "The medic's copy: diagnosis, mechanism and severity; clinical notes stay on your screen" : 'The coach view: availability, restrictions, body area — no diagnosis'],
    medical: isMedical,
  };

  const actorRole = (isMedical ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'injury_availability',
    {
      from: fromDate,
      to: today,
      period: period.key,
      group_ids: groupIds,
      ...exportAuditMetadata(descriptor),
    },
    'export',
  );

  /* The caption names the period KEY as well as its dates. "28 days" and
   * "this season" can resolve to the same span for a club four weeks into a
   * season, and a CSV that lands in someone's inbox has no control to read
   * the answer off. `Current` is stated as unwindowed for the same reason the
   * page and the PDF state it: these rows are availability as of today, not a
   * historical snapshot of the period. */
  const caption =
    exportCaption(descriptor, reportDefinition('injuries'), { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) +
    `# Rows are availability as of ${today}, not a snapshot of the period.\r\n`;

  return csvResponse(caption + csv, descriptor.fileName);
}
