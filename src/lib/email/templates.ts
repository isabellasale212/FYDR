/* The invite email's actual content — the same information the admin reads off
 * the CreateUserForm/BulkInviteForm screen and relays by hand, put into an
 * email shape instead. Not a redesign: the content is the content, this is just
 * its second rendering.
 *
 * It used to carry a temporary password and a sign-in URL. It now carries a
 * single-use invite link and no credential at all, because there no longer is
 * one: nothing in this app generates a password for anybody. See lib/invite.ts
 * for what replaced it and why the link is not the same thing wearing a hat. */

export type InviteEmailData = {
  recipientName: string;
  clubName: string;
  inviteUrl: string;
};

export function inviteEmail(data: InviteEmailData): { subject: string; text: string; html: string } {
  const subject = `You've been added to ${data.clubName} on Fydr`;
  const text = [
    `Hi ${data.recipientName},`,
    '',
    `${data.clubName} has set up your Fydr account.`,
    '',
    `Set your password and sign in: ${data.inviteUrl}`,
    '',
    'The link works once and confirms this address at the same time. Nobody has',
    'set a password for you, and nobody else knows the one you choose.',
    '',
    'If you weren\'t expecting this, contact your club.',
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(data.recipientName)},</p>
    <p>${escapeHtml(data.clubName)} has set up your Fydr account.</p>
    <p><a href="${escapeHtml(data.inviteUrl)}">Set your password and sign in</a></p>
    <p>The link works once and confirms this address at the same time. Nobody has set a password for you, and nobody else knows the one you choose.</p>
    <p style="color:#666;font-size:13px">If you weren't expecting this, contact your club.</p>
  `.trim();
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
