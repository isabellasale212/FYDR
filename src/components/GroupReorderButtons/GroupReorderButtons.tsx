'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { moveGroup } from '@/lib/queries/groups';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = {
  orgId: string;
  groupId: string;
  groupName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

/** The step-reorder half of moveGroup() — see that function's own comment
 *  for why this is real reorder and not the "drag reorder" the Groups list
 *  page's header comment specifically cut. Up/down rather than drag: no
 *  new dependency, and no drag gesture to make accessible.
 *
 *  Visually smaller than 06-design-system.md §11.1's 44px floor by
 *  design — a secondary, low-frequency admin action, not a primary one —
 *  but unlike .pill and .squad-chip (that section's own two named
 *  exceptions, which regain the target via hitSlop/padding), this doesn't
 *  attempt an expanded hit area. A real gap against §11.1 if this control
 *  turns out to be reached from a touch device in practice, not one
 *  papered over by an inflated size claim. */
export function GroupReorderButtons({ orgId, groupId, groupName, canMoveUp, canMoveDown }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  /* Bounded write (audit S5's rule): this used to discard moveGroup's
   * returned {error} entirely and had no onError — a failed reorder just
   * didn't happen, with no explanation. */
  const move = useMutation({
    mutationFn: async (direction: 'up' | 'down') => {
      const result = await withWriteTimeout(moveGroup(createClient(), orgId, groupId, direction));
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        className="reorder-btn"
        disabled={!canMoveUp || move.isPending}
        onClick={() => move.mutate('up')}
        aria-label={`Move ${groupName} up`}
      >
        ▲
      </button>
      <button
        type="button"
        className="reorder-btn"
        disabled={!canMoveDown || move.isPending}
        onClick={() => move.mutate('down')}
        aria-label={`Move ${groupName} down`}
      >
        ▼
      </button>
    </div>
  );
}
