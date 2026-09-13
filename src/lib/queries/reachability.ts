import type { Db } from './groups';

/* PATTERN-S9's reachability figure: "18 of 30 athletes can receive
 * reminders", on the staff squad view, in the shape every other Fydr figure
 * takes — and NEVER merged with a compliance figure. An install problem is a
 * property of a phone; a missed check-in is a property of a person, and one
 * read as the other produces a conversation about attitude when the answer
 * was a Home Screen icon.
 *
 * What it measures, honestly: an athlete "can receive reminders" when the app
 * has recorded a standalone (Home Screen) open on a push-capable browser
 * (athlete_devices, 0121). Push itself is S11's; until a sender exists the
 * figure is about the phone's readiness and its caption says so. The caption
 * names the cause: how many have not added Fydr to a Home Screen, and of
 * those how many are on iPhone (where Safari alone cannot deliver). An
 * athlete with no row at all has never opened the app — "not opened yet",
 * said separately, never folded into "not installed". */

export type Reachability = {
  athletes: number;
  reachable: number;
  notInstalled: number;
  notInstalledIos: number;
  neverOpened: number;
};

export async function fetchReachability(db: Db, orgId: string, athleteIds: readonly string[]): Promise<Reachability> {
  if (athleteIds.length === 0) return { athletes: 0, reachable: 0, notInstalled: 0, notInstalledIos: 0, neverOpened: 0 };
  const { data, error } = await db.from('athlete_devices').select('athlete_id, platform, display_mode, push_supported').eq('org_id', orgId).in('athlete_id', athleteIds);
  if (error) throw new Error(error.message);
  const byAthlete = new Map<string, { reachable: boolean; ios: boolean }>();
  for (const d of data ?? []) {
    const cur = byAthlete.get(d.athlete_id) ?? { reachable: false, ios: false };
    if (d.display_mode === 'standalone' && d.push_supported) cur.reachable = true;
    if (d.platform === 'ios') cur.ios = true;
    byAthlete.set(d.athlete_id, cur);
  }
  let reachable = 0, notInstalled = 0, notInstalledIos = 0, neverOpened = 0;
  for (const id of athleteIds) {
    const a = byAthlete.get(id);
    if (!a) neverOpened += 1;
    else if (a.reachable) reachable += 1;
    else {
      notInstalled += 1;
      if (a.ios) notInstalledIos += 1;
    }
  }
  return { athletes: athleteIds.length, reachable, notInstalled, notInstalledIos, neverOpened };
}

/** The caption, naming the cause. */
export function reachabilityCaption(r: Reachability): string {
  if (r.athletes === 0) return 'Nobody in this filter.';
  const parts: string[] = [];
  if (r.notInstalled > 0) parts.push(`${r.notInstalled} ${r.notInstalled === 1 ? 'has' : 'have'} not added Fydr to a Home Screen${r.notInstalledIos > 0 ? `, of whom ${r.notInstalledIos} ${r.notInstalledIos === 1 ? 'is' : 'are'} on iPhone` : ''}`);
  if (r.neverOpened > 0) parts.push(`${r.neverOpened} ${r.neverOpened === 1 ? 'has' : 'have'} not opened the app yet`);
  const cause = parts.length > 0 ? `${parts.join('; ')}.` : 'Everyone has Fydr on a Home Screen.';
  return `${cause} Measured from how the app is opened, not from a reminder sent — reminders themselves are not built yet. Where to install is Settings › Reminders › Add to Home Screen in the athlete app.`;
}
