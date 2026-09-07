/** Sign-in attempts against addresses that belong to no organisation.
 *
 *  WHY THE DATA ALREADY EXISTS. `login_attempts` keys on the email, and
 *  `login_attempt_record_result` deletes the row on SUCCESS. An address that
 *  matches no account never succeeds, so its row is never deleted — every
 *  unmatched attempt this product has ever seen is still sitting there with
 *  `org_id is null`. Nothing had ever read it.
 *
 *  WHY THE PER-EMAIL LOCKOUT DOES NOT BOUND ENUMERATION, which is the thing
 *  that makes this worth a screen. The streak is counted PER EMAIL: five
 *  failures against one address locks that address for thirty minutes and
 *  upward. Somebody enumerating uses a DIFFERENT address every time, so every
 *  attempt is the first of its streak and the lockout never engages. The
 *  mechanism that bounds a password guess does not bound a probe.
 *
 *  WHAT IS MISSING, and it is the useful half: `login_attempts` has no IP
 *  column, so "one address tried across many clubs" is answerable and "many
 *  addresses from one source" is not. Adding it means changing a function on
 *  the sign-in hot path and is its own increment. Said out loud on the screen
 *  rather than left for somebody to assume the absence means innocence.
 */

/** A club's own domain, from an address that DOES belong to it. */
export function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** Levenshtein, capped — we only care whether two domains are within a couple
 *  of edits, so anything further is not worth computing exactly. */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length] ?? cap + 1;
}

export type ProbeVerdict = 'typo' | 'unknown-domain';

/**
 * Is this unmatched address most likely somebody mistyping their own, or an
 * address that has nothing to do with any club here?
 *
 * THIS IS THE DIFFERENCE BETWEEN A SUPPORT TICKET AND A SECURITY EVENT, and
 * getting it the wrong way round in either direction is bad: chasing a coach
 * who typed their own address wrong wastes everybody's time, and waving away a
 * probe because the list is mostly typos is how the real one gets missed.
 *
 * Production's only unmatched attempt is the worked example —
 * `a.selby@ashcombefc.example` against a real club domain of
 * `ashcomberfc.example`. One missing letter. That is a person, not an attacker.
 *
 * Deliberately conservative: only a domain within two edits of one this
 * installation actually serves counts as a typo. Everything else is reported as
 * an unknown domain, which is a statement about the domain and NOT an
 * accusation — most will be equally innocent.
 */
export function classifyProbe(email: string, knownDomains: readonly string[]): ProbeVerdict {
  const domain = domainOf(email);
  if (!domain) return 'unknown-domain';
  if (knownDomains.includes(domain)) return 'typo';
  for (const known of knownDomains) {
    if (editDistance(domain, known, 2) <= 2) return 'typo';
  }
  return 'unknown-domain';
}

/** Mask the local part for display. The domain is the signal — whether
 *  somebody is probing a club's address space — and the local part is
 *  attacker-supplied text that a support screen has no reason to render in
 *  full. Enough is kept to recognise a colleague's mistyped address. */
export function maskLocalPart(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? '•'}•${domain}`;
  return `${local.slice(0, 2)}${'•'.repeat(Math.min(local.length - 2, 6))}${domain}`;
}
