/* Two floors a screen reader depends on, checked at the source.
 *
 * 1. A FAILURE THAT IS RENDERED IS ANNOUNCED. An audit on 2026-09-09 found four
 *    components that set an error, render it into the DOM, and carry neither
 *    role="alert" nor aria-live: NewTemplateForm, ApplyControls,
 *    HealthkitConsentToggle and WeekTemplateBuilder — the last with six distinct
 *    failure paths, all silent. A sighted user sees red text; a screen-reader
 *    user presses Save and hears nothing at all. WCAG 4.1.3 Status Messages.
 *
 *    The pattern was already right in 87 other places, which is what makes this
 *    worth a guard rather than four fixes: the app knows how to do it, and four
 *    files drifted out of a convention nothing enforced.
 *
 * 2. EVERY SCREEN HAS A HEADING. Three staff routes — /schedule, /compliance and
 *    /squad/roster — rendered no heading element of ANY level, and no nested
 *    layout or imported component supplied one. Heading navigation is a primary
 *    screen-reader wayfinding method; on those three there was nothing to
 *    navigate. WCAG 1.3.1 and 2.4.6.
 *
 *    THE FIRST VERSION OF THIS CHECK WAS WRONG IN THE INSTRUCTIVE DIRECTION. A
 *    plain grep for <h1 in page.tsx reported TEN failures. Seven were false: the
 *    heading comes from ReportHeader, PlanGate, GymSessionLogger or
 *    ExerciseLibraryList. A route-folder grep answers "does this screen show X"
 *    with a confident, wrong no — so this resolves each page's local imports and
 *    asks whether any of them renders a heading, which is the same discipline
 *    check-injury-boundary-captions uses for call sites.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
};

/* ---------------------------------------------------------------- 1. errors */
console.log('a failure that reaches the DOM reaches the screen reader too');
{
  const ANNOUNCES = /role="alert"|aria-live=/;
  const silent: string[] = [];
  for (const f of walk('src/components')) {
    const src = read(f);
    if (!/setError\(/.test(src)) continue;
    /* Only files that RENDER the error themselves. One that hands it to a child
       is that child's problem, and flagging it here would be the false positive
       this guard is shaped to avoid. */
    if (!/\{error \?|\{error &&|\{error\b[^}]*\}/.test(src)) continue;
    if (!ANNOUNCES.test(src)) silent.push(f.replace('src/components/', ''));
  }
  assert(
    silent.length === 0,
    silent.length === 0
      ? 'every component that renders its own error also announces it'
      : `${silent.length} render an error silently: ${silent.join(', ')}`,
  );
}

/* -------------------------------------------------------------- 2. headings */
console.log('\nevery screen has a heading to navigate by');
{
  const HEADING = /<h[1-6][\s>]/;
  /* Components that render a heading, DIRECTLY OR THROUGH ANOTHER COMPONENT.
     One level of resolution was not enough and the shortfall was not academic:
     /schedule renders <ScheduleWorkspace>, /reports/compliance renders
     <ReportPager>, and both of those render <ReportHeader>, which renders the
     <h1>. Stopping at one level reported them as headless — two false failures
     that would have had somebody adding a duplicate h1 to a page that already
     had one. Iterated to a fixed point instead. */
  const renders = new Map<string, string>();
  for (const f of walk('src/components')) renders.set(f.split('/').pop()!.replace('.tsx', ''), read(f));
  const headingComponents = new Set<string>();
  for (const [name, src] of renders) if (HEADING.test(src)) headingComponents.add(name);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, src] of renders) {
      if (headingComponents.has(name)) continue;
      for (const c of headingComponents) {
        if (new RegExp(`<${c}[\\s/>]`).test(src)) { headingComponents.add(name); changed = true; break; }
      }
    }
  }

  const pages = walk('src/app').filter((f) => f.endsWith('page.tsx'));
  const headless: string[] = [];
  for (const page of pages) {
    const src = read(page);
    if (HEADING.test(src)) continue;
    /* A page that only redirects renders no UI, so it has no heading to lack.
       src/app/page.tsx is exactly this: middleware sends a signed-in user to
       their shell, and anyone reaching it has no session. */
    if (/^\s*redirect\(/m.test(src) && !/return \(/.test(src)) continue;
    /* Resolve the page's own local imports and ask whether any renders one. */
    const imported = [...src.matchAll(/from '@\/components\/[^/]+\/([A-Za-z0-9_]+)'/g)].map((m) => m[1]!);
    if (imported.some((c) => headingComponents.has(c))) continue;
    /* A nested layout may carry it instead. */
    const layout = join(page, '..', 'layout.tsx');
    if (existsSync(layout) && HEADING.test(read(layout))) continue;
    headless.push(page.replace('src/app/', ''));
  }
  assert(
    headless.length === 0,
    headless.length === 0
      ? `all ${pages.length} routes render a heading, directly or through a component that does`
      : `${headless.length} render no heading at all: ${headless.join(', ')}`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
