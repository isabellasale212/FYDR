import 'server-only';
import { getEmailProvider } from './provider';
import { inviteEmail, type InviteEmailData } from './templates';
import type { Db } from '@/lib/queries/groups';
import type { AppRole } from '@/lib/types/database';

/* The one function every invite path in this codebase should call —
 * settings/users/create/route.ts and settings/users/bulk-invite/send/
 * route.ts both do. Never tells a caller an email was sent unless a real
 * provider genuinely accepted it; when it wasn't (every environment
 * today, since no RESEND_API_KEY exists anywhere in this project),
 * writes an honest audit_log row saying so instead of a fabricated
 * success. */

export type InviteEmailResult = {
  delivered: boolean;
  error: string | null;
};

export async function sendInviteEmail(
  db: Db,
  orgId: string,
  actorId: string,
  actorRole: AppRole,
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
      delivered: result.delivered,
      error: result.error,
      note: result.delivered ? null : 'No email provider configured (RESEND_API_KEY/EMAIL_FROM_ADDRESS) — the temporary password was shown on screen instead.',
    },
  });

  return { delivered: result.delivered, error: result.error };
}
