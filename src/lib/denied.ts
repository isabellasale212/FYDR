/* PATTERN-S6 C7, the copy half (2026-09-13): permission denied says what is
 * true without saying what exists. The board's sentence, then two things
 * that help without leaking — who they are signed in as and what their role
 * covers — and one primary back to the dashboard. The reference code an
 * admin could look up waits for a denial log (the sheet, ⚠ migration);
 * until then there is none, and nothing pretends there is.
 *
 * "What the role covers" is the list of destinations the sidebar opens for
 * these roles — the app's own rule, passed in by the page — not a summary of
 * permissions written here that could drift from access.ts.
 *
 * Pure; exercised by scripts/test-denied-screen.ts. */

import { staffRoleLabel } from '@/lib/access';
import type { AppRole } from '@/lib/types/database';

export type DeniedCopy = {
  title: string;
  body: string;
  identity: string;
  covers: string;
  /** The denial log's reference (0112), when the refusal was logged — what
   *  to quote to an administrator, who finds it in Settings › Audit log.
   *  Null when the log could not be written; nothing pretends otherwise. */
  reference: string | null;
  action: { href: string; label: string };
};

export const REFERENCE_PATTERN = /^D-[0-9A-Z]{1,13}$/;

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function deniedCopy(o: { fullName: string; roles: readonly AppRole[]; covers: readonly string[]; reference?: string | null }): DeniedCopy {
  const who = o.fullName.trim();
  const role = staffRoleLabel(o.roles);
  const ref = o.reference && REFERENCE_PATTERN.test(o.reference) ? o.reference : null;
  return {
    title: 'This is not available to you.',
    body: 'It may not exist, or your role may not include it. Nothing more can be said about it here.',
    identity: who ? `Signed in as ${who} · ${role}.` : `Signed in as ${role}.`,
    covers: o.covers.length > 0 ? `Your role covers ${list(o.covers)}.` : 'Your role covers nothing on this app yet.',
    reference: ref ? `Reference ${ref}. Quote it to your club's administrator — it is in Settings › Audit log.` : null,
    action: { href: '/dashboard', label: 'Back to dashboard' },
  };
}
