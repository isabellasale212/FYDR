'use client';

import { useEffect } from 'react';
import { clearStaleDrafts } from '@/lib/formDraft';

/* End of the working day for a staff draft — decision-batch-2026-09-15-pm.md
 * #2 (Isabella, 15 Sept 2026): "a staff draft is cleared at the end of the
 * working day even where nobody signs out", because the injury form may be
 * filled on a shared laptop in the physio room and its draft can hold
 * clinical content.
 *
 * Rendered by the staff layout, so it runs on every staff page load: sweeps
 * every dated draft whose day is not the club's today, and sets a timer for
 * the club's next midnight so a laptop left open on a staff page is swept
 * then too. `today` and `msToMidnight` come from the server in the club's
 * zone — the browser's clock is not asked which day it is. */
export function DraftHousekeeping({ today, msToMidnight }: { today: string; msToMidnight: number }) {
  useEffect(() => {
    clearStaleDrafts(today);
    // At the club's midnight, every draft dated today is stale. Clamp: a
    // timer longer than a day is a clock that disagrees with the server.
    const delay = Math.max(1_000, Math.min(msToMidnight, 86_400_000));
    const t = window.setTimeout(() => clearStaleDrafts('__ended__'), delay);
    return () => window.clearTimeout(t);
  }, [today, msToMidnight]);
  return null;
}
