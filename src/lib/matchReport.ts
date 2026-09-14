/* Match participation and the match report (Isabella, decision batch 13
 * September 2026, "The match report, both halves approved"; built 15
 * September). Pure: the words the sheet and the report use, the sentence
 * with its placeholder, the selection's states and their order, the figure.
 * The record itself is match_participation (0127): one row per athlete
 * selected for a fixture — started, came on, minutes (null = not recorded,
 * never zero). No row = not selected. */

import type { AvailabilityStatus } from '@/lib/types/database';

/** The definition sentence, confirmed (supersedes the catalogue's draft). */
export const MATCH_DEFINITION =
  "Everything recorded against {fixture}: who was selected, who started, who came on, and minutes played, with each athlete's availability as it stood at kick-off. An athlete with no minutes recorded shows as not recorded, never as zero.";

export function matchDefinition(fixture: string): string {
  return MATCH_DEFINITION.replace('{fixture}', fixture);
}

/** "v Harlequins, Sat 18 Jul" — the fixture as the sentence names it. */
export function fixtureWords(opponent: string, dateWords: string): string {
  return `v ${opponent}, ${dateWords}`;
}

export type Selection = 'started' | 'came_on' | 'unused';

/** The three states of a row on the sheet, in the order the report lists them. */
export const SELECTION_ORDER: readonly Selection[] = ['started', 'came_on', 'unused'];
export const SELECTION_WORDS: Record<Selection, string> = { started: 'Started', came_on: 'Came on', unused: 'Selected, not used' };
export const NOT_SELECTED = 'Not selected';
export const MINUTES_NOT_RECORDED = 'Not recorded';

export function selectionOf(row: { started: boolean; came_on: boolean }): Selection {
  return row.started ? 'started' : row.came_on ? 'came_on' : 'unused';
}

/** Minutes as words: a number, or "Not recorded" — never a zero standing in
 *  for an absence. 0 is a real value and prints as 0. */
export function minutesWords(minutes: number | null): string {
  return minutes === null ? MINUTES_NOT_RECORDED : String(minutes);
}

/** The report's rows in the order the question is asked: starters first,
 *  then who came on, then the unused; within a state, most minutes first,
 *  not recorded last, then by name. */
export function sortRows<T extends { started: boolean; came_on: boolean; minutes: number | null; last_name: string; first_name: string }>(rows: readonly T[]): T[] {
  const rank = (r: T) => SELECTION_ORDER.indexOf(selectionOf(r));
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.minutes ?? -1) - (a.minutes ?? -1) ||
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
  );
}

/** The one figure: minutes recorded of the athletes selected, with the
 *  selection over the squad as the sample and the exclusions in a sentence
 *  (the constitution: every count with its denominator; "Nobody is excluded"
 *  when nobody is). */
export function matchFigure(o: { selected: number; started: number; cameOn: number; withMinutes: number; squad: number; fixture: string }): {
  label: string;
  count: string;
  value: string;
  sample: string;
  exclusions: string;
} {
  const pct = o.selected === 0 ? null : Math.round((100 * o.withMinutes) / o.selected);
  const notSelected = Math.max(0, o.squad - o.selected);
  return {
    label: 'Minutes recorded',
    count: o.selected === 0 ? 'No sheet' : `${o.withMinutes} of ${o.selected}`,
    value: pct === null ? 'Not recorded' : `${pct}%`,
    sample: o.selected === 0 ? `${o.fixture} · no athlete recorded as selected` : `${o.selected} selected of ${o.squad} in the squad · ${o.started} started, ${o.cameOn} came on · ${o.fixture}`,
    exclusions:
      o.selected === 0
        ? 'Nothing is recorded against this fixture yet. The coach’s post-match sheet on the fixture is where it enters.'
        : notSelected === 0
          ? 'Nobody is excluded: every athlete in the squad was selected.'
          : `${notSelected} athlete${notSelected === 1 ? '' : 's'} in the squad ${notSelected === 1 ? 'was' : 'were'} not selected and ${notSelected === 1 ? 'is' : 'are'} not counted. An athlete selected with no minutes recorded counts as selected, not as zero.`,
  };
}

/** Availability at kick-off, as the report words it. */
export function availabilityAtKickOffWords(status: AvailabilityStatus | null): string {
  if (status === null) return 'No status recorded';
  return status === 'available' ? 'Available' : status === 'modified' ? 'Modified' : 'Unavailable';
}
