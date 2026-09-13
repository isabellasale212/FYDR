'use client';

import { useEffect } from 'react';
import { staleFilterLine } from '@/lib/groupFilter';
import { writeGroupFilterCookie } from '@/lib/groupFilterCookie';

/** PATTERN-S8 D9 + §0ak (2026-09-13): rendered by the staff layout only when
 *  the sticky cookie named a group that is no longer live. Writes the cookie
 *  back without it through the one writer (lib/groupFilterCookie), so the
 *  next request — and every other multi-athlete screen — sees the cleaned
 *  scope, and says so once: "Filter updated: Leadership was archived.
 *  Showing Whole squad." The server has already scoped this page to the
 *  cleaned ids; this is the persistence and the sentence. */
export function StaleGroupFilter({ valid, droppedNames, scopeLabel }: { valid: readonly string[]; droppedNames: readonly string[]; scopeLabel: string }) {
  useEffect(() => {
    writeGroupFilterCookie(valid);
  }, [valid]);
  return (
    <p className="banner" role="status" style={{ marginBottom: 'var(--sp-12)' }}>
      <span className="g" aria-hidden="true">
        i
      </span>
      <span>{staleFilterLine({ droppedNames, scopeLabel })}</span>
    </p>
  );
}
