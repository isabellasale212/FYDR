import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { maskEmail } from '@/lib/consentState';
import { createAdminClient } from '@/lib/supabase/admin';

/** PATTERN-S9 artboard 1: the identity block above the password field — the
 *  club, the squad, who sent the invite and when, and the address it went to,
 *  masked. Read for the signed-in invitee (the token was verified by
 *  /auth/confirm a moment ago), from their own row, their groups and the
 *  audit row their account's creation wrote (users.insert, actor = the
 *  inviter). Nothing here is typed by the recipient: a phishing page can
 *  restate an address it already has; a real invite can name somebody the
 *  athlete can walk up to. */
export type InviteContext = {
  clubName: string;
  squad: string | null;
  inviterName: string | null;
  inviterRole: string | null;
  sentAt: string | null;
  recipientMasked: string | null;
  isAthlete: boolean;
  firstName: string;
  lastName: string;
};

/** `db` is the recipient's own RLS client for their own rows. The inviter's
 *  name and role and the creation audit row are read with the service-role
 *  client, because an athlete's session can read neither another user's row
 *  nor the audit log — and both reads are scoped to the VERIFIED session's
 *  own userId and orgId (never a request value), which is the authorisation
 *  lib/supabase/admin.ts's header asks every caller to do for itself. */
export async function fetchInviteContext(db: SupabaseClient<Database>, o: { userId: string; orgId: string; athleteId: string | null; email: string | null; roles: readonly string[] }): Promise<InviteContext> {
  const admin = createAdminClient();
  const [org, user, athlete, created] = await Promise.all([
    db.from('organisations').select('name').eq('id', o.orgId).maybeSingle(),
    db.from('users').select('full_name').eq('id', o.userId).maybeSingle(),
    o.athleteId
      ? db.from('athletes').select('first_name, last_name').eq('id', o.athleteId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('audit_log').select('actor_id, occurred_at').eq('org_id', o.orgId).eq('entity_type', 'users').eq('entity_id', o.userId).eq('action', 'users.insert').order('occurred_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  let squad: string | null = null;
  if (o.athleteId) {
    const { data: groups } = await db
      .from('group_memberships')
      .select('groups(name)')
      .eq('athlete_id', o.athleteId)
      .is('removed_at', null)
      .limit(3);
    const names = (groups ?? []).map((g) => (g.groups as { name: string } | null)?.name).filter((n): n is string => !!n);
    squad = names.length > 0 ? names.join(' · ') : null;
  }
  let inviterName: string | null = null;
  let inviterRole: string | null = null;
  if (created.data?.actor_id) {
    const [inviter, roles] = await Promise.all([
      admin.from('users').select('full_name').eq('org_id', o.orgId).eq('id', created.data.actor_id).maybeSingle(),
      admin.from('user_roles').select('role').eq('org_id', o.orgId).eq('user_id', created.data.actor_id),
    ]);
    inviterName = inviter.data?.full_name ?? null;
    const r = (roles.data ?? []).map((x) => x.role);
    inviterRole = r.includes('sport_scientist') ? 'sport scientist' : r.includes('coach') ? 'coach' : r.includes('medic') ? 'medic' : r.includes('strength_conditioning') ? 'S&C' : r.includes('nutritionist') ? 'nutritionist' : null;
  }
  const full = (user.data?.full_name ?? '').trim();
  const [first, ...rest] = full.split(/\s+/);
  return {
    clubName: org.data?.name ?? 'your club',
    squad,
    inviterName,
    inviterRole,
    sentAt: created.data?.occurred_at ?? null,
    recipientMasked: o.email ? maskEmail(o.email) : null,
    isAthlete: o.roles.includes('athlete'),
    firstName: athlete.data?.first_name ?? first ?? '',
    lastName: athlete.data?.last_name ?? rest.join(' '),
  };
}
