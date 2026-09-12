/* ATH-ADULT-12 — My data, the A items of the "My data and history" board
 * (2026-09-12). The record is docs/overnight-records-2026-09-12.md; everything
 * else on that board (five segments, uncoloured deltas, the hero fact line,
 * the empty-period states, the chart tokens) is recorded there as B, C or D
 * and is NOT built — test-my-data-redesign.ts still pins three segments, the
 * accent-filled live segment and the green ▲.
 *
 *   A1 an absent value is words, never a dash: "Not submitted" on the
 *      wellness list (detail "No morning check-in"), "Not logged" on the gym
 *      and tests lists, in the value column, --fs-13 / 600 / --faint; the
 *      page's em-dash constant is gone. This settles 09 D1 / 10 D1, which
 *      deferred the missing-value form to this flow.
 *   A2 the wellness value column widens to 92px so the word fits without
 *      wrapping, and stays FIXED so its left edge still does not move
 *   A3 the hero figure is --fs-48, the board's size, a token that exists
 *   A4 a history row is at least 44px, so a date-only row is still a target
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const page = strip(read('src/app/(athlete)/my-data/page.tsx'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('A1. an absent value is words, never a dash');
{
  assert(!/NO_VALUE/.test(page) && !/\\u2014/.test(page) && !/—/.test(page.replace(/[^\S\n]+—[^\S\n]+/g, '')),
    'the em-dash constant is gone from the page (a spaced dash in prose is still allowed)');
  assert(/entry \? formatNumber\(entry\.readiness_score, 0\) : 'Not submitted'/.test(page),
    'a wellness day with no entry says "Not submitted" in the value column');
  assert(/: 'No morning check-in'\}/.test(page), 'and its detail line says "No morning check-in"');
  assert(!/'not submitted'/.test(page), 'the lower-case detail-line version is gone');
  assert(/if \(kg === null\) return 'Not logged';/.test(page), 'a gym session with no tonnage says "Not logged"');
  assert(/withUnit\(s\.latestValue\.toFixed\(s\.decimal_places\), s\.unit\)\s*: 'Not logged'/.test(page),
    'a test with no result says "Not logged"');
  assert(!/'No result yet'/.test(page), 'and no longer says "No result yet" on the line above it as well');
  const missing = rule(".hist-value[data-missing]");
  assert(/color:\s*var\(--faint\)/.test(missing), '.hist-value[data-missing] is --faint');
  assert(/font-size:\s*var\(--fs-13\)/.test(missing), 'at --fs-13');
  assert(/font-weight:\s*600/.test(missing), 'and 600');
  assert(/white-space:\s*nowrap/.test(missing), 'and does not wrap');
}

console.log('\nA2. the wellness value column holds the word');
{
  assert(/'--hist-val-w': '92px'/.test(page), 'the wellness list sets --hist-val-w to 92px');
  assert(!/'--hist-val-w': '54px'/.test(page), 'and 54px is gone');
  assert(/grid-template-columns:\s*minmax\(0, 1fr\) var\(--hist-val-w, auto\)/.test(rule('.hist-row')),
    'the column is still a fixed track, so its left edge does not move');
  assert(/text-align:\s*right/.test(rule('.hist-value')), 'and the value is right-aligned in it, so a score and a word share an edge');
}

console.log('\nA3. the hero figure at the board\'s size');
{
  assert(/font-size:\s*var\(--fs-48\)/.test(rule('.rd-value')), '.rd-value is --fs-48');
  assert(/--fs-48:/.test(read('src/styles/tokens.css')), 'which is a token that exists');
}

console.log('\nA4. a history row is a target');
{
  assert(/min-height:\s*44px/.test(rule('.hist-row')), '.hist-row has min-height 44px');
}

console.log('\nwhat this flow did NOT change (recorded, not built)');
{
  const bar = /SEGMENTS[^=]*=\s*\[([^\]]*)\]/.exec(page)?.[1] ?? '';
  assert(/'training'/.test(bar) && /'nutrition'/.test(bar), 'five segments (D1 reversed 2026-09-12; pinned in test-my-data-redesign.ts)');
  assert(rule(".rd-delta[data-dir='up']") === '', 'the delta is no longer coloured (D3 reversed 2026-09-12; pinned in test-my-data-redesign.ts)');
  assert(/BLANK/.test(page), "the training table keeps the app-wide table blank until its own rebuild (C2)");
  assert(!/--chart-h|--chart-stroke|--blue-200|--t-num-hero/.test(read('src/styles/tokens.css')), 'no new token (B1, B2)');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/06-my-data.md');
  assert(/Not submitted/.test(spec) && /Not logged/.test(spec), '06-my-data.md records the words');
  assert(/48px|--fs-48/.test(spec), 'and the hero size');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
