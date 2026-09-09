import 'server-only';
import { getEmailProvider } from './provider';
import { inviteEmail, type InviteEmailData } from './templates';
import type { Db } from '@/lib/queries/groups';
import type { AppRole } from '@/lib/types/database';

/* The one function every invite path in this codebase should call —
 * settings/users/create/route.ts and settings/users/bulk-invite/send/
 * route.ts both do. Never tells a caller an email was sent unless a real
 * provider genuinely accepted it; when it wasn't, writes an honest
 * audit_log row saying so instead of a fabricated success.
 *
 * THIS HEADER USED TO CLAIM THE KEY WAS SET NOWHERE, and that stopped
 * being true. (Phrased without repeating the old sentence, because a
 * comment that quotes the exact string a grep looks for is how five
 * checks in this repo have produced a false pass.) The key is set in Vercel for
 * PRODUCTION ONLY, and a real invite has been through it: audit_log holds
 * an invite.email_sent row with provider: resend and delivered: true,
 * which this function only ever writes on a genuine 2xx. Local and
 * preview have no key, so they still take the logged no-op — that is now
 * an environment difference rather than a gap in the build, and it is why
 * both branches still matter.
 *
 * WHAT IS STILL NOT POSSIBLE, which is the real current limit and was
 * hidden behind the stale claim: EMAIL_FROM_ADDRESS is
 * onboarding@resend.dev, and until a domain is verified in Resend that
 * sender can only deliver to the Resend signup address. So an invite
 * reaches a genuine 2xx and still cannot reach a real player. Verifying
 * fydr.app in Resend is a few DNS records and wants doing before a pilot
 * club, not after. */

export type InviteEmailResult = {
  delivered: boolean;
  error: string | null;
};

export async function sendInviteEmail(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole | null,
  targetUserId: string,
  recipientEmail: string,
  data: InviteEmailData,
): Promise<InviteEmailResult> {
  const provider = getEmailProvider();
  const { subject, text, html } = inviteEmail(data);
  const result = await provider.send({ to: recipientEmail, subject, text, html });

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    actor_role: actorRole,
    action: result.delivered ? 'invite.email_sent' : 'invite.email_not_sent',
    entity_type: 'user',
    entity_id: targetUserId,
    metadata: {
      provider: provider.name,
      /* Config, not content: the club's own outbound address. Null when nothing
         was attempted, so the row never implies a send that did not happen. */
      from: result.from ?? null,
      delivered: result.delivered,
      error: result.error,
      /* The note used to be hardcoded to the no-provider explanation for every
         undelivered row. Once the send guard landed that became a lie: with a
         provider configured and a reserved address, the provider is fine and the
         ADDRESS is the problem. An audit row that misattributes a cause is worse
         than one that says nothing, so the real error wins when there is one. */
      note: result.delivered
        ? null
        : (result.error
            /* Reached only on the LoggedProvider path — result.error is null
               and nothing was delivered — so naming the missing config IS the
               right cause here, unlike the hardcoded version above it. The
               tail used to read "the temporary password was shown on screen
               instead", which stopped being true when the invite link replaced
               the password: this response carries no password at all. An audit
               note is a record of record, so it says what actually happened. */
            ?? 'No email provider configured for this environment (RESEND_API_KEY/EMAIL_FROM_ADDRESS) — a single-use invite link was shown on screen instead.'),
    },
  });

  return { delivered: result.delivered, error: result.error };
}
