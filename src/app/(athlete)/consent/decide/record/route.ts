import { redirect } from 'next/navigation';
import { CONSENT_VERSION } from '@/lib/legalPlaceholders';
import { requireAthlete } from '@/lib/session';

/** Artboard 3A's write: one tap answers both blocks through
 *  record_data_consent (0120) — the only path onto the consent columns from
 *  an athlete session. Agree lands on the first check-in (artboard 5);
 *  decline lands on the declined state (3B), a screen, not a toast. A minor
 *  is refused by the function ('guardian_decides') and sent to 4A.
 *  Relative redirects (next/navigation), never an absolute origin: the
 *  browser's host is the browser's. */
export async function POST(request: Request) {
  const { db } = await requireAthlete({ allowUndecided: true });
  const form = await request.formData();
  const decision = form.get('decision');
  if (decision !== 'agree' && decision !== 'decline') redirect('/consent/decide?e=failed');
  const { error } = await db.rpc('record_data_consent', { p_decision: decision, p_version: CONSENT_VERSION });
  if (error) {
    if (/guardian_decides/.test(error.message)) redirect('/consent/guardian');
    redirect('/consent/decide?e=failed');
  }
  redirect(decision === 'agree' ? '/check-in?first=1' : '/consent/declined');
}
