'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { addGroupMember, removeGroupMember, type MemberRow } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';
import { withWriteTimeout } from '@/lib/writeErrors';
import { formatDate, initials } from '@/lib/format';

type Candidate = { id: string; first_name: string; last_name: string; position: string | null };

type Props = {
  orgId: string;
  groupId: string;
  timezone: string;
  current: MemberRow[];
  candidates: Candidate[];
  /** May this viewer change who is in THIS group.
   *
   *  Resolved by the page from group_memberships' own policies, which are not
   *  the same rule as who may edit the group itself: the medic may write
   *  membership for any group, the coach and sport scientist for any group that
   *  is not a rehab group. Passed in rather than derived here so the component
   *  never has to know about the rehab carve-out, and so the page can mirror the
   *  policy in one place. */
  canManage?: boolean;
};

/**
 * Add and remove membership. screens/groups.md's single most important line:
 * removal sets removed_at and the row is kept, never deleted. Adding an
 * existing member is a no-op reported as a skip, backed by the migration
 * 0014 partial unique index, not just by the client checking first.
 */
export function GroupMemberManager({
  orgId,
  groupId,
  timezone,
  current,
  candidates,
  canManage = true,
}: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const remove = useMutation({
    mutationFn: (athleteId: string) =>
      withWriteTimeout(removeGroupMember(createClient(), orgId, groupId, athleteId)),
    onSuccess: () => router.refresh(),
    onError: () => setError('Could not remove that athlete. Try again.'),
  });

  const addSelected = useMutation({
    mutationFn: async () => {
      const db = createClient();
      let skipped = 0;
      for (const athleteId of selected) {
        const result = await withWriteTimeout(addGroupMember(db, orgId, groupId, athleteId));
        if (result.skipped) skipped += 1;
      }
      return skipped;
    },
    onSuccess: () => {
      setSelected(new Set());
      setAdding(false);
      router.refresh();
    },
    onError: () => setError('Could not add those athletes. Try again.'),
  });

  const filtered = candidates.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <section className="card flush" aria-labelledby="members-title">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px 8px',
          }}
        >
          <h2 className="card-title" id="members-title" style={{ margin: 0 }}>
            Members{' '}
            <span className="tiny num" style={{ fontWeight: 400 }}>
              {current.length}
            </span>
          </h2>
          {canManage && !adding ? (
            <button type="button" className="btn-ghost" onClick={() => setAdding(true)}>
              + Add
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="form-error" role="alert" style={{ padding: '0 16px' }}>
            {error}
          </p>
        ) : null}

        {current.length === 0 ? (
          <p className="cap" style={{ padding: '0 16px 16px' }}>
            No athletes in this group yet.
          </p>
        ) : (
          current.map((member) => (
            <div
              key={member.athlete_id}
              className="todo"
              style={{ borderTop: '1px solid var(--hair)', cursor: 'default' }}
            >
              {/* .todo is a 4-column grid (38px content auto 12px), built for
               *  a leading icon/glyph. A 2-child row (content, then button)
               *  falls into implicit grid placement instead — the content
               *  span lands in the 38px column and the button stretches to
               *  fill the 1fr column, exactly backwards from what either was
               *  meant to look like. This initials glyph, the same .gl
               *  pattern (today)/page.tsx already uses, fills that leading
               *  slot for real (who this row is about) rather than as a
               *  blank spacer. */}
              <span className="gl" aria-hidden="true">
                {initials(member)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-14)', fontWeight: 700 }}>
                  {member.first_name} {member.last_name}
                </span>
                <span className="tiny" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
                  {member.position ?? 'Position not set'} · since{' '}
                  {formatDate(member.added_at, timezone)}
                </span>
              </span>
              {canManage ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => remove.mutate(member.athlete_id)}
                  disabled={remove.isPending}
                  aria-label={`Remove ${member.first_name} ${member.last_name}`}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>

      {adding ? (
        <section className="card" aria-labelledby="add-title">
          <h2 className="card-title" id="add-title">
            Add athletes
          </h2>
          <input
            className="field"
            placeholder="Search the squad"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 'var(--sp-10)' }}>
            {filtered.length === 0 ? (
              <p className="cap">No matching athletes, or everyone is already a member.</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  className="todo"
                  style={{ borderTop: '1px solid var(--hair)' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--fs-14)', fontWeight: 700 }}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="tiny" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
                      {c.position ?? 'Position not set'}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={selected.size === 0 || addSelected.isPending}
              onClick={() => addSelected.mutate()}
            >
              {addSelected.isPending
                ? 'Adding…'
                : `Add ${selected.size || ''} athlete${selected.size === 1 ? '' : 's'}`.trim()}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setAdding(false);
                setSelected(new Set());
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
