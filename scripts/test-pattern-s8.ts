/* PATTERN-S8 — settings, users and club setup: the A items built on
 * 2026-09-13 under the standing rule (record, build A and B, append C and D
 * to the decision sheet). Copy, one control and two sizes; the record is in
 * docs/overnight-records-2026-09-12.md.
 *
 *   A1 Log out is a bordered 44px button with its own label (48 on a phone)
 *   A2 every settings row is one 52px / 64px target
 *   A3 Apple Health — the row is gone: removed from the product 2026-09-13
 *   A4 the exports intro names the signed-in role and that medical records
 *      are never exported
 *   A5 the audit log says what it cannot show
 *   A6 the Groups reorder arrows are 44×44
 *   A7 Catapult's control says what it is — "Import files", not "Connected"
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};
const hub = strip(read('src/app/(staff)/settings/page.tsx'));

console.log('A1. Log out is a button');
{
  assert(/<form action="\/auth\/sign-out" method="post" className="set-logout-form">/.test(hub), 'the form is no longer a list row');
  assert(/<button type="submit" className="btn-ghost set-logout">\s*Log out\s*<\/button>/.test(hub), 'a real button with its own label');
  /* REPINNED 16 Sept 2026 (the text rule, category 1): "Ends this session
     on this browser only" was helper prose and is gone; the button is its
     own label. */
  assert(!/Ends this session on this browser only/.test(hub), 'no helper line beside it (the text rule, 16 Sept 2026)');
  assert(/min-height:\s*(?:44px|var\(--tap-min\))/.test(rule('.set-logout')), '44px');
  assert(/\.main button:not\(\.sg-block\)\s*\{[^}]*min-height:\s*(?:44px|var\(--tap-min\));\s*\}\s*\.main button\.set-logout\s*\{[^}]*min-height:\s*48px/.test(css), '48px on a phone — after the shell\'s 44px floor, so it wins');
  assert(!/className="set-list-row" style=\{\{ width: '100%' \}\}/.test(hub), 'the 4.8px chevron target is gone');
}

console.log('\nA2. rows are one 52px target');
{
  assert(/min-height:\s*52px/.test(rule('.set-list-row')), '52px on desktop');
  assert(/@media \(max-width: 767px\)[\s\S]{0,300}\.set-list-row\s*\{[^}]*min-height:\s*64px/.test(css), '64px on a phone');
}

console.log('\nA3. Apple Health — removed from the product (2026-09-13, docs/platform-decision.md; D1 struck)');
{
  assert(!/Not available yet · needs the Fydr iOS app/.test(hub) && !/Apple Health<\/span>/.test(hub) && !/Apple Health connection<\/span>/.test(hub), 'no Apple Health row, no Premium-list line, no "needs the Fydr iOS app"');
  assert(!/Not connectable yet/.test(hub), 'the old line is gone');
  assert(!/Apple Health are on/.test(hub), 'the plan sentence no longer promises it');
}

console.log('\nA4. the exports intro');
{
  const ex = strip(read('src/app/(staff)/settings/exports/page.tsx'));
  assert(/Signed in as \{roleWord\}/.test(ex) && /const roleWord = staffRoleLabel\(claims\.roles\)/.test(ex), 'the role from the claims, never hardcoded');
  assert(/Medical records are never exported here\./.test(ex), 'and the one thing it may never export');
}

console.log('\nA5. the log says what it cannot show');
{
  const audit = strip(read('src/app/(staff)/settings/audit/page.tsx'));
  /* Corrected 16 Sept 2026 (decision batch 2026-09-14 #14): sessions and the
     schedule have been logged since 0104; groups is what is missing. */
  assert(/A group&rsquo;s rename or archive is not written to the log yet, so an empty filter there does not mean nothing happened\. Sessions, the schedule and everything else here is written as it happens\./.test(audit.replace(/\s+/g, ' ')), 'the coverage sentence under the table');
}

console.log('\nA6. the reorder arrows');
{
  const r = rule('.reorder-btn');
  assert(/width:\s*(?:44px|var\(--tap-min\))/.test(r) && /min-height:\s*(?:44px|var\(--tap-min\))/.test(r), '44×44, from 28×22');
}

console.log('\nA7. Catapult');
{
  // Repointed 2026-09-13 (PATTERN-S8 C2): the Integrations card moved one level down to /settings/club with the hub's other big cards.
  const club = strip(read('src/app/(staff)/settings/club/page.tsx'));
  assert(/Import files/.test(club) && !/data-variant="connected">\s*Connected/.test(club), '"Import files", not "Connected"');
}

console.log('\nthe record and the sheet');
{
  assert(/## PATTERN-S8 — Settings, users and club setup/.test(read('docs/overnight-records-2026-09-12.md')), 'the record');
  const sheet = read('docs/design-decisions-outstanding.md');
  // Repointed 2026-09-13: every C row is built and struck (~~PATTERN-S8~~ | ~~C1~~ … ~~C13~~); D8 and D9 stand for the D rows, struck or not.
  assert(/\| ~~PATTERN-S8~~ \| ~~C1~~ \|/.test(sheet) && /\| ~~PATTERN-S8~~ \| ~~C13~~ \|/.test(sheet) && /PATTERN-S8~*? \| ~*?D8/.test(sheet) && /\| ~~PATTERN-S8~~ \| ~~D9~~ \|/.test(sheet), 'C and D rows on the sheet');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
