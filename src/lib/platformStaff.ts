/** Fydr's OWN staff, not a club's.
 *
 *  This is the only identity check in the app that is not a role, and it is
 *  deliberate. `admin` is a CLUB administrator — the person who runs that
 *  club's users, billing and retention — and a club admin is precisely who
 *  must NOT be able to switch their own plan view: for them the plan is the
 *  thing they pay for, not a thing to try on. The tier preview is a Fydr-side
 *  sales and support affordance. It exists so that when a Basic club asks what
 *  Premium adds, or a Premium club asks what they would lose, the answer can
 *  be shown in the real product instead of described.
 *
 *  An env allowlist rather than a fifth role in the enum, because a role would
 *  live in the same `app_metadata.roles` array as coach/medical/admin — which
 *  is club-scoped data on a club's user. Fydr staff are not members of any
 *  club, and granting one a role inside a customer's org would put them in
 *  that org's user list and inside its RLS boundary. The allowlist is read
 *  server-side only and compared against the email on the VERIFIED session
 *  (getClaims' getUser() round-trips to the auth server before the email is
 *  read), so it satisfies CLAUDE.md rule 2 exactly as roles do: never from
 *  the client.
 *
 *  UNSET MEANS NOBODY. That is the correct default, not a gap: on a
 *  deployment where the variable was never set, the switch does not render,
 *  the cookie is never read, and every gate sees the club's real paid tier. */

/** Parse the allowlist. Comma-separated, whitespace-tolerant, case-folded —
 *  email local parts are case-sensitive in the RFC and case-insensitive at
 *  every real mailbox provider, and an allowlist that fails on a capital
 *  letter is a support ticket, not a security control. */
export function platformStaffEmails(
  raw: string | undefined = process.env.FYDR_PLATFORM_EMAILS,
): readonly string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isPlatformStaff(
  email: string | null | undefined,
  raw: string | undefined = process.env.FYDR_PLATFORM_EMAILS,
): boolean {
  if (!email) return false;
  const allow = platformStaffEmails(raw);
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}
