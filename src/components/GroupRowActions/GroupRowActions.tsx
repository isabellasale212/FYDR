'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { archiveGroup } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { BlockedButton } from '@/components/BlockedButton/BlockedButton';

/* EDIT AND REMOVE ON EVERY GROUP ROW (Isabella, 16 September 2026, the
 * overnight queue, 3.4: "Manage groups gains an Edit and a Remove button on
 * each group. Remove asks for confirmation before it deletes."). Edit opens
 * the group's page — the one editor, GroupEditForm. Remove ARCHIVES: a
 * group is never hard-deleted (its memberships, sessions, programmes and
 * targets are history, and GroupArchiveCard's restore brings it back), so
 * the confirmation says exactly that, inline and armed the way the archive
 * card is armed — a second press, never a dialog for a reversible act (B11
 * keeps dialogs for the destructive). A rehab group is closed from its
 * injury record, not removed here, and the control says so on tap. GROUP_EDIT
 * only; everyone else gets the blocked control with the reason. */
type Props = {
  orgId: string;
  groupId: string;
  name: string;
  groupType: string;
  members: number;
  canEdit: boolean;
};

export function GroupRowActions({ orgId, groupId, name, groupType, members, canEdit }: Props) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rehab = groupType === 'rehab';
  const mutation = useMutation({
    mutationFn: () => withWriteTimeout(archiveGroup(createClient(), groupId, orgId)),
    onSuccess: () => {
      setError(null);
      setArmed(false);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <span className="grp-row-actions">
      {armed ? (
        <span className="grp-row-confirm" role="status">
          <span className="tiny">
            Remove <b>{name}</b>? It is archived, not deleted — its {members} athlete{members === 1 ? '' : 's'} keep their other groups, and it can be restored from its page.
          </span>
          <button type="button" className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Removing…' : 'Confirm remove'}
          </button>
          <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => setArmed(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <>
          <Link href={`/settings/groups/${groupId}`} className="btn-ghost-pill" aria-label={`Edit ${name}`}>
            Edit
          </Link>
          <BlockedButton
            className="btn-ghost-pill"
            blocked={!canEdit || rehab}
            reason={rehab ? 'Rehab groups are set by the medic from an injury record and are closed from there, not removed here.' : 'Only the sport scientist and the coach change groups.'}
            onClick={() => setArmed(true)}
            aria-label={`Remove ${name}`}
          >
            Remove
          </BlockedButton>
        </>
      )}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
