/* The skeleton hold and floor — docs/decisions/skeleton-gate.md (Isabella,
 * 15 Sept 2026, and the same-day amendment).
 *
 * The hold: a loading skeleton is invisible for the first 200ms of its wait
 * and appears only if the wait outlasts it. The floor: once it has appeared
 * it stays for at least 300ms. Both are properties of the skeleton, not of a
 * route, and both live in a handful of places that must agree:
 *
 *   base.css          the hold itself (.sk-page, opacity 0, the delayed
 *                     `sk-appear` keyframe with `both` fill), kept under
 *                     reduced motion on purpose, and the `sk-cancelled` drop
 *   skeletonClock.ts  the two numbers and the shared record
 *   SkHeld.tsx        the held element; records the appearance, drops the
 *                     hold when the content beat it — a class, never state
 *   Skeleton.tsx      SkPage: the live region OUTSIDE the held element, and
 *                     the hard-load recorder (an inline script that also
 *                     sets React's streaming reveal clock)
 *   SkFloor.tsx       the content side: waits out the floor
 *   the five pages    every route with a loading.tsx skeleton returns its
 *                     awaited content through SkFloor
 *   react-dom         the streaming runtime's reveal clock, an internal the
 *                     hard-load half relies on
 *
 * Each is pinned at source level, and the lists are counted
 * (scripts/lib/coverage.ts): five skeleton routes means five. Measured
 * behaviour (both harnesses, 15 Sept): content at 120ms → no skeleton at
 * all; at 230/320/450ms → skeleton from ~200ms, replaced at ~500ms; at
 * 900ms → replaced on arrival. Identical under reduced motion. */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const css = read('src/styles/base.css');
const clock = read('src/components/Skeleton/skeletonClock.ts');
const held = read('src/components/Skeleton/SkHeld.tsx');
const skeleton = read('src/components/Skeleton/Skeleton.tsx');
const floor = read('src/components/Skeleton/SkFloor.tsx');

