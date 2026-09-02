'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { setBoardVisibility, deleteBoard, suppressAthlete } from '@/lib/queries/leaderboards';
import { humanizeDbError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { RankedRow } from '@/lib/queries/leaderboards';

type Props = {
  orgId: string;
  userId: string;
  boardId: string;
  visibility: string;
  isMedical: boolean;
  ranking: readonly RankedRow[];
};

/** Publish/unpublish, delete, and — medical only — suppress an athlete from this board
 *  on clinical grounds. screens/leaderboards.md's publish confirmation names what is
 *  about to be disclosed; this build's version of that is the plain-language note on
 *  the builder page rather than a second confirm sheet here, a real, documented cut. */
export function LeaderboardStaffActions({ orgId, userId, boardId, visibility, isMedical, ranking }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [suppressing, setSuppressing] = useState(false);
  const [suppressTarget, setSuppressTarget] = useState('');
  const [suppressReason, setSuppressReason] = useState('');

  const visibilityMutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        setBoardVisibility(createClient(), orgId, boardId, visibility === 'published' ? 'staff' : 'published'),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => withWriteTimeout(deleteBoard(createClient(), orgId, boardId)),
    onSuccess: (result) => {
      if (result.error) {
        setError(humanizeDbError(result.error, 'staff'));
        setConfirmingDelete(false);
        return;
      }
      router.push('/leaderboards/manage');
    },
    onError: (err) => {
      setError(toUserMessage(err, 'staff'));
      setConfirmingDelete(false);
    },
  });

  const suppressMutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        suppressAthlete(createClient(), orgId, suppressTarget, userId, boardId, suppressReason.trim()),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      setSuppressing(false);
      setSuppressTarget('');
      setSuppressReason('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div className="card">
      <p className="label">Board actions</p>
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => visibilityMutation.mutate()}
          disabled={visibilityMutation.isPending}
        >
          {visibilityMutation.isPending
            ? 'Working…'
            : visibility === 'published'
              ? 'Unpublish'
              : 'Publish to athletes'}
        </button>

        {isMedical ? (
          <button type="button" className="btn-ghost" onClick={() => setSuppressing((v) => !v)}>
            Suppress an athlete
          </button>
        ) : null}

        {!confirmingDelete ? (
          <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(true)}>
            Delete board
          </button>
        ) : (
          <>
            <span className="tiny" style={{ color: 'var(--bad-text)' }}>
              Delete this board? This cannot be undone.
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ color: 'var(--bad-text)', borderColor: 'var(--bad)' }}
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(false)}>
              Never mind
            </button>
          </>
        )}
      </div>

      {suppressing ? (
        <div style={{ marginTop: 14 }}>
          <label className="label" htmlFor="suppress-athlete">
            Athlete
          </label>
          <select
            id="suppress-athlete"
            className="field"
            value={suppressTarget}
            onChange={(event) => setSuppressTarget(event.target.value)}
          >
            <option value="">Choose an athlete on this board</option>
            {ranking.map((row) => (
              <option key={row.athlete_id} value={row.athlete_id}>
                {row.first_name} {row.last_name}
              </option>
            ))}
          </select>
          <label className="label" htmlFor="suppress-reason" style={{ marginTop: 10 }}>
            Reason (visible to medical only)
          </label>
          <input
            id="suppress-reason"
            className="field"
            value={suppressReason}
            onChange={(event) => setSuppressReason(event.target.value)}
            maxLength={200}
          />
          <p className="tiny" style={{ marginTop: 6 }}>
            A coach never sees this reason, only that the athlete is not ranked &mdash; the
            same wording used for every other exclusion.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 10 }}
            disabled={!suppressTarget || suppressMutation.isPending}
            onClick={() => suppressMutation.mutate()}
          >
            {suppressMutation.isPending ? 'Working…' : 'Suppress this athlete'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
