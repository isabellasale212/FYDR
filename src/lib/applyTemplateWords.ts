/** The consequence of applying a week template, named before the button in
 *  B11's dialog (PATTERN-S4 C7, ruled 2026-09-13, batch B7): "This will remove
 *  4 sessions already in this week and add 9 from the template." What stays is
 *  said too, so nobody is surprised by a session the replace left alone. Pure,
 *  so the sentence can be pinned. */

export type ApplySummary = {
  create: number;
  softDelete: number;
  keep: number;
  keepsMatch: boolean;
  unmapped: number[];
};

function sessions(n: number): string {
  return `${n} session${n === 1 ? '' : 's'}`;
}

export function applyConsequence(summary: ApplySummary): string {
  const removeClause = summary.softDelete === 0 ? 'remove nothing already in this week' : `remove ${sessions(summary.softDelete)} already in this week`;
  // "add 9 from the template", not "add 9 sessions" — the ruling's own sentence.
  const addClause = summary.create === 0 ? 'add nothing from the template' : `add ${summary.create} from the template`;
  return `This will ${removeClause} and ${addClause}.`;
}

/** The second sentence: what the replace leaves alone. Empty when nothing stays. */
export function applyKeeps(summary: ApplySummary): string {
  const parts: string[] = [];
  if (summary.keep > 0) parts.push(`${sessions(summary.keep)} with recorded attendance or ratings`);
  if (summary.keepsMatch) parts.push('the match');
  if (parts.length === 0) return '';
  const subject = parts.join(' and ');
  const verb = summary.keep > 1 || (summary.keep > 0 && summary.keepsMatch) ? 'stay' : 'stays';
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${verb}.`;
}

/** The third, only when a template position has no day this week. */
export function applySkipped(summary: ApplySummary): string {
  if (summary.unmapped.length === 0) return '';
  const n = summary.unmapped.length;
  return `${n} template position${n === 1 ? ' has' : 's have'} no matching day this week and will be skipped.`;
}
