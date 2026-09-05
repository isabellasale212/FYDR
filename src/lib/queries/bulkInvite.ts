import { parseCsv } from '@/lib/csvParse';
import type { UnlinkedAthlete } from './userManagement';

/* docs/screens/user-management.md's "Bulk invite" section: "Paste one
 * email per line, or upload a CSV... Columns: email, first name, last
 * name, squad number." Both input modes end up as the same plain text,
 * parsed the same way — a paste is just a CSV with no header row, which
 * parseCsv (lib/csvParse.ts, built for GPS import) already handles without
 * changes.
 *
 * A fifth column, date of birth, is here too, and the spec's own wireframe
 * doesn't show one. Found live while testing this feature: `athletes` has
 * a real, deliberate check constraint, athletes_dob_required_when_linked
 * — `user_id is null or date_of_birth is not null` — because whether the
 * Children's Code minor-floor protections this build already enforces
 * elsewhere apply to an account is decided by date of birth, and an
 * account cannot go live without that decided one way or the other. The
 * spec's own column list predates that constraint, or just didn't carry
 * it through to this screen; either way, CLAUDE.md §5 is explicit that a
 * real database rule wins over an incomplete doc, and the honest fix is
 * to ask for the one fact that's actually required to activate an
 * account, not to invent a placeholder date that would silently mis-set a
 * real legal protection.
 *
 * Matching is by exact name, per the spec's own words: "Matching to
 * existing athlete records is by exact name, and every proposed match is
 * shown for confirmation. Fuzzy auto-matching is not done: silently
 * attaching an account to the wrong athlete record is a data-protection
 * incident, not a convenience bug." A name matching more than one
 * unlinked record is surfaced as needs_choice, not resolved by picking
 * the first one — the admin decides, every time.
 *
 * Client-safe: no database access, pure parsing and matching over data the
 * caller already fetched (fetchUnlinkedAthletes). The page that renders
 * the preview and the route that sends the batch both import from here. */

export const MAX_BULK_INVITE_ROWS = 100;

export type BulkInviteRow = {
  line: number;
  email: string;
  firstName: string;
  lastName: string;
  squadNumber: number | null;
  dateOfBirth: string | null;
  error: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDob(value: string): boolean {
  if (!DOB_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const hundredYearsAgo = new Date(Date.UTC(now.getUTCFullYear() - 100, now.getUTCMonth(), now.getUTCDate()));
  return d <= now && d >= hundredYearsAgo;
}

export function parseBulkInviteText(text: string): { rows: BulkInviteRow[]; tooMany: boolean } {
  const rawRows = parseCsv(text).map((cells) => cells.map((c) => c.trim()));
  const tooMany = rawRows.length > MAX_BULK_INVITE_ROWS;
  const capped = rawRows.slice(0, MAX_BULK_INVITE_ROWS);

  const seenEmails = new Set<string>();

  const rows: BulkInviteRow[] = capped.map((cells, idx) => {
    const line = idx + 1;
    const email = (cells[0] ?? '').toLowerCase();
    const firstName = cells[1] ?? '';
    const lastName = cells[2] ?? '';
    const squadRaw = (cells[3] ?? '').trim();
    const squadNumber = squadRaw === '' ? null : Number.parseInt(squadRaw, 10);
    const dobRaw = (cells[4] ?? '').trim();

    let error: string | null = null;
    if (!email) error = 'Missing email.';
    else if (!EMAIL_RE.test(email)) error = 'Not a valid email.';
    else if (seenEmails.has(email)) error = 'Duplicate email in this batch.';
    else if (!firstName || !lastName) error = 'Missing first or last name.';
    else if (squadRaw !== '' && (Number.isNaN(squadNumber) || (squadNumber ?? 0) <= 0)) error = 'Squad number must be a positive whole number.';
    else if (!dobRaw) error = 'Missing date of birth (YYYY-MM-DD).';
    else if (!isValidDob(dobRaw)) error = 'Date of birth must be a real past date, YYYY-MM-DD.';

    if (!error) seenEmails.add(email);

    return { line, email, firstName, lastName, squadNumber: error ? null : squadNumber, dateOfBirth: error ? null : dobRaw, error };
  });

  return { rows, tooMany };
}

export type BulkInvitePreviewRow = BulkInviteRow & {
  matchStatus: 'error' | 'new' | 'matched' | 'needs_choice';
  candidates: UnlinkedAthlete[];
  chosenAthleteId: string | null;
};

function namesMatch(a: UnlinkedAthlete, firstName: string, lastName: string): boolean {
  return a.first_name.trim().toLowerCase() === firstName.trim().toLowerCase() && a.last_name.trim().toLowerCase() === lastName.trim().toLowerCase();
}

export function matchBulkInviteRows(rows: BulkInviteRow[], unlinkedAthletes: readonly UnlinkedAthlete[]): BulkInvitePreviewRow[] {
  return rows.map((row): BulkInvitePreviewRow => {
    if (row.error) return { ...row, matchStatus: 'error', candidates: [], chosenAthleteId: null };

    const candidates = unlinkedAthletes.filter((a) => namesMatch(a, row.firstName, row.lastName));
    if (candidates.length === 0) return { ...row, matchStatus: 'new', candidates: [], chosenAthleteId: null };
    if (candidates.length === 1) return { ...row, matchStatus: 'matched', candidates, chosenAthleteId: candidates[0]!.id };
    return { ...row, matchStatus: 'needs_choice', candidates, chosenAthleteId: null };
  });
}

/** A row is ready to send once it has no parse error and, if it needs a
 *  choice among several same-named athletes, one has actually been picked
 *  — never defaulted. */
export function isRowSendable(row: BulkInvitePreviewRow): boolean {
  if (row.matchStatus === 'error') return false;
  if (row.matchStatus === 'needs_choice') return row.chosenAthleteId !== null;
  return true;
}

export type BulkInviteSendRow = {
  email: string;
  firstName: string;
  lastName: string;
  squadNumber: number | null;
  dateOfBirth: string | null;
  athleteId: string | null; // an existing unlinked record to link, or null to create a new one
};

export type BulkInviteResult = {
  email: string;
  ok: boolean;
  error: string | null;
  /** The single-use link the invited athlete follows to set their own password.
   *  Was `temporaryPassword` until build handoff step 2; nothing in this app
   *  generates a password for anybody now. See lib/invite.ts. */
  inviteUrl: string | null;
};
