'use client';

import { useEffect } from 'react';
import { clearAllDrafts } from '@/lib/formDraft';

/* Sign-out clears every draft on the device — decision-batch-2026-09-15-pm.md
 * #2 (Isabella, 15 Sept 2026). The sign-out route is a server route and
 * cannot reach browser storage, so it sends the browser to /login with
 * ?signed_out=1 and the login page renders this once. Only then: a session
 * that expired mid-form lands on /login too, with ?next=, and its draft is
 * the whole point of the mechanism. */
export function DraftsClearedOnSignOut() {
  useEffect(() => {
    clearAllDrafts();
  }, []);
  return null;
}
