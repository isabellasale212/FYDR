/* §0ak — the group filter is shared across every multi-athlete screen, both
 * directions. Decided by Isabella 2026-09-11, built 2026-09-12.
 *
 * THE RULE. Every multi-athlete screen reads and writes the same cookie
 * (`fydr-group-filter`). Pressing a chip anywhere writes it and applies
 * everywhere. A `?groups=` URL parameter overrides only for that page load —
 * it exists for shared links — and does not write the cookie.
 *
 * THE DEFECT. Two chip rows exist: GroupFilter (Squad overview and fourteen
 * more screens) wrote the cookie and the URL; ReportHeader (the six reports
 * and the schedule) wrote the URL only. Squad overview → report carried;
 * report → Squad overview did not. Both now write through one function,
 * lib/groupFilterCookie.ts, whose assignment string is pure and read here.
 *
 * THE SWEEP the to-do asked for is done here rather than by hand: every
 * staff page that renders a chip row (GroupFilter, ReportHeader, or a
 * ReportPager header with groups) must resolve its scope through
 * resolveGroupFilter(), which reads the URL first and the cookie only when
 * the key is genuinely absent. A page that read only the URL would ignore a
 * filter chosen elsewhere; a page that wrote the cookie from the server would
 * turn a shared link into a sticky choice. Neither exists, and this fails the
 * build if one appears.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GROUP_FILTER_COOKIE, GROUP_FILTER_COOKIE_MAX_AGE, groupFilterCookie } from '@/lib/groupFilterCookie';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('one cookie, one writer');
{
  assert(GROUP_FILTER_COOKIE === 'fydr-group-filter', 'the cookie is fydr-group-filter');
  assert(GROUP_FILTER_COOKIE_MAX_AGE === 60 * 60 * 24 * 180, 'and lives 180 days — a preference, not a session value');
  assert(groupFilterCookie(['b', 'a']) === 'fydr-group-filter=b%2Ca; path=/; max-age=15552000', 'a selection writes the ids, comma-joined and encoded, site-wide');
  assert(groupFilterCookie([]) === 'fydr-group-filter=; path=/; max-age=0', 'Whole squad clears it (max-age 0), so a bare URL then means "no filter" everywhere');
  const filter = strip(read('src/components/GroupFilter/GroupFilter.tsx'));
  const header = strip(read('src/components/ReportHeader/ReportHeader.tsx'));
  const server = strip(read('src/lib/groupFilter.server.ts'));
  assert(/writeGroupFilterCookie\(next\)/.test(filter) && !/document\.cookie/.test(filter), 'GroupFilter writes through writeGroupFilterCookie, not its own document.cookie');
  assert(/writeGroupFilterCookie\(next\)/.test(header) && !/document\.cookie/.test(header), 'ReportHeader writes through the same function — the half that was missing');
  const setGroups = /function setGroups\(next: string\[\]\) \{([\s\S]*?)\n  \}/.exec(header)?.[1] ?? '';
  assert(/writeGroupFilterCookie\(next\);[\s\S]*router\.push\(/.test(setGroups), 'and writes it before the navigation, so the next screen reads the new choice');
  assert(/from '\.\/groupFilterCookie'/.test(server) && !/const GROUP_FILTER_COOKIE = /.test(server), 'the server reader takes the cookie name from the same module — one name, three files');
  assert(!/cookies\(\)[\s\S]*\.set\(/.test(server) && !/\.set\(GROUP_FILTER_COOKIE/.test(server), 'and never writes it: a ?groups= link is a one-load override, not a sticky choice');
  assert(/if \(value !== undefined\) return parseGroupParam\(value\);/.test(server), 'the URL wins whenever the key is present at all, including present-and-empty');
  const walkAll = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkAll(join(d, e.name)) : /\.tsx?$/.test(e.name) ? [join(d, e.name)] : []);
  const others = ['src/components', 'src/app', 'src/lib'].flatMap(walkAll)
    .filter((f) => !f.endsWith('groupFilterCookie.ts') && /fydr-group-filter/.test(strip(read(f))));
  assert(others.length === 0, `no other file spells the cookie name as a literal (${others.join(', ') || 'none'})`);
}

console.log('\nthe sweep: every screen with a chip row resolves through the cookie-aware reader');
{
  const pages: string[] = [];
  (function walk(d: string): void {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'page.tsx') pages.push(p);
    }
  })('src/app/(staff)');
  /* A ReportPager only carries chips when the page hands it a header; the
     athlete report (one athlete, the filter deliberately off — route map §6.2)
     uses the pager without one. */
  const withChips = pages.filter((p) => { const src = strip(read(p)); return /<GroupFilter\b|<ReportHeader\b/.test(src) || (/<ReportPager\b/.test(src) && /header=\{/.test(src)); });
  assert(withChips.length >= 17, `${withChips.length} staff screens render a group chip row (GroupFilter, ReportHeader or a ReportPager header)`);
  const notResolving = withChips.filter((p) => !/resolveGroupFilter\(/.test(strip(read(p))));
  assert(notResolving.length === 0, notResolving.length === 0
    ? 'every one of them resolves its scope through resolveGroupFilter() — URL first, then the cookie'
    : `these read the URL only or nothing: ${notResolving.map((p) => p.replace('src/app/(staff)/', '')).join(', ')}`);
  const raw = withChips.filter((p) => /parseGroupParam\(/.test(strip(read(p))));
  assert(raw.length === 0, raw.length === 0 ? 'and none bypasses it with a raw parseGroupParam() of the URL' : `raw URL reads: ${raw.join(', ')}`);
  for (const must of ['squad/page.tsx', 'reports/squad/page.tsx', 'reports/training/page.tsx', 'reports/compliance/page.tsx', 'dashboard/page.tsx', 'flags/page.tsx', 'nutrition/page.tsx', 'leaderboards/page.tsx', 'analytics/page.tsx']) {
    assert(withChips.some((p) => p.endsWith(must)), `${must} is in the sweep`);
  }
}

console.log('\nthe route map says so');
{
  const map = read('docs/20-route-map.md');
  assert(/writes the same `fydr-group-filter` cookie/.test(map) && /does not write the cookie/.test(map), '20-route-map.md §6.2 records the shared-cookie rule and the one-load override');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
