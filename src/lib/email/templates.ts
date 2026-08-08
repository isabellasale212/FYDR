/* The invite email's actual content — the same information the admin
 * currently reads off the CreateUserForm/BulkInviteForm screen and
 * relays by hand, put into an email shape instead. Not a redesign: the
 * content is the content, this is just its second rendering. */

export type InviteEmailData = {
  recipientName: string;
  clubName: string;
  temporaryPassword: string;
  signInUrl: string;
};

export function inviteEmail(data: InviteEmailData): { subject: string; text: string; html: string } {
  const subject = `You've been added to ${data.clubName} on Fydr`;
  const text = [
    `Hi ${data.recipientName},`,
    '',
    `${data.clubName} has set up your Fydr account.`,
    '',
    `Sign in: ${data.signInUrl}`,
    `Temporary password: ${data.temporaryPassword}`,
    '',
    "You'll be asked to change this password the first time you sign in.",
    '',
    'If you weren\'t expecting this, contact your club.',
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(data.recipientName)},</p>
    <p>${escapeHtml(data.clubName)} has set up your Fydr account.</p>
    <p>
      <a href="${escapeHtml(data.signInUrl)}">Sign in</a><br />
      Temporary password: <code>${escapeHtml(data.temporaryPassword)}</code>
    </p>
    <p>You'll be asked to change this password the first time you sign in.</p>
    <p style="color:#666;font-size:13px">If you weren't expecting this, contact your club.</p>
  `.trim();
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
