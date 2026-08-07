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
import { enumLabel } from '@/lib/format';

type Props = { orgId: string; userId: string; weekStart: string; teams: readonly Team[]; board: WeekBoard; canAllocate: boolean };

const AVAIL_PILL: Record<string, string> = {
  available: 'pill-good',
  modified: 'pill-warn',
  unavailable: 'pill-bad',
};

/** screens/team-allocation.md, simplified to one team-picker row per athlete rather
 *  than drag and drop — see the query file's header for the full list of cuts. A
 *  team-picker also makes "allocated to two teams at once" structurally
 *  impossible, which is why that specific warning from the spec isn't built here:
 *  the UI shape already refuses it. */
export function TeamAllocationBoard({ orgId, userId, weekStart, teams, board, canAllocate }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingReasonFor, setPendingReasonFor] = useState<{ athleteId: string; teamId: string } | null>(null);
  const [reason, setReason] = useState('');

  const allocMutation = useMutation({
    mutationFn: (input: { athleteId: string; teamId: string; overrideReason: string | null }) =>
      setTeamAllocation(createClient(), orgId, userId, { ...input, weekStart }),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setPendingReasonFor(null);
      setReason('');
      router.refresh();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (allocationId: string) => withdrawAllocation(createClient(), orgId, allocationId),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      router.refresh();
    },
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
          <p className="tiny" style={{ marginTop: 4 }}>
            Give a reason to allocate them anyway. This is recorded against the allocation.
          </p>
          <input
            className="field"
            style={{ marginTop: 8 }}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Cleared verbally, modified role only, etc."
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
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
              {team.name} <span className="tiny mono">{rows.length}</span>
            </h2>
            {rows.length === 0 ? (
              <p className="tiny">No one allocated yet.</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {rows.map((a) => (
                  <div key={a.id} className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                    <span className="nm">
                      {a.first_name} {a.last_name}
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
          Unallocated <span className="tiny mono">{board.unallocated.length}</span>
        </h2>
        {board.unallocated.length === 0 ? (
          <p className="tiny">Everyone is on a team this week.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {board.unallocated.map((a) => (
              <div key={a.athlete_id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="nm" style={{ flex: 1 }}>
                    {a.first_name} {a.last_name}
                  </span>
                  {a.availability ? (
                    <span className={`pill ${AVAIL_PILL[a.availability] ?? 'pill-neutral'}`}>
                      {enumLabel(a.availability)}
                    </span>
                  ) : null}
                </div>
                {canAllocate ? (
                  <div className="chiprow" style={{ marginTop: 6 }}>
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className="squad-chip"
                        onClick={() => pickTeam(a.athlete_id, team.id, a.availability)}
                        disabled={allocMutation.isPending}
                      >
                        {team.short_name ?? team.name}
                      </button>
                    ))}
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
