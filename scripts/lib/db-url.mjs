/* Which database URL to actually use, given that the direct host may be
 * unreachable from where this is running.
 *
 * THE PROBLEM THIS SOLVES, because it does not look like what it is.
 * `db.<ref>.supabase.co` publishes an AAAA record and no A record. On a machine
 * with no routable IPv6, `getaddrinfo` fails with ENOTFOUND — the same error a
 * misspelt hostname gives — while `host` and `dig` cheerfully print the AAAA and
 * make it look like DNS is fine and the failure is intermittent. It is neither
 * intermittent nor DNS: the name resolves, there is just no address family the
 * process can use.
 *
 * That cost real time on 2026-09-06, when production database access vanished
 * mid-session and read as flakiness for several attempts. Hence this file, and
 * hence the specific check below: an AAAA-only answer plus a failing lookup is
 * diagnosed rather than retried.
 *
 * The pooler (`aws-N-<region>.pooler.supabase.com`) is IPv4 and is the same
 * database. It is a fallback rather than the default because the direct
 * connection is what Supabase's own tooling assumes, and because a session
 * pooler holds a real session — some things (advisory locks, `set local role`
 * across statements in a transaction) behave the same, but leaning on it by
 * default would mean discovering any difference at the worst moment. */
import { lookup, resolve4, resolve6 } from 'node:dns/promises';

async function reachable(hostname) {
  try {
    await lookup(hostname);
    return { ok: true };
  } catch (err) {
    if (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN') return { ok: false, why: err.code };
    /* Distinguish "no such name" from "name exists, wrong address family",
       because the remedy is completely different and the error code is not. */
    const [v4, v6] = await Promise.all([
      resolve4(hostname).catch((e) => e.code),
      resolve6(hostname).catch((e) => e.code),
    ]);
    const hasV6 = Array.isArray(v6) && v6.length > 0;
    const hasV4 = Array.isArray(v4) && v4.length > 0;
    if (hasV6 && !hasV4) return { ok: false, why: 'ipv6-only host, no usable IPv6 route from here' };
    return { ok: false, why: err.code };
  }
}

/** Resolve the URL to connect with, preferring the direct host.
 *
 *  Returns { url, via, note } so a caller can SAY which route it took. A script
 *  that silently switched databases-by-another-name would be a bad thing to have
 *  built, given how much of this project's verification depends on knowing
 *  exactly which database was measured. */
export async function resolveDbUrl({ direct, pooler, label = 'database' } = {}) {
  if (!direct && !pooler) throw new Error(`No connection string configured for the ${label}.`);
  if (!direct) return { url: pooler, via: 'pooler', note: 'no direct URL configured' };

  const host = new URL(direct).hostname;
  const check = await reachable(host);
  if (check.ok) return { url: direct, via: 'direct', note: null };
  if (!pooler) {
    throw new Error(
      `The ${label}'s direct host ${host} is unreachable (${check.why}), and no pooler URL is configured. ` +
        `Set SUPABASE_DB_POOLER_URL to the IPv4 session-pooler string from the Supabase dashboard.`,
    );
  }
  return { url: pooler, via: 'pooler', note: `${host} unreachable: ${check.why}` };
}
