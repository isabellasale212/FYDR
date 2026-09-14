import { redirect } from 'next/navigation';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';
import { saveSheet, type SheetInput } from '@/lib/queries/matchParticipation';
import { refuse, requireStaff } from '@/lib/session';

/** The sheet's one write (0127): every row of the form, upserted or removed
 *  under the coach's own session (RLS: SESSION_EDIT), audited by trigger. */
export async function POST(request: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const { db, orgId, claims } = await requireStaff();
  const back = (s: string): never => redirect(`/schedule/fixtures/${fixtureId}/participation?s=${s}`);
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) await refuse(db, 'match_sheet', `/schedule/fixtures/${fixtureId}/participation`);
  const form = await request.formData();
  const input: SheetInput[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith('sel:')) continue;
    const athleteId = key.slice(4);
    const sel = String(raw);
    const minRaw = String(form.get(`min:${athleteId}`) ?? '').trim();
    const minutes = minRaw === '' ? null : Number(minRaw);
    input.push({
      athleteId,
      selection: sel === 'started' || sel === 'came_on' || sel === 'unused' ? sel : 'none',
      minutes: minutes === null || Number.isNaN(minutes) ? null : minutes,
    });
  }
  const result = await saveSheet(db, orgId, claims.userId, fixtureId, input);
  if (result.error) back(/coach’s and the sport scientist’s/.test(result.error) ? 'refused' : `err:${encodeURIComponent(result.error)}`);
  back('saved');
}
