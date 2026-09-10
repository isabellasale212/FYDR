/* Screenshot every documented walkthrough flow, step by step, into one PDF per
 * flow.
 *
 *   node scripts/capture-walkthroughs.mjs --section athlete-adult
 *   node scripts/capture-walkthroughs.mjs --section athlete-adult --only ATH-ADULT-03
 *   node scripts/capture-walkthroughs.mjs --section staff-coach --base http://localhost:3000
 *
 * WHAT IT IS FOR. docs/Fydr_-_Athlete_App_Walkthroughs.md and its staff twin
 * describe every flow step by step, quoting the exact control pressed. This
 * drives those steps against a running app and produces a PDF per flow, each
 * shot captioned with the doc's own wording, so a screenshot can be matched to
 * an exact step with no ambiguity.
 *
 * IT NEVER SEES A PASSWORD. Same contract as capture-app-pdf.mjs, which this
 * borrows its CDP driver from: a real Chrome window opens on the sign-in page,
 * a person signs in, and this only ever reads location.pathname to notice they
 * are through. The profile persists in ~/.fydr-walkthrough-profile so a batch
 * can be resumed, and each SECTION gets its own profile directory because a
 * section is one account.
 *
 * IT DEFAULTS TO SCRATCH, and refuses production unless --i-know explicitly
 * says otherwise. Most documented flows WRITE: creating a fixture puts it on
 * every athlete's Today screen, publishing pushes a week to real phones, and a
 * wellness entry is immutable once written. A screenshot is not worth any of
 * that on a real club's data.
 *
 * A STEP THAT CANNOT RUN IS RECORDED, never skipped. The PDF carries a page
 * saying what was expected and what was on screen instead, and the run's JSON
 * report names it. A gap with no explanation is the one outcome this must not
 * produce.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SECTION = arg('section', '');
const ONLY = (arg('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const BASE = arg('base', 'http://localhost:3000');
const WIDTH = Number(arg('width', 1280));
const SCALE = Number(arg('scale', 2));
const OUT_ROOT = resolve('docs/walkthrough-screenshots');
const PORT = 9334;

if (!SECTION) { console.error('  --section is required (e.g. athlete-adult)'); process.exit(1); }

/* The refusal that matters. A capture is never worth a real club's data. */
if (/asbxorjytxsvrzefwzqp|fydr\.app/.test(BASE) && !argv.includes('--i-know')) {
  console.error('\n  REFUSED: that base looks like production.\n');
  console.error('  Most documented flows write. Creating a fixture reaches every');
  console.error('  athlete\'s Today screen; a wellness entry cannot be deleted once');
  console.error('  written. Run against scratch, or pass --i-know deliberately.\n');
  process.exit(1);
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/* A section is normally one account, so the profile is keyed by section. But a
   handful of documented flows are one-shot per athlete per day — they consume
   the state they need — so capturing them a second time means a second athlete
   in the SAME section. --profile gives that run its own Chrome profile (and so
   its own sign-in) while the PDFs still land in the section's folder. */
const PROFILE = join(homedir(), `.fydr-walkthrough-profile-${arg('profile', SECTION)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ CDP --- */
let ws, nextId = 1, pending = new Map(), listeners = [];
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
function onEvent(match, timeoutMs = 45000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { listeners = listeners.filter((l) => l !== fn); rej(new Error(`timeout ${match}`)); }, timeoutMs);
    const fn = (m) => { if (m.method === match) { clearTimeout(t); listeners = listeners.filter((l) => l !== fn); res(m); } };
    listeners.push(fn);
  });
}
async function connect(url) {
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else listeners.slice().forEach((l) => l(m));
  };
}

/* --------------------------------------------------------------- driver --- */
/* Actions are expressed the way the DOCUMENT expresses them — "press the
 * control whose text is X" — rather than as CSS selectors, so a step in the PDF
 * and a step in the markdown cannot drift apart. */
const FIND = `(function(text, tag){
  const t = String(text).trim().toLowerCase();
  const els = [...document.querySelectorAll(tag || 'button, a, [role=button], label')];
  let el = els.find(e => (e.textContent||'').trim().toLowerCase() === t);
  if (!el) el = els.find(e => (e.textContent||'').trim().toLowerCase().includes(t));
  if (!el) el = els.find(e => (e.getAttribute('aria-label')||'').trim().toLowerCase() === t);
  /* An accessible name is often longer than the thing you can name it by: a
     schedule block reads "Captain's run, Training, 10:00 - 10:45". Matching a
     substring of it lets a flow name the session the way a person would. */
  if (!el) el = els.find(e => (e.getAttribute('aria-label')||'').trim().toLowerCase().includes(t));
  return el || null;
})`;

let S = null;
const evalIn = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S);
  return r.result?.value;
};

/** Poll a boolean expression until true, or give up. */
async function pollFor(expr, tries = 30, gap = 400) {
  for (let i = 0; i < tries; i++) {
    const v = await evalIn(expr).catch(() => false);
    if (v) return true;
    await sleep(gap);
  }
  return false;
}

async function shot() {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, S);
  return data;
}

/** One step's outcome. `ok:false` is recorded and rendered, never dropped. */
async function runStep(step) {
  const frames = [];
  const note = (t) => frames.push({ caption: t, img: null, missing: true });

  if (step.goto) {
    await send('Page.navigate', { url: BASE + step.goto }, S);
    await onEvent('Page.loadEventFired', 30000).catch(() => {});
    await sleep(step.settle ?? 1400);
  }

  /* WAIT FOR THE THING THE CAPTION CLAIMS, and fail loudly when it never comes.
     Without this a step that only navigates reports success whatever is on
     screen — the first run produced a PDF captioned "Already submitted" over a
     page that was still compiling, which is worse than a gap because it looks
     like evidence. It also fixes the cause: this is a dev server, Next compiles
     a route on first visit, and a fixed sleep screenshots the blank page. */
  if (step.expect) {
    const wanted = Array.isArray(step.expect) ? step.expect : [step.expect];
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) {
      seen = await evalIn(`(function(){
        const t = (document.body.innerText||'');
        const want = ${JSON.stringify(wanted)};
        return want.some(w => w.startsWith('@') ? !!document.querySelector(w.slice(1)) : t.includes(w));
      })()`).catch(() => false);
      if (!seen) await sleep(500);
    }
    if (!seen) {
      /* SAY WHAT WAS THERE, not only what was not. A failure reporting the
         absence alone sends you looking for the wrong thing — this is how the
         first run's /today failures read as a broken page when the page was
         fine and the assertion was at fault. */
      const actual = await evalIn(`(location.pathname + ' :: ' + (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 300))`).catch(() => '(could not read)');
      note(`${step.caption} — NOT CAPTURED: waited 20s and never saw ${wanted.map((w) => `"${w}"`).join(' or ')}. On screen instead: ${actual}`);
      console.log(`        on screen: ${actual}`);
      return { frames, ok: false, why: `expected ${wanted.join(' / ')} never appeared` };
    }
  }

  /* BEFORE, whenever the doc records a label changing — the whole point of the
     before/after pair is to show the label in both states. */
  if (step.captureBefore) frames.push({ caption: `${step.caption} — before`, img: await shot() });

  if (step.press) {
    /* WAIT FOR REACT TO OWN THE ELEMENT BEFORE CLICKING IT. The server-rendered
       HTML contains every control, so finding one proves nothing about whether
       pressing it does anything: before hydration the node is inert and click()
       is swallowed silently. The first write run pressed eleven buttons this
       way and reported eleven state changes that never happened — the page was
       right, the click was not. React tags a hydrated node with a
       `__reactProps$…` key, which is the exact signal. */
    const ready = await pollFor(`(function(){
      const el = (${FIND})(${JSON.stringify(step.press)}, ${JSON.stringify(step.tag || null)});
      if (!el) return false;
      return Object.keys(el).some(k => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'))
          || el.tagName === 'A';
    })()`, 30);
    if (!ready) {
      const seen = await evalIn(`(${FIND})(${JSON.stringify(step.press)}, ${JSON.stringify(step.tag || null)}) !== null`).catch(() => false);
      note(`${step.caption} — NOT ${seen ? 'INTERACTIVE' : 'FOUND'}: control "${step.press}" ${seen ? 'is on screen but never hydrated' : 'was never on screen'}`);
      return { frames, ok: false, why: `control "${step.press}" ${seen ? 'never became interactive' : 'not found'}` };
    }
    await evalIn(`(${FIND})(${JSON.stringify(step.press)}, ${JSON.stringify(step.tag || null)}).click()`);
    await sleep(step.settle ?? 900);
  }

  /* By CSS selector, for controls with no text of their own — a radio in a
     scale, a chip identified by position. Used sparingly: `press` quotes the
     document's own wording and is preferred wherever a control has text. */
  if (step.click) {
    await pollFor(`(function(){ const el=document.querySelector(${JSON.stringify(step.click)});
      return !!el && Object.keys(el).some(k => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$')); })()`, 30);
    const ok = await evalIn(`(function(){ const el=document.querySelector(${JSON.stringify(step.click)}); if(!el) return false; el.click(); return true; })()`);
    if (!ok) { note(`${step.caption} — NOT FOUND: ${step.click}`); return { frames, ok: false, why: `selector ${step.click} not found` }; }
    await sleep(step.settle ?? 500);
  }

  if (step.clickAll) {
    const n = await evalIn(`(function(){ const els=[...document.querySelectorAll(${JSON.stringify(step.clickAll)})]; els.forEach(e=>e.click()); return els.length; })()`);
    if (!n) { note(`${step.caption} — NOT FOUND: ${step.clickAll}`); return { frames, ok: false, why: `selector ${step.clickAll} matched nothing` }; }
    await sleep(step.settle ?? 700);
  }

  if (step.fill) {
    for (const [sel, value] of Object.entries(step.fill)) {
      const ok = await evalIn(`(function(){
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true; })()`);
      if (!ok) { note(`${step.caption} — NOT FOUND: field ${sel}`); return { frames, ok: false, why: `field ${sel} not found` }; }
    }
    await sleep(400);
  }

  /* THE POSTCONDITION, and the distinction that took a wasted run to see.
     `expect` is a PRE-condition — wait for the screen to be ready before
     acting. A step that presses a control and expects the label to change
     needs the opposite, and using `expect` for it meant the harness looked for
     the result before clicking, gave up, and never pressed the button at all.
     Eleven flows failed that way while the app was behaving correctly. */
  if (step.expectAfter) {
    const wanted = Array.isArray(step.expectAfter) ? step.expectAfter : [step.expectAfter];
    const seen = await pollFor(`(function(){
      const t = (document.body.innerText||'');
      const want = ${JSON.stringify(wanted)};
      return want.some(w => w.startsWith('@') ? !!document.querySelector(w.slice(1)) : t.includes(w));
    })()`, 40);
    if (!seen) {
      const actual = await evalIn(`(location.pathname + ' :: ' + (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 300))`).catch(() => '(could not read)');
      frames.push({ caption: step.caption, img: await shot() });
      note(`${step.caption} — the action ran but the expected change never appeared: wanted ${wanted.map((w) => `"${w}"`).join(' or ')}. On screen: ${actual}`);
      console.log(`        after action: ${actual}`);
      return { frames, ok: false, why: `after acting, ${wanted.join(' / ')} never appeared` };
    }
  }

  frames.push({ caption: step.caption, img: await shot() });
  return { frames, ok: true };
}

/* ------------------------------------------------------------------ PDF --- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function buildPdf(flow, frames, outPath) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const pages = frames.map((f, i) => `
    <section class="page">
      <header><span class="n">${i + 1}</span><span class="cap">${esc(f.caption)}</span>
        <span class="title">${esc(flow.id)}</span></header>
      ${f.missing
        ? `<p class="note"><b>Not captured.</b> ${esc(f.caption)}<br>This step is recorded rather than skipped: the control the document names was not on screen at this point.</p>`
        : `<div class="shot"><img src="data:image/png;base64,${f.img}"></div>`}
    </section>`).join('\n');

  const html = `<!doctype html><meta charset="utf-8">
  <style>
    @page { size: A4; margin: 12mm 10mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 400 10pt/1.45 -apple-system, system-ui, sans-serif; color: #13161c; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
    .cover h1 { font-size: 28pt; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 4mm; }
    .cover .id { font-family: ui-monospace, Menlo, monospace; font-size: 13pt; font-weight: 700; color: #5b636e; margin: 0 0 6mm; }
    .cover p { margin: 0 0 2mm; color: #5b636e; }
    .cover .entry { margin-top: 8mm; padding: 4mm; background: #f2f5fa; border-left: 2pt solid #13161c; color: #13161c; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    header { display: flex; align-items: baseline; gap: 4mm; border-bottom: 1.5pt solid #13161c; padding-bottom: 2mm; margin-bottom: 3mm; }
    .n { font-weight: 800; font-size: 13pt; }
    .cap { font-size: 10.5pt; font-weight: 600; }
    .title { margin-left: auto; font-family: ui-monospace, Menlo, monospace; color: #5b636e; font-size: 9pt; }
    .note { margin: 0; padding: 3mm; background: #fdf1e0; border-left: 2pt solid #b07d0a; color: #6b4708; font-size: 9.5pt; }
    .shot { border: 0.5pt solid #c9ced6; }
    .shot img { display: block; width: 100%; }
  </style>
  <section class="cover">
    <p class="id">${esc(flow.id)}</p>
    <h1>${esc(flow.name)}</h1>
    <p><b>${esc(BASE)}</b> · captured ${esc(stamp)} · signed in as ${esc(flow.account || SECTION)}</p>
    <p>${frames.filter((f) => !f.missing).length} of ${frames.length} steps captured at ${WIDTH}px, ${SCALE}&times;.</p>
    <div class="entry"><b>Entry point.</b> ${esc(flow.entry)}</div>
  </section>
  ${pages}`;

  /* Written to the OS temp dir, not into the output folder. It is a scratch
     file the PDF is printed from, and leaving it beside the deliverables meant
     it had to be gitignored separately. */
  const tmp = join(tmpdir(), `fydr-walkthrough-${flow.id}.html`);
  writeFileSync(tmp, html);
  await send('Page.navigate', { url: `file://${tmp}` }, S);
  await onEvent('Page.loadEventFired', 60000).catch(() => {});
  await sleep(1800);
  const { data } = await send('Page.printToPDF', {
    printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
    marginTop: 0.47, marginBottom: 0.39, marginLeft: 0.39, marginRight: 0.39,
  }, S);
  writeFileSync(outPath, Buffer.from(data, 'base64'));
}

/* ------------------------------------------------------------------ run --- */
const FLOWS = JSON.parse(readFileSync(resolve('scripts/walkthrough-flows.json'), 'utf8'));
const todo = FLOWS.filter((f) => f.section === SECTION && (!ONLY.length || ONLY.includes(f.id)));
if (!todo.length) { console.error(`  no flows for section ${SECTION}`); process.exit(1); }

mkdirSync(join(OUT_ROOT, SECTION), { recursive: true });
mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', `--window-size=${WIDTH},1000`, BASE + '/login',
], { stdio: 'ignore', detached: false });

process.on('exit', () => { try { chrome.kill(); } catch {} });

const report = [];
try {
  let list = null;
  for (let i = 0; i < 40 && !list; i++) {
    await sleep(500);
    list = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null);
  }
  if (!list) throw new Error('Chrome did not expose a debugging port');
  await connect(list.webSocketDebuggerUrl);

  const { targetInfos } = await send('Target.getTargets');
  const target = targetInfos.find((t) => t.type === 'page');
  const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  S = sessionId;
  await send('Page.enable', {}, S);
  await send('Runtime.enable', {}, S);
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: SCALE, mobile: false }, S);

  /* Wait for a human to sign in. Never types, never reads a password field. */
  console.log(`\n  Chrome is open at ${BASE}/login — sign in as the ${SECTION} account.`);
  console.log('  Waiting…\n');
  /* "NOT /login" IS NOT "SIGNED IN". Chrome's first tab is about:blank, whose
     pathname is "/", so that test passed instantly and the run began before
     anyone had typed anything — it announced "Signed in" while the first flow
     screenshotted the sign-in page. Require positive evidence instead: a real
     app path AND no sign-in form on screen. */
  /* ATH-ADULT-01 is the sign-in screen itself: there is no session to wait for,
     and waiting would deadlock on the very page being captured. */
  let signedIn = argv.includes('--signed-out');
  if (signedIn) console.log('  --signed-out: capturing the public sign-in screen, no session expected.\n');
  for (let i = 0; i < 600 && !signedIn; i++) {
    signedIn = await evalIn(`(function(){
      const p = location.pathname;
      if (p === '/' || p === '/login' || p.startsWith('/login/') || p === 'blank') return false;
      if (document.querySelector('input[type=password]')) return false;
      return (document.body.innerText || '').length > 200;
    })()`).catch(() => false);
    if (!signedIn) await sleep(1000);
  }
  /* The finally below exits 0, so a bare process.exit(1) here was swallowed and
     a run that never signed in looked like a clean one. Throw instead. */
  if (!signedIn) throw new Error('never saw a signed-in page — nothing was captured');
  const who = await evalIn(`(document.body.innerText.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/m) || [])[0] || null`);
  console.log(`  Signed in${who ? ` as ${who}` : ''}. Capturing ${todo.length} flow(s).\n`);

  for (const flow of todo) {
    const frames = [];
    let failed = null;
    for (const step of flow.steps) {
      const out = await runStep(step);
      frames.push(...out.frames);
      if (!out.ok) {
        /* STOP THE FLOW. Continuing past a failed step ran the remaining steps
           of a flow whose precondition had already failed — which submitted a
           real wellness entry from a run that had never signed in, consuming a
           one-shot state for nothing. A step that could not be reached means
           the ones after it are not the documented flow any more. */
        failed = out.why;
        break;
      }
    }
    const file = `${flow.id} - ${flow.name}.pdf`.replace(/[/\\]/g, '-');
    const out = join(OUT_ROOT, SECTION, file);

    /* NEVER REPLACE A BETTER CAPTURE WITH A WORSE ONE. Several documented
       flows are one-shot per athlete per day — submitting wellness, rating a
       session, the weekly check-in. Once captured they cannot be captured
       again, because the very state they depend on is what they consume. A
       second run of the batch found their preconditions gone, produced a
       partial PDF, and overwrote the good one. The data proved the first run
       had worked; the evidence of it had been destroyed by the second. */
    const captured = frames.filter((f) => !f.missing).length;
    const prev = existsSync(out) ? (JSON.parse(readFileSync(join(OUT_ROOT, SECTION, '_report.json'), 'utf8').toString() || '[]')
      .find((r) => r.id === flow.id)?.captured ?? 0) : -1;
    if (prev > captured) {
      console.log(`  keep  ${flow.id}  ${flow.name}  — kept the earlier ${prev}-step capture; this run got ${captured}`);
      report.push({ id: flow.id, name: flow.name, steps: frames.length, captured: prev,
                    issue: `this run captured only ${captured}; the earlier, better PDF was kept` });
      continue;
    }
    await buildPdf({ ...flow, account: who }, frames, out);
    report.push({ id: flow.id, name: flow.name, steps: frames.length,
                  captured: frames.filter((f) => !f.missing).length, issue: failed });
    console.log(`  ${failed ? 'PART' : ' ok '}  ${flow.id}  ${flow.name}${failed ? `  — ${failed}` : ''}`);
  }
} finally {
  /* MERGE, never replace. A --only run rewrote this file with just the flows it
     re-ran, so a batch of 38 became a report of 2 and the record of everything
     else was lost. The PDFs survived; the account of them did not. */
  const reportPath = join(OUT_ROOT, SECTION, '_report.json');
  let merged = [];
  try { merged = JSON.parse(readFileSync(reportPath, 'utf8')); } catch { merged = []; }
  for (const row of report) {
    const i = merged.findIndex((m) => m.id === row.id);
    if (i >= 0) merged[i] = row; else merged.push(row);
  }
  writeFileSync(reportPath, JSON.stringify(merged, null, 2));
  try { chrome.kill(); } catch {}
  console.log(`\n  PDFs: ${join(OUT_ROOT, SECTION)}\n`);
  process.exit(0);
}
