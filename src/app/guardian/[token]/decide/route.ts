import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** The guardian's answer, by token alone: guardian_decide (0120) writes the
 *  athlete's columns as the guardian's decision (parental_consent_method =
 *  guardian_link), single use, expiry refused. No account, no session. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await request.formData();
  const decision = form.get('decision');
  if (decision !== 'agree' && decision !== 'decline') redirect(`/guardian/${token}?e=failed`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('guardian_decide', { p_token: token, p_decision: decision });
  if (error || data === 'unknown') redirect(`/guardian/${token}?e=failed`);
  /* 'ok', 'decided' and 'expired' all land on the page, which reads the
     request's state and says so. */
  redirect(`/guardian/${token}`);
}
