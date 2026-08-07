/* The query key factory.
 *
 * One namespace per domain, `orgId` second in every key, filter arrays sorted
 * so two callers who pass the same groups in a different order share a cache
 * entry, dates as ISO strings. 05-architecture.md §9 and 20-route-map.md §4.1.
 *
 * Keys are built here and nowhere else. An inline array literal in a component
 * is how a cache quietly splits in two. */

export const sortedIds = (ids: readonly string[]): string[] =>
  [...ids].sort();

export const qk = {
  groups: {
    all: ['groups'] as const,
    list: (orgId: string) => ['groups', orgId, 'list'] as const,
  },

  squad: {
    all: ['squad'] as const,
    list: (orgId: string, groupIds: readonly string[]) =>
      ['squad', orgId, 'list', sortedIds(groupIds)] as const,
    athlete: (orgId: string, athleteId: string) =>
      ['squad', orgId, 'athlete', athleteId] as const,
  },

  availability: {
    all: ['availability'] as const,
    counts: (orgId: string, groupIds: readonly string[]) =>
      ['availability', orgId, 'counts', sortedIds(groupIds)] as const,
    list: (orgId: string, groupIds: readonly string[]) =>
      ['availability', orgId, 'list', sortedIds(groupIds)] as const,
    athlete: (orgId: string, athleteId: string) =>
      ['availability', orgId, 'athlete', athleteId] as const,
    mine: (orgId: string, athleteId: string) =>
      ['availability', orgId, 'mine', athleteId] as const,
  },

  wellness: {
    all: ['wellness'] as const,
    byAthlete: (orgId: string, athleteId: string, range: { from: string; to: string }) =>
      ['wellness', orgId, 'byAthlete', athleteId, range.from, range.to] as const,
    day: (orgId: string, athleteId: string, entryDate: string) =>
      ['wellness', orgId, 'day', athleteId, entryDate] as const,
  },

  training: {
    all: ['training'] as const,
    session: (orgId: string, sessionId: string) =>
      ['training', orgId, 'session', sessionId] as const,
    entryForSession: (orgId: string, athleteId: string, sessionId: string) =>
      ['training', orgId, 'entry', athleteId, sessionId] as const,
  },

  schedule: {
    all: ['schedule'] as const,
    day: (orgId: string, date: string, groupIds: readonly string[]) =>
      ['schedule', orgId, 'day', date, sortedIds(groupIds)] as const,
    mineDay: (orgId: string, athleteId: string, date: string) =>
      ['schedule', orgId, 'mineDay', athleteId, date] as const,
    athleteRecent: (orgId: string, athleteId: string, days: number) =>
      ['schedule', orgId, 'athleteRecent', athleteId, days] as const,
  },

  compliance: {
    all: ['compliance'] as const,
    squadDay: (orgId: string, date: string, groupIds: readonly string[]) =>
      ['compliance', orgId, 'squadDay', date, sortedIds(groupIds)] as const,
    mine: (orgId: string, athleteId: string, date: string) =>
      ['compliance', orgId, 'mine', athleteId, date] as const,
  },

  flags: {
    all: ['flags'] as const,
    attention: (orgId: string, date: string, groupIds: readonly string[]) =>
      ['flags', orgId, 'attention', date, sortedIds(groupIds)] as const,
  },

  injuries: {
    all: ['injuries'] as const,
    athlete: (orgId: string, athleteId: string) =>
      ['injuries', orgId, 'athlete', athleteId] as const,
  },
} as const;
