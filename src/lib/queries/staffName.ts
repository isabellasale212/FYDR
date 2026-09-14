import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** A staff member's name for an athlete-facing sentence ("set by Ruth
 *  Callaghan, physiotherapist"). An athlete's session cannot read other
 *  users' rows; the read is the service role's, scoped to the athlete's own
 *  verified club, and returns the name and the role word only. */
export async function fetchStaffName(orgId: string, userId: string | null): Promise<{ name: string; role: string | null } | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const [user, roles] = await Promise.all([
    admin.from('users').select('full_name').eq('org_id', orgId).eq('id', userId).maybeSingle(),
    admin.from('user_roles').select('role').eq('org_id', orgId).eq('user_id', userId),
  ]);
  if (!user.data) return null;
  const r = (roles.data ?? []).map((x) => x.role);
  const role = r.includes('medic') ? 'physiotherapist' : r.includes('sport_scientist') ? 'sport scientist' : r.includes('coach') ? 'coach' : r.includes('strength_conditioning') ? 'S&C coach' : null;
  return { name: user.data.full_name, role };
}
