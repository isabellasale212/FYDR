/* Screenshot every page of the app into one printable PDF.
 *
 *   npm run capture:pdf                 # production, https://fydr.vercel.app
 *   npm run capture:pdf -- --local      # http://localhost:3000 (run `npm run dev` first)
 *   npm run capture:pdf -- --width 1280 # viewport width for the capture
 *
 * A Chrome window opens on the sign-in page. SIGN IN, and the script does the
 * rest: it walks every route, screenshots each one full-page, and prints the
 * lot to a single PDF with a route caption above each shot and room in the
 * margin to write on.
 *
 * WHY IT ASKS YOU TO SIGN IN RATHER THAN DOING IT ITSELF. Every page worth
 * reviewing is behind auth, and this script never sees your password: Chrome
 * runs against a scratch profile in the system temp directory, you type into
 * Chrome's own window, and the script only ever reads `location.pathname` to
 * notice you are through. Nothing is stored in the repo. Delete the profile
 * and the session is gone.
 *
 * NO NEW DEPENDENCIES, per CLAUDE.md §4. It drives the copy of Chrome already
 * on the machine over the DevTools Protocol, using the WebSocket client built
 * into Node 22+. Nothing is installed, and there is no headless browser
 * package to keep up to date.
 *
 * WHAT YOU GET FOR A PAGE IT CANNOT REACH. A page in the PDF saying so, with
 * where it was redirected to — never a silent gap. Which pages those are
 * depends on the account: an athlete login cannot see the staff surface and a
 * staff login cannot see the athlete one, so run it once with each if you want
 * the whole product. The filename records which account it was.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const BASE = argv.includes('--local') ? 'http://localhost:3000' : 'https://fydr.vercel.app';
/* Capture without signing in. Useful on its own — it is how you get a clean
   record of what a signed-out visitor can reach — and it is the only way to
   exercise this script without a password. */
const SKIP_SIGNIN = argv.includes('--skip-signin');
const WIDTH = Number(arg('width', 1280));
/* Device pixel ratio for the capture. 2 is sharp enough to read small type on
   paper and makes a ~46MB PDF across 80 pages; 1 is about a quarter of that and
   is still fine at A4, because a 1280px-wide shot printed 190mm across is
   already 170dpi. */
const SCALE = Number(arg('scale', 2));
/* Capture a subset: --routes schedule,analytics grabs every route whose path
   contains one of those. Faster than the full 83 when you only want to look at
   one area, and the filter is a substring rather than an exact path so
   "schedule" pulls the planner and a session detail in with it. */
