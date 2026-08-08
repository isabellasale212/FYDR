import 'server-only';

/* Every "invite email" this build has ever mentioned — single invite,
 * bulk invite, resend invite, scheduled report delivery, the SAR pack's
 * own due-date reminder — has the same real cause behind it: no email
 * provider account exists anywhere in this project, and creating one is
 * outside what this build does autonomously (real third-party account
 * creation, real payment details on a plan the user hasn't chosen).
 * That fact hasn't changed and this file doesn't change it.
 *
 * What this file does do: close the distance between "no email
 * provider" and "sends real email" to exactly one step — pasting a real
 * API key into .env.local — rather than leaving it as unwritten code on
 * top of a missing account. EmailProvider is a small, real interface;
 * ResendProvider is a real, correct implementation of Resend's actual
 * API contract (https://resend.com/docs/api-reference/emails/send-email),
 * written and type-checked against their documented shape, but never
 * exercised against a real key because none exists in this environment
 * — the same category of "real code, unverified against the live
 * external system" as the SAR pack's manifest is verified against the
 * compliance doc's own words rather than a lawyer's sign-off.
 * LoggedProvider is the honest default every environment actually runs
 * on today: it never claims to have sent anything, it records exactly
 * what would have been sent and to whom, in audit_log, the same
 * durable, real record this schema already uses for every other event
 * that matters. Callers must check `delivered` before ever telling a
 * user "an email was sent" — see lib/email/send.ts. */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSendResult = {
  delivered: boolean; // true only when a real provider genuinely accepted the send
  error: string | null;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

class LoggedProvider implements EmailProvider {
  readonly name = 'logged';

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // No real provider configured — this is not a failure, it's this
    // build's honest, permanent default until RESEND_API_KEY exists.
    // The caller (lib/email/send.ts) is what actually writes the
    // audit_log row, since it has the org/actor context this class
    // deliberately doesn't — a provider only knows how to send a
    // message, not who asked for it or on whose behalf.
    void message;
    return { delivered: false, error: null };
  }
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { delivered: false, error: `Resend returned ${res.status}: ${body.slice(0, 300)}` };
      }
      return { delivered: true, error: null };
    } catch (err) {
      return { delivered: false, error: err instanceof Error ? err.message : 'Unknown error contacting Resend.' };
    }
  }
}

/** The one place this decision gets made: a real provider only if a real
 *  key is actually present. Every caller in this codebase goes through
 *  this function rather than constructing a provider itself, so there is
 *  exactly one place to look to know what this deployment can actually
 *  do. */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (apiKey && fromAddress) {
    return new ResendProvider(apiKey, fromAddress);
  }
  return new LoggedProvider();
}
