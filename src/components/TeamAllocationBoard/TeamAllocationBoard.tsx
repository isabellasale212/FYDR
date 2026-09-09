'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  setTeamAllocation,
  withdrawAllocation,
  type AllocationRow,
  type Team,
  type WeekBoard,
} from '@/lib/queries/teamAllocation';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { enumLabel, formatDate } from '@/lib/format';

type Props = { orgId: string; userId: string; weekStart: string; teams: readonly Team[]; board: WeekBoard; canAllocate: boolean; timezone: string };
/* canAllocate is the board's own gate and already worked: it was never one of
   G-34's six. What was wrong is what the PAGE resolved it from — isCoach, which
   omits the sport scientist that 0070 grants. Fixed at the call site. */

const AVAIL_PILL: Record<string, string> = {
  available: 'pill-good',
  modified: 'pill-warn',
  unavailable: 'pill-bad',
};

/** THE LIMITED INJURY VIEW, one line, shared by both row shapes on this board.
 *
 *  Decided by Isabella 2026-09-09 (29-team-allocation.md): this screen shows the
 *  same four non-clinical fields every other coach-facing screen shows, because it
 *  was the only one that did not — and picking a side needs "modified · shoulder ·
 *  no contact", not a bare "modified".
 *
 *  Two-then-overflow on restrictions, the shape AvailabilityList.tsx established
 *  for this field: two labels read at a glance, a count for the rest rather than a
 *  wrapped list. Renders nothing at all for a fully available athlete, so the board
 *  does not grow a blank line per row. */
function InjuryLine({
  row,
  timezone,
}: {
  row: Pick<AllocationRow, 'restrictions' | 'body_area' | 'side' | 'expected_return'>;
  timezone: string;
}) {
  const parts = [
    row.body_area ? `${enumLabel(row.body_area)}${row.side ? ` · ${enumLabel(row.side)}` : ''}` : null,
    row.restrictions.length > 0
      ? row.restrictions.slice(0, 2).map(enumLabel).join(' · ') +
        (row.restrictions.length > 2 ? ` +${row.restrictions.length - 2}` : '')
      : null,
    row.expected_return ? `back ${formatDate(row.expected_return, timezone)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="tiny">{parts.join(' · ')}</div>;
}

/** screens/team-allocation.md, simplified to one team-picker row per athlete rather
 *  than drag and drop — see the query file's header for the full list of cuts. A
 *  team-picker also makes "allocated to two teams at once" structurally
 *  impossible, which is why that specific warning from the spec isn't built here:
 *  the UI shape already refuses it. */
export function TeamAllocationBoard({ orgId, userId, weekStart, teams, board, canAllocate, timezone }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingReasonFor, setPendingReasonFor] = useState<{ athleteId: string; teamId: string } | null>(null);
  const [reason, setReason] = useState('');

  const allocMutation = useMutation({
    mutationFn: (input: { athleteId: string; teamId: string; overrideReason: string | null }) =>
      withWriteTimeout(setTeamAllocation(createClient(), orgId, userId, { ...input, weekStart })),
    onSuccess: (result) => {
      /* result.error is already written for the screen — teamAllocation.ts
         humanizes raw driver errors and keeps its own bespoke guidance. */
      if (result.error) return setError(result.error);
      setError(null);
      setPendingReasonFor(null);
      setReason('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const withdrawMutation = useMutation({
    mutationFn: (allocationId: string) => withWriteTimeout(withdrawAllocation(createClient(), orgId, allocationId)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  function allocationsForTeam(teamId: string): AllocationRow[] {
    return board.allocations.filter((a) => a.team_id === teamId);
  }

  function pickTeam(athleteId: string, teamId: string, availability: string | null) {
    if (availability && availability !== 'available') {
      setPendingReasonFor({ athleteId, teamId });
      setReason('');
      return;
    }
    allocMutation.mutate({ athleteId, teamId, overrideReason: null });
  }

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {pendingReasonFor ? (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <p className="label">This athlete is not fully available</p>
          <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
            Give a reason to allocate them anyway. This is recorded against the allocation.
          </p>
          <input
            className="field"
            style={{ marginTop: 'var(--sp-8)' }}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Cleared verbally, modified role only, etc."
          />
          <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-10)' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!reason.trim() || allocMutation.isPending}
              onClick={() =>
                allocMutation.mutate({
                  athleteId: pendingReasonFor.athleteId,
                  teamId: pendingReasonFor.teamId,
                  overrideReason: reason.trim(),
                })
              }
            >
              {allocMutation.isPending ? 'Working…' : 'Allocate anyway'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPendingReasonFor(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {teams.map((team) => {
        const rows = allocationsForTeam(team.id);
        return (
          <section key={team.id} className="card" aria-labelledby={`team-${team.id}`}>
            <h2 className="card-title" id={`team-${team.id}`}>
              {team.name} <span className="tiny num">{rows.length}</span>
            </h2>
            {rows.length === 0 ? (
              <p className="tiny">No one allocated yet.</p>
            ) : (
              <div className="stack" style={{ gap: 'var(--sp-6)' }}>
                {rows.map((a) => (
                  <div key={a.id} className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="nm" style={{ display: 'block' }}>
                        {a.first_name} {a.last_name}
                      </span>
                      <InjuryLine row={a} timezone={timezone} />
                    </span>
                    <span className={`pill ${a.status === 'published' ? 'pill-good' : 'pill-neutral'}`}>
                      {enumLabel(a.status)}
                    </span>
                    {canAllocate ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => withdrawMutation.mutate(a.id)}
                        disabled={withdrawMutation.isPending}
                      >
                        Withdraw
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="card" aria-labelledby="unallocated-title">
        <h2 className="card-title" id="unallocated-title">
          Unallocated <span className="tiny num">{board.unallocated.length}</span>
        </h2>
        {board.unallocated.length === 0 ? (
          <p className="tiny">Everyone is on a team this week.</p>
        ) : (
          <div className="stack" style={{ gap: 'var(--sp-10)' }}>
            {board.unallocated.map((a) => (
              <div key={a.athlete_id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)' }}>
                  <span className="nm" style={{ flex: 1 }}>
                    {a.first_name} {a.last_name}
                  </span>
                  {a.availability ? (
                    <span className={`pill ${AVAIL_PILL[a.availability] ?? 'pill-neutral'}`}>
                      {enumLabel(a.availability)}
                    </span>
                  ) : null}
                </div>
                <InjuryLine row={a} timezone={timezone} />
                {canAllocate ? (
                  /* One <select> rather than a chip per team: a club with more
                   * than a handful of teams turned this into a wrapping wall of
                   * buttons on every unallocated athlete's row. Value is pinned
                   * to '' so the control always reads "Allocate to…" — the row
                   * itself disappears on the router.refresh() that follows a
                   * successful allocation, and an athlete who needs an override
                   * reason should see the prompt, not a select that looks
                   * already-set. */
                  <div style={{ marginTop: 'var(--sp-6)' }}>
                    <label className="visually-hidden" htmlFor={`alloc-${a.athlete_id}`}>
                      Allocate {a.first_name} {a.last_name} to a team
                    </label>
                    <select
                      id={`alloc-${a.athlete_id}`}
                      className="field"
                      value=""
                      disabled={allocMutation.isPending}
                      onChange={(event) => {
                        const teamId = event.target.value;
                        if (teamId) pickTeam(a.athlete_id, teamId, a.availability);
                      }}
                    >
                      <option value="">Allocate to…</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
