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
  /** The address the message was actually sent AS, when a real provider
   *  attempted it. Undefined when nothing was attempted — the logging default,
   *  or a send the guard refused — because reporting a sender for a message that
   *  was never sent would be worse than reporting none.
   *
   *  Recorded because it could not otherwise be checked: the from-address lives
   *  in a Vercel Secret, so it is unreadable from the environment, and the
   *  invite audit row used to carry no trace of it. "Which address did that go
   *  out as" is a question somebody asks after a deliverability problem, which
   *  is exactly when the setting has already changed. */
  from?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

class LoggedProvider implements EmailProvider {
  readonly name = 'logged';

  async send(message: EmailMessage): Promise<EmailSendResult> {
    // No real provider configured for THIS environment — not a failure,
    // and no longer a permanent default: RESEND_API_KEY is set in Vercel
    // for production, so this class is the local and preview path. It was
    // described as permanent when no environment had a key, which is the
    // kind of claim that ages into a lie the moment somebody configures
    // one.
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
  /* Plain fields rather than constructor parameter properties: the repository's
     test runner is `node --experimental-strip-types`, which cannot parse them
     ("TypeScript parameter property is not supported in strip-only mode"), so
     the shorthand made this module unimportable from a test. Same fields, same
     privacy, one runner. */
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

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
        /* The sender is reported on the FAILURE path too, and that is the more
           useful of the two: Resend's commonest rejection is an unverified from
           address, and the row is far easier to read when it says what was
           attempted rather than only that something was refused. */
        return {
          delivered: false,
          error: `Resend returned ${res.status}: ${body.slice(0, 300)}`,
          from: this.fromAddress,
        };
      }
      return { delivered: true, error: null, from: this.fromAddress };
    } catch (err) {
      return {
        delivered: false,
        error: err instanceof Error ? err.message : 'Unknown error contacting Resend.',
        from: this.fromAddress,
      };
    }
  }
}


/* ---------------------------------------------------------------------------
 * Addresses that cannot receive mail, and must therefore never be attempted.
 *
 * WHY THIS IS HERE AND NOT IN A CALLER. Production carries 46 seed accounts on
 * ashcomberfc.example and marlowvale.example. `.example` is reserved by RFC 2606
 * and never resolves, so a send to one is a guaranteed hard bounce — and hard
 * bounces are what costs a sending domain its reputation before it has any
 * history to protect. Nothing in this app enumerates users to mail them, so the
 * realistic path is a person typing a seeded address into the add-a-user form or
 * the password-reset form. One of those goes through this file.
 *
 * RENAMING THE ROWS WAS CONSIDERED AND REJECTED, 2026-09-08, and the reasoning
 * belongs here because it is why this guard exists at all: every placeholder TLD
 * is equally non-resolving, so `.invalid` bounces exactly as `.example` does, and
 * `public.users.email` is NOT NULL with a unique index so the rows cannot be
 * blanked either. The only fix that reduces bounces is not attempting the send.
 *
 * RESERVED BY SPECIFICATION, not by guesswork. RFC 2606 reserves the `.test`,
 * `.example`, `.invalid` and `.localhost` TLDs and the example.com/net/org
 * second-level names; RFC 6762 takes `.local` for mDNS; `.internal` is reserved
 * for private use. None can accept public mail.
 *
 * MATCHED ON LABEL BOUNDARIES, which is the part that is easy to get wrong. A
 * bare `endsWith('.example')` also matches nothing harmful, but an unanchored
 * `includes('example.com')` matches `notexample.com`, and `endsWith('.test')`
 * would be fine while `includes('.test')` catches `testing.co.uk`. Getting this
 * wrong in the permissive direction bounces; getting it wrong in the strict
 * direction silently never emails a real club, which looks like success. Both
 * directions are tested.
 * ------------------------------------------------------------------------- */

const RESERVED_TLDS = ['test', 'example', 'invalid', 'localhost', 'local', 'internal'] as const;
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'] as const;

/** Why this address cannot be sent to, or null when it can. */
export function unsendableReason(address: string): string | null {
  const trimmed = (address ?? '').trim().toLowerCase();
  if (trimmed === '') return 'No address was given.';

  const parts = trimmed.split('@');
  if (parts.length !== 2) return `"${address}" is not a single email address.`;
  const [local, domain] = parts as [string, string];
  if (local === '' || domain === '') return `"${address}" is not a complete email address.`;

  const labels = domain.split('.');
  const tld = labels[labels.length - 1] ?? '';
  if (RESERVED_TLDS.includes(tld as (typeof RESERVED_TLDS)[number])) {
    return `${domain} uses the reserved .${tld} suffix, which cannot receive mail. Sending would hard-bounce.`;
  }
  if (RESERVED_DOMAINS.includes(domain as (typeof RESERVED_DOMAINS)[number])) {
    return `${domain} is reserved for documentation and cannot receive mail. Sending would hard-bounce.`;
  }
  return null;
}

/**
 * Any provider, with the unsendable check in front of it.
 *
 * A WRAPPER RATHER THAN A CHECK INSIDE ResendProvider, deliberately. The next
 * provider added to this file would not inherit a check written inside the
 * current one, and the whole value of this guard is that it cannot be bypassed
 * by accident. getEmailProvider() returns one of these whatever it picked.
 *
 * It reports the wrapped provider's own `name`, so audit rows keep saying
 * 'resend' or 'logged' rather than 'guarded' — the row records what would have
 * done the sending, which is what somebody reading it back needs.
 */
export class GuardedProvider implements EmailProvider {
  private readonly inner: EmailProvider;

  constructor(inner: EmailProvider) {
    this.inner = inner;
  }

  get name(): string {
    return this.inner.name;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const reason = unsendableReason(message.to);
    if (reason !== null) {
      // No request is made at all. A refused send cannot bounce.
      return { delivered: false, error: reason };
    }
    return this.inner.send(message);
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
    return new GuardedProvider(new ResendProvider(apiKey, fromAddress));
  }
  return new GuardedProvider(new LoggedProvider());
}
