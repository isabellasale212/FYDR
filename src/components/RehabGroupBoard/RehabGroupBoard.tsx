'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  allocateToRehabGroup,
  removeFromRehabGroup,
  setRehabPhase,
  type RehabGroup,
  type RehabMember,
} from '@/lib/queries/rehabGroups';
import { humanizeDbError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { enumLabel, formatDate } from '@/lib/format';

type Props = {
  orgId: string;
  userId: string;
  groups: readonly RehabGroup[];
  /** IANA zone used to display expected-return dates in the organisation's local time. */
  timezone: string;
  members: readonly RehabMember[];
  /** false for coach: read only, per screens/rehab-groups.md's role table. */
  canAllocate: boolean;
};

const AVAIL_PILL: Record<string, string> = {
  modified: 'pill-warn',
  unavailable: 'pill-bad',
};

/** Chip picker rather than drag and drop, the same trade team-allocation.md's own
 *  board made — see lib/queries/rehabGroups.ts's header for the full reasoning. */
export function RehabGroupBoard({ orgId, userId, groups, timezone, members, canAllocate }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingPhaseFor, setEditingPhaseFor] = useState<string | null>(null);
  const [phaseDraft, setPhaseDraft] = useState('');

  const allocMutation = useMutation({
    mutationFn: (input: { athleteId: string; groupId: string; phase: string | null }) =>
      withWriteTimeout(allocateToRehabGroup(createClient(), orgId, userId, input)),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const removeMutation = useMutation({
    mutationFn: (athleteId: string) => withWriteTimeout(removeFromRehabGroup(createClient(), orgId, userId, athleteId)),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const phaseMutation = useMutation({
    mutationFn: (input: { athleteId: string; phase: string | null }) =>
      withWriteTimeout(setRehabPhase(createClient(), orgId, userId, input.athleteId, input.phase)),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      setEditingPhaseFor(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  function membersFor(groupId: string | null): RehabMember[] {
    return members.filter((m) => m.group_id === groupId);
  }

  function startEditPhase(member: RehabMember) {
    setEditingPhaseFor(member.athlete_id);
    setPhaseDraft(member.phase ?? '');
  }

  const unallocated = membersFor(null);

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {groups.map((group) => {
        const rows = membersFor(group.id);
        const groupPhase = modalPhase(rows);
        return (
          <section key={group.id} className="card" aria-labelledby={`rehab-${group.id}`}>
            <h2 className="card-title" id={`rehab-${group.id}`}>
              {group.name} <span className="tiny num">{rows.length}</span>
              {groupPhase ? <span className="pill pill-neutral" style={{ marginLeft: 8 }}>{groupPhase}</span> : null}
            </h2>
            {rows.length === 0 ? (
              <p className="tiny">No athletes.{canAllocate ? ' Use a chip below to add one.' : ''}</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {rows.map((m) => (
                  <MemberRow
                    key={m.athlete_id}
                    member={m}
                    timezone={timezone}
                    groupPhase={groupPhase}
                    canAllocate={canAllocate}
                    editing={editingPhaseFor === m.athlete_id}
                    phaseDraft={phaseDraft}
                    onPhaseDraftChange={setPhaseDraft}
                    onStartEditPhase={() => startEditPhase(m)}
                    onCancelEditPhase={() => setEditingPhaseFor(null)}
                    onSavePhase={() =>
                      phaseMutation.mutate({ athleteId: m.athlete_id, phase: phaseDraft.trim() || null })
                    }
                    savingPhase={phaseMutation.isPending}
                    onRemove={() => removeMutation.mutate(m.athlete_id)}
                    removing={removeMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="card" aria-labelledby="rehab-unallocated-title">
        <h2 className="card-title" id="rehab-unallocated-title">
          Unallocated <span className="tiny num">{unallocated.length}</span>
        </h2>
        {unallocated.length === 0 ? (
          <p className="tiny">Every athlete in rehabilitation is on a group.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {unallocated.map((m) => (
              <div key={m.athlete_id}>
                <MemberSummary member={m} timezone={timezone} />
                {canAllocate && groups.length > 0 ? (
                  <div className="chiprow" style={{ marginTop: 6 }}>
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="squad-chip"
                        onClick={() =>
                          allocMutation.mutate({ athleteId: m.athlete_id, groupId: group.id, phase: m.phase })
                        }
                        disabled={allocMutation.isPending}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {canAllocate && groups.length === 0 ? (
          <p className="tiny" style={{ marginTop: 8 }}>
            No rehab groups exist yet. Create one in Groups (group type &ldquo;rehab&rdquo;)
            before allocating.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function MemberSummary({ member, timezone }: { member: RehabMember; timezone: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="nm">
        {member.first_name} {member.last_name}
      </span>
      <span className={`pill ${AVAIL_PILL[member.availability] ?? 'pill-neutral'}`}>
        {enumLabel(member.availability)}
      </span>
      {member.body_area ? (
        <span className="tiny">
          {enumLabel(member.body_area)}
          {member.side ? ` · ${enumLabel(member.side)}` : ''}
        </span>
      ) : null}
      {/* RESTRICTIONS, added 2026-09-09. rehabGroups.ts has fetched them since the
          baseline import and 28-rehab-groups.md has always promised them to a
          coach — the row simply never drew them, and `git log -S "restrictions"`
          on this file returns no commits at all, so the omission was never a
          decision anybody took. Same two-then-overflow shape as
          AvailabilityList.tsx, which is the established pattern for this field:
          two labels read at a glance, and a count rather than a wrapped list for
          the rest. Shown ALONGSIDE body area here, not instead of it as that
          list does — this row is a wrapping flex row rather than a fixed grid
          column, so it has the width the list does not. */}
      {member.restrictions.length > 0 ? (
        <span className="tiny">
          {member.restrictions.slice(0, 2).map(enumLabel).join(' · ')}
          {member.restrictions.length > 2 ? ` +${member.restrictions.length - 2}` : ''}
        </span>
      ) : null}
      {member.expected_return ? <span className="tiny">Back {formatDate(member.expected_return, timezone)}</span> : null}
    </div>
  );
}

function MemberRow({
  member,
  timezone,
  groupPhase,
  canAllocate,
  editing,
  phaseDraft,
  onPhaseDraftChange,
  onStartEditPhase,
  onCancelEditPhase,
  onSavePhase,
  savingPhase,
  onRemove,
  removing,
}: {
  member: RehabMember;
  timezone: string;
  groupPhase: string | null;
  canAllocate: boolean;
  editing: boolean;
  phaseDraft: string;
  onPhaseDraftChange: (value: string) => void;
  onStartEditPhase: () => void;
  onCancelEditPhase: () => void;
  onSavePhase: () => void;
  savingPhase: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const mismatch = member.phase !== null && groupPhase !== null && member.phase !== groupPhase;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MemberSummary member={member} timezone={timezone} />
        <span style={{ flex: 1 }} />
        {member.phase ? (
          <span className={`pill ${mismatch ? 'pill-warn' : 'pill-neutral'}`}>
            {member.phase}
            {mismatch ? ' ⚠' : ''}
          </span>
        ) : null}
        {canAllocate ? (
          <>
            <button type="button" className="btn-ghost" onClick={onStartEditPhase}>
              Set phase
            </button>
            <button type="button" className="btn-ghost" onClick={onRemove} disabled={removing}>
              Remove
            </button>
          </>
        ) : null}
      </div>
      {mismatch ? (
        <p className="tiny" style={{ marginTop: 2, color: 'var(--warn-text)' }}>
          {member.phase}, the group is {groupPhase}.
        </p>
      ) : null}
      {editing ? (
        <div className="card" style={{ marginTop: 8, borderColor: 'var(--accent)' }}>
          <input
            className="field"
            value={phaseDraft}
            onChange={(event) => onPhaseDraftChange(event.target.value)}
            placeholder="Phase 3, Return to running, etc."
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-primary" onClick={onSavePhase} disabled={savingPhase}>
              {savingPhase ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" onClick={onCancelEditPhase}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The group's phase is the modal value across its members, derived rather than
 *  stored — screens/rehab-groups.md: "Storing a group phase separately creates two
 *  sources of truth that will diverge within a week." */
function modalPhase(members: readonly RehabMember[]): string | null {
  const counts = new Map<string, number>();
  for (const m of members) {
    if (!m.phase) continue;
    counts.set(m.phase, (counts.get(m.phase) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [phase, count] of counts) {
    if (count > bestCount) {
      best = phase;
      bestCount = count;
    }
  }
  return best;
}
