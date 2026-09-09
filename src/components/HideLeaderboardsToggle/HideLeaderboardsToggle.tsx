'use client';

import { useEffect, useState } from 'react';
import { readLeaderboardsHidden, writeLeaderboardsHidden } from '@/lib/leaderboardVisibility';

/** "Hide leaderboards from me" — a display preference, not a data one. See
 *  lib/leaderboardVisibility.ts's header for why this exists, why it is
 *  deliberately separate from the real opt-out beneath it on this screen,
 *  and why it is stored per-device rather than in a column.
 *
 *  Reads the stored value in an effect rather than during render: the server
 *  cannot know it, so rendering it directly would mismatch on hydration. The
 *  first paint is always the "shown" state, which is also the safe default
 *  if storage is unreadable. */
export function HideLeaderboardsToggle() {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHidden(readLeaderboardsHidden());
    setReady(true);
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    writeLeaderboardsHidden(next);
  }

  return (
    <div style={{ marginTop: 'var(--sp-10)' }}>
      <button
        type="button"
        className="squad-chip"
        aria-pressed={hidden}
        onClick={toggle}
        disabled={!ready}
      >
        {hidden ? 'Hidden — tap to show again' : 'Hide leaderboards from me'}
      </button>
      <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
        Applies to this device only. You stay on any board you are on, and your
        position is unchanged &mdash; you just will not see them.
      </p>
    </div>
  );
}
