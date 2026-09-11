#!/usr/bin/env node
/* C-i — the primary action of every athlete write form is inside the viewport
 * at 375×812 and 375×667, at the top of the page and at every scroll position.
 * §0s asked for exactly this: "a render test that loads /check-in at 375×812
 * and asserts the submit button is within the viewport".
 *
 * WHY THIS IS NOT IN PREBUILD. The claim is about LAYOUT — where a sticky
 * footer resolves — and only a layout engine can answer it. Every prebuild
 * guard is a source read that runs on a build machine with no browser, and the
 * repo has no DOM-with-layout dependency (jsdom does not lay out; nothing here
 * adds Playwright to find out). So this drives the Chrome already on the
 * machine over the DevTools Protocol — the same client scripts/capture-app-pdf.mjs
 * uses, no new dependency — against the running app. Run it locally before a
 * handover; scripts/test-ath-adult-03.ts pins everything a source read can.
 *
 * USAGE
 *   BASE=http://127.0.0.1:3001 SIGN_IN_URL='<the app's own /auth/confirm?token_hash=… link>' \
 *   RPE_SESSION_ID=<an unrated session id> OUT=/path/for/screenshots \
 *   node scripts/test-ath-adult-03-render.mjs
 *
 *   BASE            loopback only — this never runs against production.
 *   SIGN_IN_URL     optional. A confirm link minted for a SCRATCH fixture
 *                   athlete through the scratch-guarded helper (the same
 *                   /auth/confirm?token_hash=… route every invite, reset and
 *                   magic link takes). No password is ever typed anywhere.
 *                   Omit it to reuse an already signed-in profile via
 *                   PROFILE=<dir>.
 *   RPE_SESSION_ID  optional. Adds /rpe/<id>; without it that form is skipped
 *                   and said so.
 *   OUT             optional. Directory for one screenshot per measured state.
 *
 * WHAT IT ASSERTS, per form, per viewport:
 *   - `.subm` computes to position: sticky
 *   - the submit button's box is wholly inside the viewport at scroll 0
 *   - and still is after scrolling to the middle and to the end of the page
 *   - the count line (`.subm-count`, where the form has one) is inside too —
 *     it is the flow's only completion signal and §0s found it off-screen
 *   - the blocked button is aria-disabled and NOT `disabled` (A2)
 * A form that is not rendered (today's check-in already submitted, a rated
 * session, a signed-out redirect) fails with a message that says which, and
 * how to fix the fixture, rather than passing on an empty page.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.BASE ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const SIGN_IN_URL = process.env.SIGN_IN_URL ?? null;
const RPE_SESSION_ID = process.env.RPE_SESSION_ID ?? null;
const OUT = process.env.OUT ?? null;
const PROFILE = process.env.PROFILE ?? null;
const PORT = 9334;
const VIEWPORTS = [[375, 812], [375, 667]];

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error(`BASE must be a loopback address (got ${BASE}). This test never runs against production.`);
  process.exit(2);
}
if (SIGN_IN_URL && !SIGN_IN_URL.startsWith(`${BASE}/auth/confirm?token_hash=`)) {
  console.error('SIGN_IN_URL must be the app\'s own /auth/confirm?token_hash=… link on BASE.');
  process.exit(2);
}
if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME=<path>.`);
  process.exit(2);
}
if (OUT) mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
const assert = (cond, label) => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- CDP ---- */
let ws, nextId = 1;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function connect(url) {
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
}

const profile = PROFILE ?? mkdtempSync(join(tmpdir(), 'fydr-render-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=375,812',
  'about:blank',
], { stdio: 'ignore' });
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try { chrome.kill(); } catch {}
  if (!PROFILE) { try { rmSync(profile, { recursive: true, force: true }); } catch {} }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

