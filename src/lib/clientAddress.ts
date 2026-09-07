/* Where a request actually came from.
 *
 * WHY THIS EXISTS. `auth.sessions.ip` stopped meaning anything when sign-in
 * moved out of the browser and into POST /auth/sign-in: Supabase sees the
 * Vercel function, not the visitor, so every production login since carries an
 * address that looks like a record of where somebody signed in from and is
 * really a record of which serverless instance answered. It reads as three
 * different origins in a week because the function's address varies. That cost
 * a real investigation on 2026-09-07, when an ordinary athlete login was
 * examined as a possible intrusion because the origin was an AWS address with a
 * `node` user agent.
 *
 * GoTrue honours a forwarded address — tested against scratch before any of
 * this was written, by creating a session through supabase-js with
 * X-Forwarded-For set to 203.0.113.45 and reading auth.sessions back: it
 * recorded 203.0.113.45/32, and the forwarded User-Agent too. So the field can
 * be repaired rather than replaced by a second place people have to know to
 * look for.
 *
 * THE TRAP, AND IT IS THE WHOLE DESIGN. A client can send any X-Forwarded-For
 * it likes. Forwarding one blindly would replace a value that is merely
 * uninformative with one an attacker chooses — strictly worse, because the
 * current value is at least honestly "the platform", while a spoofed one would
 * be read as evidence. So:
 *
 *   1. Platform headers first. Vercel sets x-vercel-forwarded-for and x-real-ip
 *      itself; neither is settable by the caller.
 *   2. Then the LAST entry of x-forwarded-for, not the first. Proxies APPEND
 *      the peer they received from, so the rightmost hop is the one written by
 *      the nearest proxy and the leftmost is whatever the client claimed. Every
 *      "take the first entry" implementation of this is a spoof waiting to
 *      happen.
 *   3. Whatever comes out must parse as an IP literal, or it is discarded.
 *
 * If nothing survives that, this returns null and the caller forwards nothing —
 * which leaves today's behaviour exactly as it is. Degrading to "the platform's
 * address" is acceptable; degrading to "an address the visitor chose" is not.
 */

/** Platform-set headers, in the order they are trusted. Neither can be set by
 *  the caller: Vercel writes them at its edge and overwrites anything inbound. */
const PLATFORM_HEADERS = ['x-vercel-forwarded-for', 'x-real-ip'] as const;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Is this a syntactically real IP literal?
 *
 *  Deliberately strict rather than clever: an `inet` column will reject
 *  anything else anyway, and a permissive check here would push a malformed
 *  value all the way to a database error on a sign-in. IPv6 is matched loosely
 *  (hex groups and colons, optionally a zone or an embedded IPv4) because
 *  enumerating every valid compressed form is how this kind of function grows a
 *  bug; anything that shape is handed on and Postgres has the final say. */
export function isIpLiteral(value: string): boolean {
  const v = value.trim();
  if (v === '') return false;
  const v4 = IPV4.exec(v);
  if (v4) return v4.slice(1).every((o) => Number(o) <= 255 && !(o.length > 1 && o.startsWith('0')));
  if (v.includes(':')) return /^[0-9a-fA-F:.%]+$/.test(v) && (v.match(/:/g)?.length ?? 0) >= 2;
  return false;
}

/** The visitor's address, or null when nothing trustworthy is available. */
export function clientAddress(headers: Headers): string | null {
  for (const name of PLATFORM_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    /* x-vercel-forwarded-for can itself be a list; the platform's own entry is
       the last one for the same reason as below. */
    const candidate = raw.split(',').pop()?.trim() ?? '';
    if (isIpLiteral(candidate)) return candidate;
  }

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const nearest = xff.split(',').pop()?.trim() ?? '';
    if (isIpLiteral(nearest)) return nearest;
  }
  return null;
}

/** The visitor's browser, or null.
 *
 *  Forwarded alongside the address for the same reason: `auth.sessions.user_agent`
 *  currently reads `node` for every production login, which is the serverless
 *  runtime rather than anybody's browser, and is the other half of what made
 *  that investigation take as long as it did. Unlike the address this one is
 *  client-supplied by nature and always has been — a browser sends its own
 *  User-Agent — so forwarding it changes who is claiming it, not how much it
 *  can be trusted. */
export function clientUserAgent(headers: Headers): string | null {
  const ua = headers.get('user-agent');
  return ua && ua.trim() !== '' ? ua.trim().slice(0, 512) : null;
}

/** The headers to add to a Supabase client so GoTrue records the visitor
 *  rather than the function. Empty when nothing is known, so the caller can
 *  spread it unconditionally. */
export function forwardedIdentityHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const ip = clientAddress(headers);
  if (ip) out['X-Forwarded-For'] = ip;
  const ua = clientUserAgent(headers);
  if (ua) out['User-Agent'] = ua;
  return out;
}