console.log('the hold: .sk-page is opacity 0 for 200ms, then a snap, laid out from the first frame');
{
  const block = css.slice(css.indexOf('\n.sk-page {'), css.indexOf('\n}', css.indexOf('\n.sk-page {')));
  assert(/^\s*opacity: 0;/m.test(block), '.sk-page starts at opacity 0');
  assert(/^\s*animation: sk-appear 1ms linear 200ms both;/m.test(block), '.sk-page runs sk-appear after a 200ms delay with `both` fill (the box is laid out from the first frame; only the paint waits)');
  assert(!/transform|visibility|display: none|height: 0/.test(block), 'the hold is opacity only — nothing that would shift layout or hide the box');
  assert(/@keyframes sk-appear \{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/.test(css), 'sk-appear goes from opacity 0 to 1 and nothing else');
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {', css.indexOf('@keyframes sk-appear')));
  const rmBlock = rm.slice(0, rm.indexOf('\n}\n') + 3);
  assert(/\.sk-page \{[^}]*animation-delay: 200ms !important;/.test(rmBlock), 'the 200ms hold is kept under prefers-reduced-motion (the universal block zeroes delays; the hold is not motion)');
  assert(/DELIBERATE/.test(rmBlock) && /placeholder/.test(rmBlock), 'the reduced-motion override says why it is deliberate');
  assert(/floor is not motion either/.test(rmBlock), 'and says the same of the floor: a placeholder staying put');
  assert(/\.sk-page\.sk-cancelled \{\s*animation: none !important;\s*\}/.test(css), '.sk-page.sk-cancelled drops the hold animation, leaving the base opacity 0 (content beat the hold on a soft navigation)');
}

console.log('the numbers, once, in the clock');
{
  assert(/export const HOLD_MS = 200;/.test(clock), 'HOLD_MS is 200');
  assert(/export const FLOOR_MS = 300;/.test(clock), 'FLOOR_MS is 300');
  assert(/window\.__fydrSkeleton/.test(clock) && /window\.__fydrSkeleton/.test(skeleton), 'the clock and the inline script share the same window record');
  assert(/queueMicrotask/.test(clock), 'arrival is notified from a microtask, never from inside a render');
}

console.log('the held element records the appearance and never updates state');
{
  const src = stripComments(held);
  assert(/^'use client';/.test(held), 'SkHeld is a client component');
  assert(/addEventListener\('animationstart'/.test(src) && /animationName !== 'sk-appear'/.test(src), 'it records shownAt at the animationstart of sk-appear — the CSS is the clock');
  assert(/getAnimations\(\)/.test(src) && /currentTime/.test(src), 'and catches up from the running animation if the effect ran late');
  assert(/useLayoutEffect/.test(src), 'a layout effect, so the listener is attached before the first paint');
  assert(/classList\.add\('sk-cancelled'\)/.test(src) && /shownAt\(\) === undefined/.test(src), 'content that beat the hold adds sk-cancelled, only while still held');
  assert(!/useState|useReducer|useSyncExternalStore/.test(src), 'no state update in the held element: one would restart the render and cancel the throttled reveal (measured as a loop)');
  assert(/resetClock\(\)/.test(src), 'a new skeleton starts a new clock');
}

console.log('SkPage: the live region is outside the held element; the hard-load recorder is a parser-run script');
{
  const body = skeleton.slice(skeleton.indexOf('export function SkPage('));
  const live = body.indexOf('role="status"'); const heldAt = body.indexOf('<SkHeld>'); const script = body.indexOf('dangerouslySetInnerHTML={{ __html: SHOWN_SCRIPT }}');
  assert(live > 0 && heldAt > live && script > heldAt, 'order: live region, then <SkHeld>, then the script');
  assert(/aria-busy="true" aria-live="polite"/.test(body), 'the live region is role=status, aria-busy, polite');
  assert(/<span hidden dangerouslySetInnerHTML/.test(body), 'the script is the innerHTML of a hidden span (the parser runs it on a hard load; React never warns about a script it did not create)');
  const m = skeleton.match(/const SHOWN_SCRIPT =\n([\s\S]*?);\n/);
  const shown = m?.[1] ? ((0, eval)(m[1]) as string) : '';
  assert(shown.startsWith('<script>') && shown.endsWith('</script>'), 'SHOWN_SCRIPT is a whole <script>');
  assert(/s\.parentNode\.previousElementSibling/.test(shown) && /classList\.contains\('sk-page'\)/.test(shown), 'it finds the held element as the span\'s previous sibling and checks it is .sk-page');
  assert(/ev\.animationName!=='sk-appear'/.test(shown) && /ev\.target!==e/.test(shown), 'it listens for sk-appear on that element only (the shimmer bubbles up)');
  assert(/__fydrSkeleton=window\.__fydrSkeleton\|\|\{\}\)\.shownAt=t/.test(shown), 'it writes shownAt to the shared record');
  assert(/if\(typeof window\.\$RT==='undefined'\|\|\(typeof window\.\$RT==='number'&&window\.\$RT<t\)\)window\.\$RT=t/.test(shown), 'and sets React\'s reveal clock $RT to the appearance — only where it is absent or already a number, never backwards');
}

console.log('\nthe hard-load half\'s failure mode is boring (Isabella, 15 Sept): a flicker, never a crash or a skeleton that never clears');
{
  const m = skeleton.match(/const SHOWN_SCRIPT =\n([\s\S]*?);\n/);
  const shown = m?.[1] ? ((0, eval)(m[1]) as string) : '';
  assert(/^<script>\(function\(\)\{try\{/.test(shown) && /\}catch\(x\)\{\}\}\)\(\);<\/script>$/.test(shown), 'the whole script is in try/catch — nothing here can throw into the page');
  assert(/addEventListener\('animationstart',function\(ev\)\{try\{/.test(shown) && /\}catch\(x\)\{\}\}\);/.test(shown), 'and so is the listener');
  assert(!/typeof window\.\$RT!=='number'/.test(shown), 'a $RT that is anything but undefined or a number is left alone (a runtime that used the name differently is never clobbered)');
  assert(/setTimeout\(function\(\)\{try\{if\(window\.\$RT===t&&document\.body\.contains\(e\)\)delete window\.\$RT;\}catch\(x\)\{\}\},3000\);/.test(shown), 'the watchdog hands the clock back after 3s if nothing has revealed while our value still stands');
  const clockSrc = stripComments(clock);
  assert(/setTimeout\(resolve, floorRemaining\(\)\);/.test(clockSrc) && /Math\.max\(0, t \+ FLOOR_MS - now\)/.test(clockSrc), 'the soft half is bounded on its own: the floor promise resolves by setTimeout within FLOOR_MS');
  // The internal is pinned by version as well as by shape, so a patch
  // release moving it is a build failure with a name, not a runtime
  // surprise. Raise this after re-running the hard-load harness
  // (scratchpad sk-floor-hard.mjs: normal, MUTATE=ignore, MUTATE=function).
  const vendored = read('node_modules/next/dist/compiled/react-dom/cjs/react-dom-server.edge.production.js').match(/"(19\.[0-9.]+-canary-[a-z0-9-]+)"/)?.[1] ?? 'not found';
  assert(vendored === '19.3.0-canary-cbb046ab-20260731' && JSON.parse(read('node_modules/next/package.json')).version === '16.3.0', `the vendored react-dom (what ships) is 19.3.0-canary-cbb046ab-20260731 under next 16.3.0 (found ${vendored} / next ${JSON.parse(read('node_modules/next/package.json')).version}) — a new version means re-verifying the reveal clock's shape and the floor's degradation before raising this`);
  // Measured 15 Sept 2026 in the hard-load harness with the real runtime
  // text: normal → content at 230/320/450ms revealed at ~500ms (the floor);
  // MUTATE=ignore ($RC never reads $RT, a moved internal) → revealed at
  // 263/461ms, a 36ms flicker, no hang; MUTATE=function ($RT predefined as
  // a function) → the script leaves it, revealed at 244/462ms, no crash.
}

console.log('SkFloor: the content waits out the floor, or keeps the skeleton down when it beat the hold');
{
  const src = stripComments(floor);
  assert(/^'use client';/.test(floor), 'SkFloor is a client component');
  assert(/typeof window !== 'undefined'/.test(src), 'server render and hydration pass straight through');
  assert(/if \(shownAt\(\) === undefined\) \{[^}]*notifyArrival\(\);/.test(src), 'no skeleton shown yet → tell the held element (sk-cancelled)');
  assert(/else if \(floorRemaining\(\) > 0\) \{\s*use\(floorPromise\(\)\);/.test(src), 'shown and the floor unpaid → suspend on the floor promise (the same fallback stays)');
  assert(/useEffect\(\(\) => \{\s*resetClock\(\);\s*\}\);/.test(src), 'every commit clears the clock');
}

console.log('every route with a skeleton returns its awaited content through SkFloor');
{
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (name === 'loading.tsx') out.push(p);
    }
    return out;
  };
  // Six: the five skeletons and /login's splash still-frame, which is not a
  // skeleton (a held lockup, no .sk-page) and is outside this rule.
  const loadings = expectCount('loading.tsx files under src/app', walk('src/app'), 6);
  const skeletonRoutes = loadings.filter((p) => /\bSkPage\b/.test(read(p)));
  expectCount('loading.tsx files that render SkPage', skeletonRoutes, 5);
  assert(loadings.filter((p) => !skeletonRoutes.includes(p)).every((p) => !/sk-page|\bSk[A-Z]\w*/.test(read(p))), 'a loading.tsx that is not a skeleton uses nothing of the skeleton system');
  for (const l of skeletonRoutes) {
    const page = l.replace(/loading\.tsx$/, 'page.tsx');
    const src = existsSync(page) ? stripComments(read(page)) : '';
    const route = l.replace(/^src\/app/, '').replace(/\/loading\.tsx$/, '');
    assert(/import \{ SkFloor \} from '@\/components\/Skeleton\/SkFloor';/.test(src), `${route}: page.tsx imports SkFloor`);
    assert(/export default async function \w+\([^)]*\) \{\s*return \(\s*<SkFloor>\s*\{await \w+Content\((?:\{ searchParams \}|props)\)\}\s*<\/SkFloor>\s*\);\s*\}/.test(src), `${route}: the default export returns {await …Content(…)} inside <SkFloor> — awaited, so SkFloor renders when the content is ready, not before`);
  }
  // And nothing else uses SkFloor: it is the skeleton routes' wrapper, not a general one.
  const users: string[] = [];
  const walkAll = (dir: string): void => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walkAll(p); else if (/\.tsx?$/.test(name) && /Skeleton\/SkFloor'/.test(read(p))) users.push(p); } };
  walkAll('src/app');
  expectCount('files under src/app importing SkFloor', users, 5);
}

console.log('the streaming runtime still has the reveal clock the hard-load half sets');
{
  const dir = 'node_modules/next/dist/compiled/react-dom/cjs';
  const builds = expectCount('react-dom streaming server builds (Next\'s vendored copy, the one that ships)', readdirSync(dir).filter((f) => /^react-dom-server\.[a-z]+\.production\.js$/.test(f)), 4);
  for (const f of builds) {
    const src = read(join(dir, f));
    assert(src.includes('"number"!==typeof $RT?requestAnimationFrame($RV.bind(null,$RB))') && src.includes('$RT+300-a') && src.includes('$RV=function(a){$RT=performance.now()'), `${f}: $RC schedules the reveal at $RT + 300ms when $RT is a number, and $RV moves $RT on — the shape SHOWN_SCRIPT relies on`);
  }
}

console.log('the design system says what is built');
{
  const ds = read('docs/06-design-system.md');
  const s121 = ds.slice(ds.indexOf('### 12.1 Loading'), ds.indexOf('### 12.2'));
  assert(/\| Delay \| \*\*200 ms\*\*/.test(s121), '§12.1 delay row: 200 ms');
  assert(/\| Minimum display \| \*\*300 ms\*\*/.test(s121) && !/not built/.test(s121), '§12.1 minimum-display row: 300 ms, built');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
