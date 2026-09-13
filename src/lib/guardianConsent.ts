import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '@/lib/types/database';
import { CONSENT_VERSION } from '@/lib/legalPlaceholders';
import { sendGuardianConsentEmail } from '@/lib/email/send';
import { formatDate } from '@/lib/format';

/** PATTERN-S9 artboard 4: ask the guardian. One call for the athlete's own
 *  "Send the link again" and the sport scientist's send from the profile —
 *  request_guardian_consent (0120) creates the row and hands back the raw
 *  token once; the email carries the page's address; only the hash stays.
 *  The link is never shown to the athlete or to staff: it is the guardian's. */
export async function sendGuardianLink(
  db: SupabaseClient<Database>,
  o: { orgId: string; athleteId: string; athleteFirstName: string; clubName: string; actorId: string | null; actorRole: AppRole | null; origin: string; timezone: string },
): Promise<{ ok: true; delivered: boolean; expiresAt: string } | { ok: false; reason: string }> {
  const { data, error } = await db.rpc('request_guardian_consent', { p_athlete_id: o.athleteId, p_version: CONSENT_VERSION });
  if (error || !data || data.length === 0) {
    const m = error?.message ?? '';
    return { ok: false, reason: /not_a_minor/.test(m) ? 'not_a_minor' : /no_guardian_recorded/.test(m) ? 'no_guardian' : m || 'failed' };
  }
  const row = data[0]!;
  const pageUrl = new URL(`/guardian/${row.token}`, o.origin).toString();
  const sent = await sendGuardianConsentEmail(db, o.orgId, o.actorId, o.actorRole, o.athleteId, row.request_id, row.guardian_email, {
    guardianName: row.guardian_name,
    athleteFirstName: o.athleteFirstName,
    clubName: o.clubName,
    pageUrl,
    expiresOn: formatDate(row.expires_at, o.timezone),
  });
  return { ok: true, delivered: sent.delivered, expiresAt: row.expires_at };
}

export type GuardianRequestRow = { id: string; sent_at: string; expires_at: string; decided_at: string | null; decision: string | null; guardian_name: string };

/** The athlete's or the staff's view of the latest request. */
export async function fetchLatestGuardianRequest(db: SupabaseClient<Database>, athleteId: string): Promise<GuardianRequestRow | null> {
  const { data } = await db.from('guardian_consent_requests').select('id, sent_at, expires_at, decided_at, decision, guardian_name').eq('athlete_id', athleteId).order('sent_at', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}
