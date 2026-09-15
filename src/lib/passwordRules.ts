/* PATTERN-S9 artboard 1: the rules, stated before typing, checked as the
 * athlete types. Pure, so the guard can hold them.
 *
 *   1. At least 12 characters — the app's one password standard
 *      (docs/09-security-and-compliance.md §8; ChangePasswordForm and
 *      ResetConfirmForm both read 12).
 *   2. No part of your name or the club's name — any word of three or more
 *      letters from the first name, last name or club name, case-insensitive.
 *
 * Two rules, not three. The board drew a third — "Not a password you already
 * use somewhere else" — that no code can check; it was built as the athlete's
 * own checkbox, then REMOVED ENTIRELY by Isabella's ruling of 14 September
 * 2026 (decision batch #7): "A rule software cannot check is theatre." Not a
 * checkbox, not a system tick, and no advice line either — nothing at all
 * about reuse. The count reads "n of 2 rules met".
 *
 * Before typing every rule reads '–' (not checked yet). Once typing, met rules
 * tick and the unmet ones say what they need — the denominator rule applied
 * to something that is not data. */

export const PASSWORD_MIN = 12;

export type RuleState = 'unchecked' | 'met' | 'unmet';

export type PasswordRule = { id: 'length' | 'names'; label: string; state: RuleState; detail: string | null };

function nameWords(...parts: (string | null | undefined)[]): string[] {
  return parts
    .flatMap((p) => (p ?? '').toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length >= 3);
}

export function passwordRules(o: { password: string; firstName: string; lastName: string; clubName: string }): PasswordRule[] {
  const typed = o.password.length > 0;
  const words = nameWords(o.firstName, o.lastName, o.clubName);
  const lower = o.password.toLowerCase();
  const hit = words.find((w) => lower.includes(w));
  const short = o.password.length < PASSWORD_MIN;
  return [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN} characters`,
      state: !typed ? 'unchecked' : short ? 'unmet' : 'met',
      detail: typed && short ? ` — this has ${o.password.length}` : null,
    },
    {
      id: 'names',
      label: 'No part of your name or the club’s name',
      state: !typed ? 'unchecked' : hit ? 'unmet' : 'met',
      detail: typed && hit ? ` — this contains “${hit}”` : null,
    },
  ];
}

export function rulesMet(rules: PasswordRule[]): number {
  return rules.filter((r) => r.state === 'met').length;
}

/** The one sentence under the field when a rule is unmet: what it needs. */
export function unmetLine(rules: PasswordRule[], password: string): string | null {
  const first = rules.find((r) => r.state === 'unmet');
  if (!first) return null;
  if (first.id === 'length') {
    const missing = PASSWORD_MIN - password.length;
    return `Add ${missing === 1 ? 'one more character' : `${missing} more characters`}. This one is ${password.length} of the ${PASSWORD_MIN} needed.`;
  }
  return 'Take your name and the club’s name out of it.';
}
