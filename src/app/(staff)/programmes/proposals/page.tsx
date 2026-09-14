import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { TableShell } from '@/components/TableShell/TableShell';
import { CLINICAL_ONLY, INJURY_PROGRAMME_PROPOSER, hasAnyRole } from '@/lib/access';
import { formatDateTime } from '@/lib/format';
import { PROPOSAL_STATUS, fetchProposals } from '@/lib/queries/proposals';
import { refuse, requireStaff } from '@/lib/session';

export const metadata = { title: 'Rehab proposals · Fydr' };

/** PATTERN-S3 C6 (0124): rehab programme proposals — Proposed, Approved,
 *  Returned — in one list the S&C and the medic both see, one row shape.
 *  The medic decides here (approve, or return with a required reason, shown
 *  in full); the S&C reads where each stands and why one came back, on the
 *  row, not in person. docs/screens/66-rehab-proposals.md. */
export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  const isMedic = hasAnyRole(claims.roles, CLINICAL_ONLY);
  const isProposer = hasAnyRole(claims.roles, INJURY_PROGRAMME_PROPOSER);
  if (!isMedic && !isProposer) await refuse(db, 'proposals', '/programmes/proposals');
  const { p } = await searchParams;
  const rows = await fetchProposals(db, orgId);
  const ids = [...new Set(rows.flatMap((r) => [r.proposed_by, r.decided_by]).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await db.from('users').select('id, full_name').eq('org_id', orgId).in('id', ids);
    for (const u of users ?? []) names.set(u.id, u.full_name);
  }
  const counts = { proposed: rows.filter((r) => r.state === 'proposed').length, approved: rows.filter((r) => r.state === 'approved').length, returned: rows.filter((r) => r.state === 'returned').length };
  const notices: Record<string, string> = {
    approved: 'Approved. The block is live for the athlete.',
    returned: 'Returned, with your reason on the row.',
    reason_required: 'Not saved: say why it is coming back — the S&C reads the reason here.',
    not_a_proposal: 'Not saved: that row has already been decided.',
    refused: 'Deciding a proposal belongs to the medic.',
    failed: 'Not saved. Try again.',
  };

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> · Rehab proposals
          </p>
          <h1>Rehab proposals</h1>
        </div>
      </div>
      <p className="import-sub" style={{ marginTop: -6, marginBottom: 'var(--sp-14)' }}>
        Gym work proposed by the S&amp;C against an open injury. It reaches the athlete only when the physiotherapist approves it; a returned
        one carries the reason here, in full, so the next draft answers it.
      </p>
      {p && notices[p] ? (
        <p className={/Not saved|belongs/.test(notices[p]!) ? 'form-error' : 'tiny'} role={/Not saved/.test(notices[p]!) ? 'alert' : 'status'} style={{ marginBottom: 'var(--sp-14)' }}>
          {notices[p]}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No proposals" body="Nothing has been proposed against an open injury. The S&C proposes from the programme's assign screen when the athlete has an open injury." />
      ) : (
        <TableShell
          title="Proposals"
          titleId="proposals-title"
          sort="Newest first"
          count={`${rows.length} proposal${rows.length === 1 ? '' : 's'} · ${counts.proposed} proposed, ${counts.approved} approved, ${counts.returned} returned`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-cards">
              <caption className="visually-hidden">Rehab programme proposals</caption>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col">Programme</th>
                  <th scope="col">Proposed</th>
                  <th scope="col">State</th>
                  <th scope="col">Decision</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-proposal={r.state}>
                    <td className="nm" data-label="Athlete">
                      <Link href={`/injuries/${r.injury_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {r.athlete_name}
                      </Link>
                    </td>
                    <td data-label="Programme">{r.programme_name}</td>
                    <td className="sub num" data-label="Proposed">
                      {r.proposed_by ? (names.get(r.proposed_by) ?? 'S&C') : 'S&C'} · {formatDateTime(r.proposed_at, timezone)}
                    </td>
                    <td data-label="State">
                      <Pill status={PROPOSAL_STATUS[r.state]} />
                    </td>
                    <td className="sub" data-label="Decision">
                      {r.state === 'proposed'
                        ? 'Waiting on the physiotherapist'
                        : `${r.decided_by ? (names.get(r.decided_by) ?? 'Medic') : 'Medic'}${r.decided_at ? ` · ${formatDateTime(r.decided_at, timezone)}` : ''}`}
                      {r.state === 'returned' && r.return_reason ? (
                        <span style={{ display: 'block', marginTop: 'var(--sp-4)', color: 'var(--text)' }} data-return-reason>
                          {r.return_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="r" data-label="">
                      {isMedic && r.state === 'proposed' ? (
                        <form method="post" action={`/programmes/proposals/${r.id}/decide`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', minWidth: 220 }}>
                          <button type="submit" name="decision" value="approve" className="btn-primary">
                            Approve
                          </button>
                          <input name="reason" className="field" placeholder="Reason, if returning" aria-label="Reason for returning" maxLength={500} />
                          <button type="submit" name="decision" value="return" className="btn-ghost">
                            Return with the reason
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableShell>
      )}
    </>
  );
}
