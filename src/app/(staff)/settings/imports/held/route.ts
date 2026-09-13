import { NextResponse } from 'next/server';
import { discardHeldRow, matchHeldRow } from '@/lib/queries/gpsImport';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import { GPS_IMPORT, hasAnyRole } from '@/lib/access';
import { isUuid } from '@/lib/uuid';

/* PATTERN-S8 C11 (2026-09-13): resolve a held import row — match it to an
 * athlete (writes the gps_records row, remembers the vendor's spelling) or
 * discard it. The same two gates the upload route holds (the sport
 * scientist, on Premium), because this is the other half of the same
 * write; RLS on the three tables holds beneath. */
export type HeldResolveResult = { ok: boolean; error: string | null; aliasRemembered: boolean; alias: string };

export async function POST(request: Request): Promise<NextResponse<HeldResolveResult>> {
  const { db, orgId, claims, tier } = await requireStaff();
  if (!hasAnyRole(claims.roles, GPS_IMPORT)) return NextResponse.json({ ok: false, error: 'Importing GPS files is not part of this role.', aliasRemembered: false, alias: '' }, { status: 403 });
  if (!isPremium(tier)) return NextResponse.json({ ok: false, error: 'GPS import is a Premium feature, and this club is on Basic.', aliasRemembered: false, alias: '' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const heldId = typeof body?.heldId === 'string' ? body.heldId : '';
  const action = body?.action === 'discard' ? 'discard' : 'match';
  const athleteId = typeof body?.athleteId === 'string' ? body.athleteId : '';
  if (!isUuid(heldId)) return NextResponse.json({ ok: false, error: 'Which row?', aliasRemembered: false, alias: '' }, { status: 400 });

  if (action === 'discard') {
    const { error } = await discardHeldRow(db, orgId, claims.userId, heldId);
    return NextResponse.json({ ok: !error, error, aliasRemembered: false, alias: '' }, { status: error ? 400 : 200 });
  }
  if (!isUuid(athleteId)) return NextResponse.json({ ok: false, error: 'Pick the athlete this row belongs to.', aliasRemembered: false, alias: '' }, { status: 400 });
  const { error, aliasRemembered, alias } = await matchHeldRow(db, orgId, claims.userId, heldId, athleteId);
  return NextResponse.json({ ok: !error, error, aliasRemembered, alias }, { status: error ? 400 : 200 });
}
