import { redirect } from 'next/navigation';
import { requireAthlete } from '@/lib/session';
import { sendGuardianLink } from '@/lib/guardianConsent';

/** Artboard 4A's two sends: the first, when a minor taps "Read the choice"
 *  on artboard 2 (a form post, so the send is an act and not a side effect
 *  of opening a page), and "Send the link again". */
export async function POST(request: Request) {
  const { db, orgId, athleteId, firstName, claims, timezone } = await requireAthlete({ allowUndecided: true });
  const origin = new URL(request.url).origin;
  const { data: org } = await db.from('organisations').select('name').eq('id', orgId).maybeSingle();
  const result = await sendGuardianLink(db, { orgId, athleteId, athleteFirstName: firstName, clubName: org?.name ?? 'your club', actorId: claims.userId, actorRole: 'athlete', origin, timezone });
  redirect(result.ok ? '/consent/guardian?sent=1' : `/consent/guardian?e=${encodeURIComponent(result.reason)}`);
}
