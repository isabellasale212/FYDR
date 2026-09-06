/** The club's playing positions, in the order a team sheet lists them.
 *
 *  Screen 63 asks for "Position, from the same list used on the athlete
 *  profile". There was no such list to import: the profile renders whatever
 *  string the record holds, and the only enumeration in the codebase was
 *  POSITION_TO_UNIT in queries/leaderboardWall.ts, which maps these same eleven
 *  onto the spec's six units. Its header records that all eleven are real values
 *  in live data, confirmed across an entire squad, so this is the club's actual
 *  vocabulary rather than a list invented for a form.
 *
 *  athletes.position is TEXT, not an enum, and this does not change that. A club
 *  in another code, or one that writes "Openside" instead of "Flanker", keeps
 *  working; existing records keep whatever they hold. This is the list the form
 *  OFFERS, which is a different and much weaker claim than the list the database
 *  ALLOWS -- and the weaker claim is the right one until somebody decides
 *  positions should be closed, which is a product question nobody has asked.
 *
 *  Ordered front row outward, the order a squad list is read in, not
 *  alphabetically. */
export const POSITIONS = [
  'Loosehead prop',
  'Hooker',
  'Tighthead prop',
  'Lock',
  'Flanker',
  'Number 8',
  'Scrum-half',
  'Fly-half',
  'Centre',
  'Wing',
  'Full-back',
] as const;

export type Position = (typeof POSITIONS)[number];
