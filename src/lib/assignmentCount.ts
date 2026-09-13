/* PATTERN-S5 C4 (2026-09-13): "Distinct athletes is the headline of an
 * assignment. The emphasised card carries the count and shows its
 * arithmetic in the schedule's words: athletes in the selected groups, plus
 * named athletes, minus those counted twice, then the count against the
 * squad." The same rule as the schedule's "18 of 30 athletes are expected"
 * (S4 C5) and the dashboard's attention count (SS-01 A3): distinct, never a
 * sum of group sizes. Pure. */

export type AssignmentArithmetic = {
  /** Distinct athletes reached by the programme's active assignments. */
  distinct: number;
  /** "15 of 30 athletes" — or "15 athletes" with no squad count on record. */
  headline: string;
  /** "14 in Backs and Forwards + 2 named − 1 counted twice", or null when
   *  there is nothing to add up (one group, no names — the headline says it). */
  arithmetic: string | null;
};

export function assignmentArithmetic(o: {
  groups: readonly { name: string; memberIds: readonly string[] }[];
  namedIds: readonly string[];
  squad: number;
}): AssignmentArithmetic {
  const viaGroupsSum = o.groups.reduce((n, g) => n + g.memberIds.length, 0);
  const named = new Set(o.namedIds);
  const all = new Set<string>(named);
  for (const g of o.groups) for (const id of g.memberIds) all.add(id);
  const distinct = all.size;
  const overlap = viaGroupsSum + named.size - distinct;

  const headline =
    distinct === 0
      ? 'Nobody assigned yet'
      : o.squad > 0
        ? `${distinct} of ${o.squad} athlete${o.squad === 1 ? '' : 's'}`
        : `${distinct} athlete${distinct === 1 ? '' : 's'}`;

  const parts: string[] = [];
  if (o.groups.length > 0) parts.push(`${viaGroupsSum} in ${o.groups.map((g) => g.name).join(' and ')}`);
  if (named.size > 0) parts.push(`${named.size} named`);
  const summed = parts.join(' + ');
  const arithmetic =
    distinct === 0 || (parts.length < 2 && overlap === 0)
      ? null
      : overlap > 0
        ? `${summed} − ${overlap} counted twice`
        : summed;

  return { distinct, headline, arithmetic };
}
