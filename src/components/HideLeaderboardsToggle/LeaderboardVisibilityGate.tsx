'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readLeaderboardsHidden } from '@/lib/leaderboardVisibility';

/** Wraps the athlete's own leaderboard surfaces so the "hide leaderboards"
 *  preference actually hides something. Client-side by necessity: the
 *  preference lives in localStorage, which a server component cannot read.
 *
 *  The board data is still fetched and sent — this hides, it does not
 *  secure. That is the correct boundary for a self-chosen display
 *  preference: what an athlete may actually see is decided server-side by
 *  compute_leaderboard's opt-out and minor-consent gates, and nothing here
 *  weakens either.
 *
 *  Renders children until the effect has run, so the athlete never sees a
 *  flash of "hidden" before their real preference loads, and so the server
 *  and first client render agree. */
export function LeaderboardVisibilityGate({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readLeaderboardsHidden());
  }, []);

  if (!hidden) return <>{children}</>;

  return (
    <div className="card">
      <p className="nm" style={{ marginBottom: 'var(--sp-4)' }}>
        Leaderboards are hidden
      </p>
      <p className="import-sub" style={{ marginBottom: 0 }}>
        You turned these off on this device. You are still on any board your club
        includes you on. <Link href="/me/leaderboards">Show them again</Link>.
      </p>
    </div>
  );
}
