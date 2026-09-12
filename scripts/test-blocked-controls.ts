/* One rule for every blocked control — decided 2026-09-12 (STAFF-SS-02-05
 * D2, Builder question 8; closes §0ap's dead "Tap one below to see why" and
 * §0av's three greyed weigh-in buttons): a control the reader may not use
 * carries aria-disabled and shows its reason on tap or focus, never a title
 * attribute, never silently dead.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the component');
{
  const c = strip(read('src/components/BlockedButton/BlockedButton.tsx'));
  assert(/aria-disabled="true"/.test(c) && !/\sdisabled(=|\s|>)/.test(c.replace(/'disabled'/g, '').replace(/aria-disabled/g, '')), 'aria-disabled, never the disabled attribute');
  assert(/role="status"/.test(c) && /className="blocked-why"/.test(c), 'the reason is a status beneath');
  assert(/aria-describedby=\{shown \? whyId : undefined\}/.test(c), 'the button is described by it while shown');
  assert(/onFocus=\{\(e\) => \{\s*setShown\(true\)/.test(c) && /e\.preventDefault\(\);\s*setShown\(true\)/.test(c), 'shown on focus and on tap');
  assert(!/\btitle=/.test(c), 'no title attribute anywhere in it');
}

console.log('\nthe sites');
{
  const sites: [string, RegExp][] = [
    ['src/components/LeaderboardBuilderForm/LeaderboardBuilderForm.tsx', /<BlockedButton[\s\S]{0,300}blocked\s+reason=\{`\$\{m\.label\} cannot be ranked\. \$\{m\.ineligible_reason\}`\}/],
    ['src/components/BodyWeightPanel/BodyWeightPanel.tsx', /<BlockedButton[\s\S]{0,200}blocked=\{!canLog\}/],
    ['src/components/PlayerProfileBio/PlayerProfileBio.tsx', /<BlockedButton[\s\S]{0,200}blocked\s+reason="Medical reads the roster/],
    ['src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx', /<BlockedButton[\s\S]{0,300}blocked=\{!canCorrect\}/],
    ['src/components/LeaderboardWall/LeaderboardWall.tsx', /<BlockedButton[\s\S]{0,300}blocked=\{disabled\}/],
  ];
  for (const [p, re] of sites) {
    const src = strip(read(p));
    assert(re.test(src), `${p.split('/').slice(-1)[0]} uses BlockedButton for its blocked control`);
    const blockedTitles = src.match(/title=\{[^}]*(belongs to|cannot|does not edit|Requires|unavailable)[^}]*\}|title="[^"]*(belongs to|cannot|does not edit)[^"]*"/g) ?? [];
    assert(blockedTitles.length === 0, `and carries no reason in a title (${blockedTitles.length})`);
  }
  const builder = strip(read('src/components/LeaderboardBuilderForm/LeaderboardBuilderForm.tsx'));
  assert(!/disabled\s*\n?\s*style=[\s\S]{0,120}onClick/.test(builder) && !/\n\s*disabled\n/.test(builder.slice(builder.indexOf('ineligible.map'), builder.indexOf('ineligible.map') + 800)), "§0ap's guard: no `disabled` beside an onClick on the ineligible row");
  assert(/Tap one below to see why/.test(builder), 'the copy that promised the tap still stands — and the tap lands now');
  const settings = strip(read('src/app/(staff)/settings/page.tsx'));
  assert(!/data-disabled="true" aria-disabled="true" title=/.test(settings), "the Settings hub's exports row carries no title (its reason is printed in the row)");
}

console.log('\nthe style');
{
  const css = strip(read('src/styles/base.css'));
  assert(/\[data-blocked\]\s*\{[^}]*color:\s*var\(--muted\)/.test(css), 'a blocked control keeps its box and mutes its ink');
  assert(/\.blocked-why\s*\{[^}]*flex-basis:\s*100%/.test(css), 'the reason takes a full line of a wrapping row');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
