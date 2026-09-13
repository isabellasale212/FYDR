'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { archiveGroup, restoreGroup } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { BlockedButton } from '@/components/BlockedButton/BlockedButton';
import { archiveConsequence, type GroupUsage } from '@/lib/groupUsage';

type Props = { orgId: string; groupId: string; name: string; groupType: string; archived: boolean; usage: GroupUsage };

/** PATTERN-S8 C5 (2026-09-13): archive states its consequence in the same
 *  card as the button, before the button. Replaces GroupArchiveButton, a
 *  bare "Archive" in the topbar that wrote on the first click.
 *
 *  Archive sets deleted_at, restore clears it. Never a hard delete —
 *  screens/groups.md offers no path to one, and membership rows are
 *  untouched either way, which is exactly why the card has to say what
 *  keeps running: sessions, programme assignments and group nutrition
 *  targets resolve through group_memberships, not through groups.deleted_at.
 *
 *  A rehab group is the medic's, set from an injury record (the S8 board's
 *  "Rehab is the one exception"); its control is blocked here with the
 *  reason, not hidden — the coach can see that the door exists and whose
 *  it is.
 *
 *  Bounded write (audit S5's rule): archiveGroup/restoreGroup throw on any
 *  failure; a failed archive says so and a hung one times out. */
export function GroupArchiveCard({ orgId, groupId, name, groupType, archived, usage }: Props) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rehab = groupType === 'rehab';

  const mutation = useMutation({
    mutationFn: () => withWriteTimeout(archived ? restoreGroup(createClient(), groupId, orgId) : archiveGroup(createClient(), groupId, orgId)),
    onSuccess: () => {
      setError(null);
      setArmed(false);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  if (archived) {
    return (
      <section className="card" aria-labelledby="grp-archive-title">
        <h2 className="card-title" id="grp-archive-title">
          Archived
        </h2>
        <p className="tiny">
          {name} is out of the group filter and every picker. Restore brings it back exactly as it was — its {usage.members} member{usage.members === 1 ? '' : 's'}, its sessions, its programmes and its
          targets were never changed.
        </p>
        <div className="chiprow" style={{ marginTop: 'var(--sp-12)' }}>
          <button type="button" className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Working…' : `Restore ${name}`}
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const c = archiveConsequence(name, usage);
  return (
    <section className={`card${armed ? ' grp-archive-armed' : ''}`} aria-labelledby="grp-archive-title">
      <h2 className="card-title" id="grp-archive-title">
        Archive this group
      </h2>
      <p className="tiny">{c.lead}</p>
      {c.keeps.length > 0 ? (
        <>
          <p className="cap grp-keeps-title">What keeps running</p>
          <ul className="grp-keeps">
            {c.keeps.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
          Nothing is scheduled, prescribed or targeted through it today.
        </p>
      )}
      <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
        {c.note}
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-12)' }}>
        {!armed ? (
          <BlockedButton className="btn-ghost" blocked={rehab} reason="Rehab groups are set by the medic from an injury record and are closed from there, not archived here." onClick={() => setArmed(true)}>
            Archive
          </BlockedButton>
        ) : (
          <>
            <button type="button" className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Working…' : `Archive ${name}`}
            </button>
            <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => setArmed(false)}>
              Keep it
            </button>
          </>
        )}
      </div>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-8)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
