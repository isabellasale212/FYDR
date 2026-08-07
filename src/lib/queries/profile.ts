import type { Db } from './groups';

/* screens/settings.md, "Profile": "Editable by the user themselves: display
 * name, phone, avatar, and for athletes the fields they own. Not editable
 * here: email, roles, squad number, groups, position." This file is that
 * paragraph, minus avatar.
 *
 * Two separate write paths, matching two separate tables and two separate
 * enforcement mechanisms:
 *   - updateMyContactDetails writes users.full_name/.phone. Enforcement is
 *     the query layer alone, never sending another column — the same trust
 *     model users_self_update (migration 0012) already relies on; that
 *     policy is row-scoped only, with no column-level backstop, because
 *     the columns this function can reach are already exactly the ones
 *     the row policy was written to allow.
 *   - updateMyPreferredName writes athletes.preferred_name. Enforcement is
 *     real, not just query-layer trust: migrations 0027-0029 add a
 *     database-level guard (a column grant plus a trigger, after the
 *     column grant alone turned out not to restrict anything — see 0029's
 *     own header for why) that rejects an athlete-role write touching any
 *     other column, regardless of what a compromised or careless client
 *     sends.
 *
 * What's cut, and why it's a real cut rather than an oversight:
 *   - Avatar upload. Needs a Supabase Storage bucket, an upload UI, and a
 *     content-type/size-limit policy — a real, separate small feature, not
 *     a form field.
 *   - date_of_birth. screens/settings.md is explicit this needs staff
 *     confirmation and a two-value audit trail (04-data-model.md §17.16)
 *     because crossing 18 changes which Children's Code protections apply
 *     — a workflow, not a text field, and not built here.
 *   - Email change. The spec routes it through Account security's
 *     verification flow, a different, unbuilt feature, not a plain update.
 */

export async function updateMyContactDetails(db: Db, userId: string, input: { fullName: string; phone: string | null }): Promise<{ error: string | null }> {
  const { error } = await db
    .from('users')
    .update({ full_name: input.fullName, phone: input.phone })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updateMyPreferredName(db: Db, athleteId: string, preferredName: string | null): Promise<{ error: string | null }> {
  const { error } = await db
    .from('athletes')
    .update({ preferred_name: preferredName })
    .eq('id', athleteId);
  return { error: error?.message ?? null };
}
