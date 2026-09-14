import type { Status } from '@/lib/status';
import type { Db } from './groups';

/* PATTERN-S3 C6 (0124): the proposals list — one row shape, three states,
 * read by the S&C and the medic alike (programme_assignments is theirs to
 * read already). Approved is the board's word for the row that stores
 * 'active' with an injury behind it: approval assigns, the same row is the
 * athlete's programme. */

export type ProposalState = 'proposed' | 'approved' | 'returned';

export type ProposalRow = {
  id: string;
  state: ProposalState;
  programme_name: string;
  athlete_id: string;
  athlete_name: string;
  injury_id: string;
  proposed_by: string | null;
  proposed_at: string;
  decided_by: string | null;
  decided_at: string | null;
  return_reason: string | null;
};

export async function fetchProposals(db: Db, orgId: string): Promise<ProposalRow[]> {
  const { data, error } = await db
    .from('programme_assignments')
    .select('id, status, programme_id, athlete_id, injury_id, assigned_by, created_at, decided_by, decided_at, return_reason, programmes(name), athletes(first_name, last_name)')
    .eq('org_id', orgId)
    .not('injury_id', 'is', null)
    .in('status', ['proposed', 'active', 'returned'])
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r): r is typeof r & { injury_id: string; athlete_id: string } => r.injury_id !== null && r.athlete_id !== null)
    .map((r) => ({
      id: r.id,
      state: r.status === 'proposed' ? 'proposed' : r.status === 'returned' ? 'returned' : 'approved',
      programme_name: (r.programmes as { name: string } | null)?.name ?? 'Programme',
      athlete_id: r.athlete_id,
      athlete_name: `${(r.athletes as { first_name: string; last_name: string } | null)?.first_name ?? ''} ${(r.athletes as { first_name: string; last_name: string } | null)?.last_name ?? ''}`.trim(),
      injury_id: r.injury_id,
      proposed_by: r.assigned_by,
      proposed_at: r.created_at,
      decided_by: r.decided_by,
      decided_at: r.decided_at,
      return_reason: r.return_reason,
    }));
}

export const PROPOSAL_WORDS: Record<ProposalState, string> = { proposed: 'Proposed', approved: 'Approved', returned: 'Returned' };

/** The three states as pills — tone, glyph and word (lib/status.ts's rule). */
export const PROPOSAL_STATUS: Record<ProposalState, Status> = {
  proposed: { tone: 'accent', glyph: '◐', label: 'Proposed' },
  approved: { tone: 'good', glyph: '✓', label: 'Approved' },
  returned: { tone: 'warn', glyph: '↩', label: 'Returned' },
};
