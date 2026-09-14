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
 * The board's "no body site and no side" for the coach is enforced since
 * 0122 (PATTERN-S3 C8): the injuries_staff view masks both unless the club's
 * setting `coach_sees_injury_site` is on, and the columns are not readable at
 * the table. The coach card is worded from that setting — the board's wording
 * while it is off, and the honest wider one while a club has turned it on —
 * so the card says what is enforced for this club, never a general claim. */

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
    sees: 'your morning check-in answers, your session ratings, your gym logs, and whether you are available to train with one line saying what you cannot do this week.',
    doesNotSee: 'your diagnosis, your treatment notes, the body site or side of an injury, or your weight. Those stay with the physiotherapist.',
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

/** The coach card when the club has turned the site setting on (0122). */
const COACH_SEES_SITE = {
  sees: 'your morning check-in answers, your session ratings, your gym logs, whether you are available to train with one line saying what you cannot do this week, and the body area and side of an open injury — this club has chosen to show the coach where an injury is.',
  doesNotSee: 'your diagnosis, your treatment notes, or your weight. Those stay with the physiotherapist.',
};

const ORDER: AppRole[] = ['coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];

export async function fetchStaffVisibility(orgId: string): Promise<StaffVisibility> {
  /* Service role, scoped to the verified session's own club: an athlete's
     session cannot read other users' rows, and the names of their own club's
     staff are the point of the screen. */
  const admin = createAdminClient();
  const [users, roles, org] = await Promise.all([
    admin.from('users').select('id, full_name').eq('org_id', orgId).eq('status', 'active').is('deleted_at', null),
    admin.from('user_roles').select('user_id, role').eq('org_id', orgId),
    admin.from('organisations').select('coach_sees_injury_site').eq('id', orgId).maybeSingle(),
  ]);
  const coachSeesSite = org.data?.coach_sees_injury_site === true;
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
    const words = role === 'coach' && coachSeesSite ? COACH_SEES_SITE : SEES[role]!;
    cards.push({ role, roleWord: ROLE_WORD[role] ?? role, who, sees: words.sees, doesNotSee: words.doesNotSee });
  }
  return { cards, people: people.size };
}
