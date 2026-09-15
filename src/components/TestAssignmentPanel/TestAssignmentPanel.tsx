'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { assignTest, unassignTest, type AssignTarget, type TestAssignment } from '@/lib/queries/testing';

/* The assign control on a test definition — migration 0130 (decision batch
 * 14 September 2026, #3): "Tests are assignable to both groups and individual
 * athletes." A test starts assigned to the whole squad (the explicit
 * whole-squad row every definition gets). Narrowing it: retire the
 * whole-squad row and add groups and athletes. Widening it back: add the
 * whole-squad row again. Every row is a chip with its own remove; the
 * sentence above the chips says who that means today, from the database's
 * own resolution (the page passes the count). No confirmation: nothing here
 * is destructive — a result already logged stays logged, and a removed
 * assignment is a removed_at, not a delete.
 *
 * Who may use it: the roles that define a test (test_assignments' policies
 * mirror test_definitions'). The page hands `canManage`; a role without it
 * reads the chips and no controls. */
type Props = {
  orgId: string;
  userId: string;
  testDefinitionId: string;
  testName: string;
  assignments: TestAssignment[];
  groups: readonly { id: string; name: string }[];
  athletes: readonly { id: string; first_name: string; last_name: string }[];
  assignedCount: number;
  canManage: boolean;
};

export function TestAssignmentPanel({ orgId, userId, testDefinitionId, testName, assignments, groups, athletes, assignedCount, canManage }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [groupPick, setGroupPick] = useState('');
  const [athletePick, setAthletePick] = useState('');

  const wholeSquad = assignments.find((a) => a.group_id === null && a.athlete_id === null) ?? null;
  const groupRows = assignments.filter((a) => a.group_id !== null);
  const athleteRows = assignments.filter((a) => a.athlete_id !== null);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? 'A group no longer on record';
  const athleteName = (id: string) => {
    const a = athletes.find((x) => x.id === id);
    return a ? `${a.first_name} ${a.last_name}` : 'An athlete no longer on the squad';
  };

  const add = useMutation({
    mutationFn: async (target: AssignTarget) => {
      const result = await withWriteTimeout(assignTest(createClient(), orgId, userId, testDefinitionId, target));
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setError(null);
      setGroupPick('');
      setAthletePick('');
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });
  const remove = useMutation({
    mutationFn: async (assignmentId: string) => {
      const result = await withWriteTimeout(unassignTest(createClient(), orgId, assignmentId));
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });
  const busy = add.isPending || remove.isPending;

  const who =
    assignments.length === 0
      ? `Assigned to nobody. ${testName} appears on no sheet and no report until it is assigned.`
      : wholeSquad
        ? `Assigned to the whole squad — ${assignedCount} athlete${assignedCount === 1 ? '' : 's'} in data today${groupRows.length + athleteRows.length > 0 ? '; the groups and athletes below add nothing while the whole squad is assigned' : ''}.`
        : `Assigned to ${assignedCount} athlete${assignedCount === 1 ? '' : 's'} today: ${[...groupRows.map((r) => groupName(r.group_id!)), ...athleteRows.map((r) => athleteName(r.athlete_id!))].join(', ')}. A group is read as its members now, so an athlete who joins or leaves it is assigned or not with it.`;

  return (
    <section className="card" aria-labelledby="assign-title" data-test-assignment>
      <h2 className="card-title" id="assign-title" style={{ margin: 0 }}>
        Who this test is for
      </h2>
      <p className="tiny" style={{ margin: 'var(--sp-6) 0 var(--sp-10)' }}>
        {who}
      </p>

      <div className="chiprow">
        {wholeSquad ? (
          <span className="squad-chip" aria-pressed="true">
            Whole squad
            {canManage ? (
              <button type="button" className="chip-x" aria-label="Stop assigning the whole squad" disabled={busy} onClick={() => remove.mutate(wholeSquad.id)}>
                ×
              </button>
            ) : null}
          </span>
        ) : null}
        {groupRows.map((r) => (
          <span key={r.id} className="squad-chip" aria-pressed="true">
            {groupName(r.group_id!)}
            {canManage ? (
              <button type="button" className="chip-x" aria-label={`Remove ${groupName(r.group_id!)}`} disabled={busy} onClick={() => remove.mutate(r.id)}>
                ×
              </button>
            ) : null}
          </span>
        ))}
        {athleteRows.map((r) => (
          <span key={r.id} className="squad-chip" aria-pressed="true">
            {athleteName(r.athlete_id!)}
            {canManage ? (
              <button type="button" className="chip-x" aria-label={`Remove ${athleteName(r.athlete_id!)}`} disabled={busy} onClick={() => remove.mutate(r.id)}>
                ×
              </button>
            ) : null}
          </span>
        ))}
        {assignments.length === 0 ? <span className="tiny">Nobody yet.</span> : null}
      </div>

      {canManage ? (
        <div style={{ display: 'flex', gap: 'var(--sp-10)', flexWrap: 'wrap', alignItems: 'end', marginTop: 'var(--sp-12)' }}>
          {!wholeSquad ? (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => add.mutate({ kind: 'squad' })}>
              + Whole squad
            </button>
          ) : null}
          <label className="tiny" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            Add a group
            <span style={{ display: 'flex', gap: 'var(--sp-6)' }}>
              <select className="field" value={groupPick} onChange={(e) => setGroupPick(e.target.value)} aria-label="Group to assign" style={{ minWidth: 160 }}>
                <option value="">Choose a group…</option>
                {groups
                  .filter((g) => !groupRows.some((r) => r.group_id === g.id))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn-ghost" disabled={busy || !groupPick} onClick={() => add.mutate({ kind: 'group', groupId: groupPick })}>
                Add
              </button>
            </span>
          </label>
          <label className="tiny" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            Add an athlete
            <span style={{ display: 'flex', gap: 'var(--sp-6)' }}>
              <select className="field" value={athletePick} onChange={(e) => setAthletePick(e.target.value)} aria-label="Athlete to assign" style={{ minWidth: 200 }}>
                <option value="">Choose an athlete…</option>
                {athletes
                  .filter((a) => !athleteRows.some((r) => r.athlete_id === a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn-ghost" disabled={busy || !athletePick} onClick={() => add.mutate({ kind: 'athlete', athleteId: athletePick })}>
                Add
              </button>
            </span>
          </label>
        </div>
      ) : (
        <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
          The sport scientist, a coach, the medic or the S&amp;C assigns a test.
        </p>
      )}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
