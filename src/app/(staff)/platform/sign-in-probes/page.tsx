import { requirePlatformStaff } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyProbe, domainOf, maskLocalPart, type ProbeVerdict } from '@/lib/signInProbes';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Sign-in probes · Fydr' };

/** Sign-in attempts against addresses that belong to no organisation.
 *
 *  A FYDR SURFACE, NOT A CLUB'S. An address that belongs to no organisation
 *  cannot sensibly appear in one organisation's audit log, and putting it in a
 *  club's own screens would show every club the attempts made against every
 *  other club's non-existent addresses. The question worth asking of this data
 *  — is one source walking an address space across clubs — is not answerable
 *  per-organisation at all, which is why this is a platform view rather than an
 *  org-less read path in `/settings/audit`.
 *
 *  THE DATA WAS ALREADY THERE. `login_attempts` keys on the email and
 *  `login_attempt_record_result` deletes the row on SUCCESS. An address that
 *  matches no account never succeeds, so its row is never deleted — every
 *  unmatched attempt since August is still sitting there with a null `org_id`,
 *  and nothing had ever read it. This screen adds no write path.
 *
 *  READ AS THE SERVICE ROLE, and that is not a shortcut. `login_attempts_admin_select`
 *  is `org_id = auth_org_id()`, and every row here has a null org_id, so an
 *  authenticated read returns nothing at all. There is no policy that can
 *  express "Fydr's staff" because Fydr's staff have no database identity — see
 *  lib/platformStaff.ts — so `requirePlatformStaff()` above is the entire
 *  protection on this page. */
export default async function SignInProbesPage() {
  const { timezone } = await requirePlatformStaff();

  const admin = createAdminClient();

  const [{ data: probes }, { data: orgUsers }] = await Promise.all([
    admin
      .from('login_attempts')
      .select('email, attempt_count, lock_count, locked_until, last_attempt_at, created_at')
      .is('org_id', null)
      .order('last_attempt_at', { ascending: false })
      .limit(500),
    // Every domain this installation actually serves, to tell a mistyped
    // address from an unrelated one.
    admin.from('users').select('email').is('deleted_at', null),
  ]);

  const knownDomains = [
    ...new Set((orgUsers ?? []).map((u) => domainOf(u.email ?? '')).filter((d): d is string => Boolean(d))),
  ];

  const rows: Row[] = (probes ?? []).map((p) => ({
    masked: maskLocalPart(p.email ?? ''),
    domain: domainOf(p.email ?? '') ?? '—',
    verdict: classifyProbe(p.email ?? '', knownDomains),
    attempts: p.attempt_count ?? 0,
    locks: p.lock_count ?? 0,
    last: p.last_attempt_at,
    first: p.created_at,
  }));

  const probeRows = rows.filter((r) => r.verdict === 'unknown-domain');
  const typoRows = rows.filter((r) => r.verdict === 'typo');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Fydr platform · not a club surface</p>
          <h1>Sign-in probes</h1>
        </div>
      </div>

      <p className="tiny" style={{ marginBottom: 14 }}>
        Sign-in attempts against email addresses that belong to no organisation on this
        installation. Attempts against real accounts are that club&rsquo;s own business and
        appear in their own audit log as <code>auth.sign_in_failed</code>.
      </p>

      {/* WHAT THIS SCREEN CANNOT TELL YOU, on the screen rather than left for
          somebody to read a short list as meaning nothing is happening. */}
      <div className="banner" role="note" style={{ marginBottom: 18 }}>
        <div>
          <strong>No source address is recorded.</strong> <code>login_attempts</code> has no IP
          column, so &ldquo;one address tried across many clubs&rdquo; is answerable below and
          &ldquo;many addresses from one source&rdquo; is not — and enumeration is exactly the
          second shape. Adding it means changing a function on the sign-in hot path, and is
          separate work.
          <br />
          <br />
          The five-failure lockout does <strong>not</strong> bound what you see here. The streak
          is counted per email, so somebody walking an address space uses a different address
          every time, every attempt is the first of its own streak, and the lockout never
          engages.
        </div>
      </div>

      <p className="sect" style={{ marginBottom: 8 }}>
        Unrelated domains · {probeRows.length}
      </p>
      <p className="tiny" style={{ marginBottom: 10 }}>
        Domains more than two edits from any this installation serves. That is a statement about
        the domain, not an accusation — most will be equally innocent.
      </p>
      {probeRows.length === 0 ? (
        <p className="empty">None recorded.</p>
      ) : (
        <ProbeTable rows={probeRows} timeZone={timezone} />
      )}

      <p className="sect" style={{ margin: '26px 0 8px' }}>
        Likely mistyped · {typoRows.length}
      </p>
      <p className="tiny" style={{ marginBottom: 10 }}>
        Within two edits of a real club domain, or that domain exactly with an unrecognised name.
        Almost always somebody getting their own address wrong — a support question, not a
        security one.
      </p>
      {typoRows.length === 0 ? (
        <p className="empty">None recorded.</p>
      ) : (
        <ProbeTable rows={typoRows} timeZone={timezone} />
      )}
    </>
  );
}

type Row = {
  masked: string;
  domain: string;
  verdict: ProbeVerdict;
  attempts: number;
  locks: number;
  last: string | null;
  first: string | null;
};

function ProbeTable({ rows, timeZone }: { rows: Row[]; timeZone: string }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Address</th>
            <th>Domain</th>
            <th className="num">Attempts</th>
            <th className="num">Lockouts</th>
            <th>First seen</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.masked}-${r.first ?? ''}`}>
              {/* The local part is masked: it is caller-supplied text, and the
                  domain is the part that carries the signal. */}
              <td>{r.masked}</td>
              <td>{r.domain}</td>
              <td className="num">{r.attempts}</td>
              <td className="num">{r.locks}</td>
              <td>{r.first ? formatDate(r.first, timeZone) : '—'}</td>
              <td>{r.last ? formatDate(r.last, timeZone) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