try {
  let version = null;
  for (let i = 0; i < 60 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); }
  }
  if (!version) throw new Error('Chrome did not expose its debugging port.');
  await connect(version.webSocketDebuggerUrl);
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const { sessionId: S } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  await send('Page.enable', {}, S);
  await send('Runtime.enable', {}, S);

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'evaluate failed');
    return r.result?.value;
  };
  const goto = async (url) => {
    await send('Page.navigate', { url }, S);
    /* Settle: wait for the document to be complete and the URL to stop moving
       (the confirm route 303s, and the app router hydrates after load). */
    let last = null;
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      const state = await evaluate('JSON.stringify({ rs: document.readyState, href: location.href })');
      if (state === last && JSON.parse(state).rs === 'complete') break;
      last = state;
    }
  };
  const shot = async (name) => {
    if (!OUT) return;
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, S);
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }, S);

  if (SIGN_IN_URL) {
    console.log('signing in through the app\'s own confirm route');
    await goto(SIGN_IN_URL);
    /* Judged on BASE, not on where the confirm route sent us: in `next dev`
       that route redirects to request.url's origin, which reports `localhost`
       even when the app was reached as 127.0.0.1 — a different cookie jar, so
       the landing page there is /login although the session cookie was set
       for BASE. Going back to BASE is what a real link never has to do. */
    await goto(`${BASE}/today`);
    const where = await evaluate('location.pathname');
    assert(!/^\/login/.test(where), `signed in: ${BASE}${where} is not /login`);
    if (/^\/login/.test(where)) throw new Error('sign-in failed; mint a fresh link and try again');
  }

  const routes = [
    { path: '/check-in', name: 'check-in', count: true, blockedAtStart: true },
    { path: '/nutrition-check-in', name: 'nutrition-check-in', count: true, blockedAtStart: true },
    { path: '/report-problem', name: 'report-problem', count: false, blockedAtStart: true },
  ];
  if (RPE_SESSION_ID) routes.push({ path: `/rpe/${RPE_SESSION_ID}`, name: 'rpe', count: true, blockedAtStart: true });
  else console.log('\n(no RPE_SESSION_ID — /rpe/[sessionId] skipped; pass an unrated session id to include it)');

  const MEASURE = `(() => {
    const subm = document.querySelector('.subm');
    const btn = document.querySelector('.subm button[type="submit"]');
    if (!subm || !btn) return { missing: true, path: location.pathname, title: document.title, text: document.body.innerText.slice(0, 160).replace(/\\s+/g, ' ') };
    const r = btn.getBoundingClientRect();
    const c = document.querySelector('.subm-count');
    const cr = c ? c.getBoundingClientRect() : null;
    return {
      path: location.pathname, vh: innerHeight, scrollY, docH: document.documentElement.scrollHeight,
      position: getComputedStyle(subm).position,
      top: r.top, bottom: r.bottom,
      countTop: cr ? cr.top : null, countBottom: cr ? cr.bottom : null, count: c ? c.textContent : null,
      ariaDisabled: btn.getAttribute('aria-disabled'), disabled: btn.disabled, cls: btn.className, label: btn.textContent,
    };
  })()`;

  for (const route of routes) {
    for (const [w, h] of VIEWPORTS) {
      console.log(`\n${route.path} at ${w}×${h}`);
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }, S);
      await goto(`${BASE}${route.path}`);
      const first = await evaluate(MEASURE);
      if (first.missing) {
        failed += 1;
        const hint = /^\/login/.test(first.path)
          ? 'redirected to /login — pass SIGN_IN_URL, or PROFILE of a signed-in profile'
          : /Already submitted/.test(first.text) ? 'today\'s check-in is already submitted for this athlete — use a fixture who has not, or retire the entry on scratch'
          : /already|rated/i.test(first.text) ? 'this form is not offered to this athlete right now — see the page text'
          : 'no .subm button on the page';
        console.log(`  FAIL - ${route.path}: no form rendered (${hint}). Page says: "${first.text}"`);
        await shot(`${route.name}-${h}-missing`);
        continue;
      }
      const within = (m) => m.top >= 0 && m.bottom <= m.vh;
      assert(first.position === 'sticky', `.subm computes to position: sticky (got ${first.position})`);
      assert(within(first), `at scroll 0 the submit button is inside the viewport: top ${Math.round(first.top)}, bottom ${Math.round(first.bottom)} of ${first.vh} (document ${first.docH}px tall)`);
      if (route.count) {
        assert(first.count !== null && first.countTop >= 0 && first.countBottom <= first.vh, `and so is the count line "${first.count}"`);
      }
      if (route.blockedAtStart) {
        assert(first.ariaDisabled === 'true' && first.disabled === false && /btn-ghost/.test(first.cls), `blocked at the start: aria-disabled, not disabled, wearing .btn-ghost ("${first.label}")`);
      }
      await shot(`${route.name}-${h}-top`);
      if (first.docH > first.vh) {
        for (const [where, expr] of [['the middle', 'Math.round((document.documentElement.scrollHeight - innerHeight) / 2)'], ['the end', 'document.documentElement.scrollHeight']]) {
          await evaluate(`window.scrollTo(0, ${expr}); 'ok'`);
          await sleep(150);
          const m = await evaluate(MEASURE);
          assert(within(m), `scrolled to ${where} (scrollY ${m.scrollY}): still inside — top ${Math.round(m.top)}, bottom ${Math.round(m.bottom)} of ${m.vh}`);
          await shot(`${route.name}-${h}-${where === 'the end' ? 'end' : 'mid'}`);
        }
      } else {
        console.log(`  (page is ${first.docH}px, no taller than the viewport — nothing to scroll)`);
      }
    }
  }
} catch (e) {
  failed += 1;
  console.error(`\n  ERROR - ${e.message}`);
} finally {
  cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
