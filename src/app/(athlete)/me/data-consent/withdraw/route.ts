import { redirect } from 'next/navigation';
import { requireAthlete } from '@/lib/session';

/** The withdrawal row's write: withdraw_data_consent (0120). "Keep my consent
 *  as it is" writes nothing and returns to Me. */
export async function POST(request: Request) {
  const { db } = await requireAthlete();
  const form = await request.formData();
  const decision = form.get('decision');
  if (decision !== 'decline') redirect('/me');
  const { error } = await db.rpc('withdraw_data_consent');
  if (error) redirect('/me/data-consent?e=failed');
  redirect('/consent/declined');
}
