import { NextResponse } from 'next/server';
import { countAuditLog, type AuditLogFilters } from '@/lib/queries/auditLog';
import { requireStaff } from '@/lib/session';
import { SETTINGS_ADMIN, hasAnyRole } from '@/lib/access';
import { addDays, todayIso } from '@/lib/format';

/* PATTERN-S8 C7 (2026-09-13): the count the phone sheet's button reads back
 * — "Show 128 entries" — for the filter as it stands in the sheet, before
 * the page is asked for the rows. The same query the page runs, with
 * head:true; the same 30-day default when no date is given; the same gate
 * (the audit log is the sport scientist's). Reads nothing a person could
 * not read by pressing Apply; a wrong role gets 403, never a number. */
export const dynamic = 'force-dynamic';

const DEFAULT_WINDOW_DAYS = 30;

function str(v: string | null): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

export async function GET(request: Request) {
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!hasAnyRole(claims.roles, SETTINGS_ADMIN)) return NextResponse.json({ error: 'The audit log belongs to the sport scientist.' }, { status: 403 });

  const url = new URL(request.url);
  const isAllTime = url.searchParams.get('range') === 'all';
  const explicitFrom = str(url.searchParams.get('from'));
  const explicitTo = str(url.searchParams.get('to'));
  const usingDefaultWindow = !isAllTime && explicitFrom === null && explicitTo === null;
  const filters: AuditLogFilters = {
    entityType: str(url.searchParams.get('type')),
    from: isAllTime ? null : (explicitFrom ?? (usingDefaultWindow ? addDays(todayIso(timezone), -(DEFAULT_WINDOW_DAYS - 1)) : null)),
    to: isAllTime ? null : (explicitTo ?? (usingDefaultWindow ? todayIso(timezone) : null)),
    actorId: str(url.searchParams.get('actor')),
    athleteId: str(url.searchParams.get('athlete')),
    q: str(url.searchParams.get('q')),
  };
  const count = await countAuditLog(db, orgId, filters, timezone);
  return NextResponse.json({ count });
}