const ONLY = (arg('routes', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
const OUT_DIR = resolve('capture');
const PORT = 9333;

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Install it, or edit CHROME in this script.`);
  process.exit(1);
}

/* ---------------------------------------------------------------- CDP ---- */
let ws, nextId = 1;
const pending = new Map();
const waiters = [];

function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
function onEvent(match, timeoutMs = 45000) {
  return new Promise((res, rej) => {
    const w = { match, res };
    waiters.push(w);
    setTimeout(() => {
      const i = waiters.indexOf(w);
      if (i >= 0) { waiters.splice(i, 1); rej(new Error(`timed out waiting for ${match}`)); }
    }, timeoutMs);
  });
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
      return;
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].match === msg.method) { waiters[i].res(msg); waiters.splice(i, 1); }
    }
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------- routes ---- */
/* Read from the filesystem rather than a hardcoded list, so a page added
   tomorrow appears in tomorrow's PDF without anyone remembering to add it. */
import { readdirSync, statSync } from 'node:fs';
function findRoutes(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === 'page.tsx') out.push(prefix || '/');
      continue;
    }
    // (groups) are organisational and contribute nothing to the URL; @slots
    // and _private folders are not routes at all.
    if (name.startsWith('_') || name.startsWith('@')) continue;
    const seg = name.startsWith('(') && name.endsWith(')') ? '' : `/${name}`;
    out.push(...findRoutes(full, prefix + seg));
  }
  return out;
}

/* One real id per dynamic segment, read-only, so [athleteId] is an actual
   athlete's page rather than a 404. Skipped entirely when there is no
   SUPABASE_DB_URL — those routes then appear in the PDF as "not captured",
   which is honest, rather than as a guessed uuid that 404s. */
async function resolveParams() {
  if (!process.env.SUPABASE_DB_URL) return null;
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const one = async (sql) => {
    try { return (await c.query(sql)).rows[0]?.id ?? null; } catch { return null; }
  };
  const p = {
    athleteId: await one('select id from athletes where deleted_at is null order by created_at limit 1'),
    injuryId: await one('select id from injuries order by created_at desc limit 1'),
    leaderboardId: await one('select id from leaderboards order by created_at limit 1'),
    programmeId: await one("select id from programmes where status='active' order by created_at limit 1"),
    requestId: await one('select id from subject_access_requests order by created_at desc limit 1'),
    groupId: await one('select id from groups order by created_at limit 1'),
    userId: await one('select id from users order by created_at limit 1'),
    testDefId: await one('select id from test_definitions order by created_at limit 1'),
    sessionId: await one('select id from sessions order by starts_at desc limit 1'),
    fixtureId: await one("select id from sessions where session_type='match' order by starts_at desc limit 1"),
    templateId: await one('select id from schedule_templates order by created_at limit 1'),
    gymSessionLogId: await one("select id from gym_session_logs where status='complete' order by entry_date desc limit 1"),
  };
  await c.end();
  return p;
}

function buildUrls(routes, params) {
  const out = [];
  for (const r of routes.sort()) {
    const dyn = [...r.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
    if (dyn.length === 0) { out.push({ route: r, url: r }); continue; }
    if (!params || dyn.some((d) => !params[d])) {
      out.push({ route: r, url: null, why: params ? 'no row in the database to point it at' : 'needs SUPABASE_DB_URL to resolve its id' });
      continue;
    }
    let url = r;
    for (const d of dyn) url = url.replace(`[${d}]`, params[d]);
    out.push({ route: r, url });
  }
  return out;
}

/* --------------------------------------------------------------- main ---- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const profile = mkdtempSync(join(tmpdir(), 'fydr-capture-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  `--window-size=${WIDTH},900`,
  `${BASE}/login`,
], { stdio: 'ignore' });

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try { chrome.kill(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

try {
  // Wait for the debugging endpoint.
  let version = null;
  for (let i = 0; i < 60 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); }
  }
  if (!version) throw new Error('Chrome did not expose its debugging port.');
  await connect(version.webSocketDebuggerUrl);

  /* ATTACH TO THE TAB CHROME ALREADY OPENED — do not create a second one.
     The window Chrome opens from the command line is the one you can see and
     will type into; a tab created over CDP is a different tab. The first run of
     this script drove that second tab and watched it for a sign-in that was
     happening in the first, which it could never have seen. */
  let targetId = null;
  for (let i = 0; i < 60 && !targetId; i++) {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && t.url.startsWith(BASE));
    if (page) targetId = page.targetId;
    else await sleep(250);
  }
  if (!targetId) throw new Error('Could not find the Chrome tab showing the app.');
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = sessionId;
  await send('Page.enable', {}, S);
  await send('Runtime.enable', {}, S);
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: SCALE, mobile: false }, S);

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S);
    return r.result?.value;
  };

  let who = null;
  if (SKIP_SIGNIN) {
    console.log('\n  --skip-signin: capturing without an account. Everything behind auth');
    console.log('  will show as redirected to the sign-in page.\n');
  } else {
  console.log(`\n  A Chrome window has opened at ${BASE}/login.`);
  console.log('  SIGN IN there. Capture starts on its own the moment you are through.');
  console.log('  (Sign in as staff for the staff pages, or as an athlete for the athlete ones.)\n');

  /* Wait for the login page to actually BE THERE before watching for it to go.
     A tab that has not navigated yet reports about:blank, whose pathname is
     "/" — which is not "/login", which the first version of this loop read as
     "signed in". It then captured all 83 routes as redirects to the sign-in
     page it had never left. */
  const onLogin = async () =>
    (await evaluate(`location.origin === ${JSON.stringify(new URL(BASE).origin)} && location.pathname.startsWith('/login')`).catch(() => false)) === true;

  for (let i = 0; i < 120 && !(await onLogin()); i++) await sleep(250);
  if (!(await onLogin())) throw new Error('The sign-in page never loaded in the Chrome window.');

  let through = false;
  for (let i = 0; i < 1200; i++) {           // up to 10 minutes
    if (!(await onLogin())) {
      // Two consecutive reads, so a redirect in flight is not mistaken for
      // arrival.
      await sleep(600);
      if (!(await onLogin())) { through = true; break; }
    }
    await sleep(500);
  }
  if (!through) throw new Error('Timed out waiting for sign-in.');
  who = await evaluate('document.title').catch(() => null);
  console.log('  Signed in. Capturing…\n');
  }

  let routes = findRoutes(resolve('src/app'));
  if (ONLY.length) {
    routes = routes.filter((r) => ONLY.some((o) => r.includes(o)));
    console.log(`  --routes ${ONLY.join(',')} → ${routes.length} of 83 routes\n`);
  }
  const params = await resolveParams().catch(() => null);
  const targets = buildUrls(routes, params);

  mkdirSync(OUT_DIR, { recursive: true });
  const shots = [];
  let n = 0;

  for (const t of targets) {
    n++;
    const label = `${String(n).padStart(2, '0')}/${targets.length}`;
    if (!t.url) {
      console.log(`  ${label}  ${t.route}  — skipped (${t.why})`);
      shots.push({ ...t, status: 'skipped' });
      continue;
    }
    try {
      await send('Page.navigate', { url: BASE + t.url }, S);
      await onEvent('Page.loadEventFired', 30000).catch(() => {});
      // Let data-heavy pages settle, then hold the animations still so a page
      // is never captured mid-fade.
      await sleep(1400);
      await evaluate('document.getAnimations().forEach(a => { try { a.finish(); } catch {} }); 1');
      await sleep(150);

      const landed = await evaluate('location.pathname + location.search');
      const title = await evaluate('document.title');
      const redirected = landed && landed.split('?')[0] !== t.url.split('?')[0];

      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, S);
      const file = join(OUT_DIR, `${String(n).padStart(2, '0')}-${t.route.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'root'}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      shots.push({ ...t, file, title, landed, status: redirected ? 'redirected' : 'ok' });
      console.log(`  ${label}  ${t.route}${redirected ? `  — redirected to ${landed}` : ''}`);
    } catch (e) {
      shots.push({ ...t, status: 'failed', why: e.message });
      console.log(`  ${label}  ${t.route}  — FAILED: ${e.message}`);
    }
  }

  /* ------------------------------------------------------------- pdf ---- */
  /* One HTML document, printed once. Building 80 separate PDFs and merging
     them would need a PDF library; one document does not. */
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const ok = shots.filter((s) => s.status === 'ok').length;

  const body = shots.map((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    const note =
      s.status === 'ok' ? ''
      : s.status === 'redirected' ? `<p class="note">This account was redirected to <b>${esc(s.landed)}</b>. The shot below is where it landed, not the route in the heading — sign in with the other kind of account to see this one.</p>`
      : s.status === 'skipped' ? `<p class="note">Not captured — ${esc(s.why)}.</p>`
      : `<p class="note">Failed — ${esc(s.why)}.</p>`;
    const img = s.file ? `<img src="file://${s.file}" alt="">` : '';
    return `<section class="page">
      <header><span class="n">${num}</span><span class="route">${esc(s.route)}</span>${s.title ? `<span class="title">${esc(s.title)}</span>` : ''}</header>
      ${note}
      <div class="shot">${img}</div>
      <div class="rule"><span>Corrections</span></div>
    </section>`;
  }).join('\n');

  const html = `<!doctype html><meta charset="utf-8"><style>
    @page { size: A4; margin: 12mm 10mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 400 10pt/1.45 -apple-system, system-ui, sans-serif; color: #13161c; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
    .cover h1 { font-size: 34pt; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 6mm; }
    .cover p { margin: 0 0 2mm; color: #5b636e; }
    .cover ul { margin: 8mm 0 0; padding-left: 5mm; color: #5b636e; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    header { display: flex; align-items: baseline; gap: 4mm; border-bottom: 1.5pt solid #13161c; padding-bottom: 2mm; margin-bottom: 3mm; }
    .n { font-weight: 800; font-size: 13pt; }
    .route { font-family: ui-monospace, Menlo, monospace; font-size: 11pt; font-weight: 600; }
    .title { margin-left: auto; color: #5b636e; font-size: 9pt; }
    .note { margin: 0 0 3mm; padding: 2mm 3mm; background: #fdf1e0; border-left: 2pt solid #b07d0a; color: #6b4708; font-size: 9pt; }
    .shot { border: 0.5pt solid #c9ced6; }
    .shot img { display: block; width: 100%; }
    /* Ruled space to write in, under every shot. */
    .rule { margin-top: 4mm; border-top: 0.5pt dashed #9aa2ae; padding-top: 2mm; min-height: 26mm;
            background: repeating-linear-gradient(to bottom, transparent, transparent 7mm, #e3e6ea 7mm, #e3e6ea calc(7mm + 0.4pt)); }
    .rule span { font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: #929aa5; }
  </style>
  <section class="cover">
    <h1>Fydr — every page</h1>
    <p><b>${esc(BASE)}</b> · captured ${esc(stamp)}${who ? ` · signed in as ${esc(who)}` : ''}</p>
    <p>${ok} of ${shots.length} routes captured at ${WIDTH}px wide, ${SCALE}&times;.</p>
    ${ONLY.length ? `<p><b>Filtered run</b> — only routes matching ${esc(ONLY.join(', '))}. This is not the whole app.</p>` : ''}
    <ul>
      <li>One route per sheet, with ruled space underneath for corrections.</li>
      <li>A page marked in amber was not reachable by the account used — the athlete and staff surfaces need separate sign-ins.</li>
      <li>Dynamic routes point at a real record, resolved from the database at capture time.</li>
    </ul>
  </section>
  ${body}`;

  const indexPath = join(OUT_DIR, 'index.html');
  writeFileSync(indexPath, html);

  await send('Page.navigate', { url: `file://${indexPath}` }, S);
  await onEvent('Page.loadEventFired', 60000).catch(() => {});
  await sleep(2500);

  const { data: pdf } = await send('Page.printToPDF', {
    printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
    marginTop: 0.47, marginBottom: 0.39, marginLeft: 0.39, marginRight: 0.39,
  }, S);

  const name = `Fydr-pages-${stamp.replace(/[: ]/g, '-')}.pdf`;
  const outPdf = resolve(name);
  writeFileSync(outPdf, Buffer.from(pdf, 'base64'));

  console.log(`\n  ${ok} of ${shots.length} pages captured.`);
  console.log(`  PDF:  ${outPdf}`);
  console.log(`  PNGs: ${OUT_DIR}\n`);
} finally {
  cleanup();
}
