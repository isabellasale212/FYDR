import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/lib/types/database';

/* PATTERN-S9 artboard 2: what staff can see, before any decision is asked —
 * named people, and for each role what they do NOT see. Every line below is a
 * boundary built in the product today, read against the code, not the board:
 *
 *   - wellness_entries and training_entries have NO update policy; a
 *     correction is a new revision row (ADR-005; supabase/tests/010 asserts).
 *   - injury_clinical is medic-only at the database (ADR-007; one policy).
 *     Diagnosis, treatment notes, imaging, referral and the working notes are
 *     in it and reach no other staff role.
 *   - The coach's availability view is the status word and one restriction
 *     line with protocol and stage stripped at every read (lib/restrictions).
 *   - Body mass is BODY_MASS_VIEW: not the coach (2026-09-12).
 *   - Analytics is the sport scientist's alone (D-02).
 *   - The nutritionist sees availability as a status without injury detail
 *     (0074) and cannot open the injury report or the squad weekly.
 *   - A day not answered is an expectation with no entry; every compliance
 *     figure prints the count over the number asked (lib/reportFigures).
 *
 * ONE CLAIM ON THE BOARD IS NOT TRUE TODAY AND IS NOT MADE HERE: "no body
 * site and no side" for the coach. The injuries list, the availability line
 * and the injury report show a coach the body area and side of an open injury
 * (INJURY_ACCESS admits the coach to the limited view, which carries them).
 * Isabella's decision (13 September 2026): body site and side become
 * not-coach-visible behind a club setting defaulting to off — built with the
 * injury cluster (PATTERN-S3), after which the coach card takes the board's
 * wording. Until then the card says what is enforced. Reported. */

export type StaffVisibility = { cards: StaffVisibilityCard[]; people: number };

export type StaffVisibilityCard = {
  role: AppRole;
  roleWord: string;
  /** "Peter Ackland" or "Peter Ackland and Mark Iremonger". */
  who: string;
  sees: string;
  doesNotSee: string;
};

const ROLE_WORD: Record<string, string> = {
  coach: 'coach',
  medic: 'physiotherapist or doctor',
  sport_scientist: 'sport scientist',
  strength_conditioning: 'strength and conditioning coach',
  nutritionist: 'nutritionist',
};

const SEES: Record<string, { sees: string; doesNotSee: string }> = {
  coach: {
    sees: 'your morning check-in answers, your session ratings, your gym logs, whether you are available to train with one line saying what you cannot do this week, and the body area of an open injury.',
    doesNotSee: 'your diagnosis, your treatment notes, or your weight. Those stay with the physiotherapist.',
  },
  medic: {
    sees: 'what the coach sees, and the clinical record as well: diagnosis, body site and side, treatment notes, and the dates.',
    doesNotSee: 'nothing is withheld from the clinical role, except that the working notes are theirs alone — you cannot read them either.',
  },
  sport_scientist: {
    sees: 'training load, gym and test numbers, your weight, the analytics, and the same availability line as the coach. Also the club’s settings and who has an account.',
    doesNotSee: 'the clinical record: no diagnosis, no treatment notes.',
  },
  strength_conditioning: {
    sees: 'your gym logs and programme, your weight, and the same availability line as the coach.',
    doesNotSee: 'the clinical record. A rehab plan they propose for you goes through the physiotherapist before you see it.',
  },
  nutritionist: {
    sees: 'your weight, your nutrition check-ins and targets, and whether you are available — as a status only.',
    doesNotSee: 'why you are unavailable, any injury, or the clinical record. Not your check-in answers or session ratings either.',
  },
};

const ORDER: AppRole[] = ['coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];

export async function fetchStaffVisibility(orgId: string): Promise<StaffVisibility> {
  /* Service role, scoped to the verified session's own club: an athlete's
     session cannot read other users' rows, and the names of their own club's
     staff are the point of the screen. */
  const admin = createAdminClient();
  const [users, roles] = await Promise.all([
    admin.from('users').select('id, full_name').eq('org_id', orgId).eq('status', 'active').is('deleted_at', null),
    admin.from('user_roles').select('user_id, role').eq('org_id', orgId),
  ]);
  const nameById = new Map((users.data ?? []).map((u) => [u.id, u.full_name]));
  const byRole = new Map<string, string[]>();
  for (const r of roles.data ?? []) {
    const name = nameById.get(r.user_id);
    if (!name || r.role === 'athlete') continue;
    byRole.set(r.role, [...(byRole.get(r.role) ?? []), name]);
  }
  const cards: StaffVisibilityCard[] = [];
  const people = new Set<string>();
  for (const role of ORDER) {
    const names = byRole.get(role);
    if (!names || names.length === 0) continue;
    names.forEach((n) => people.add(n));
    const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    cards.push({ role, roleWord: ROLE_WORD[role] ?? role, who, sees: SEES[role]!.sees, doesNotSee: SEES[role]!.doesNotSee });
  }
  return { cards, people: people.size };
}
