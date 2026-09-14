/* The accessibility sweep's measuring tool (docs/queue-pending.md, "SECOND OF
 * THE TWO CLOSING PASSES"; Isabella, 13–15 September 2026).
 *
 * "Measure computed styles from the RENDERED DOM, not the stylesheet, and
 * measure contrast against the ACTUAL COMPOSITED background." This drives a
 * headless Chrome over CDP, signs in as ONE account through the app's own
 * /auth/confirm route (a scratch magic link the caller minted), opens every
 * route it is given at 1440 and 390, switches the theme in the page the way
 * ThemeToggle does (data-theme on <html>, the choice in localStorage), and
 * asks the rendered page three questions:
 *
 *   1. contrast — every element with its own text (and every placeholder):
 *      the computed colour, with the opacity chain applied, over the
 *      background composited up the ancestor chain (src-over, alpha
 *      respected; a gradient or image on the way is flagged as unmeasured),
 *      against WCAG 2.x AA — 4.5:1, or 3:1 for large text (≥ 24px, or
 *      ≥ 18.66px at weight ≥ 700), with the size and weight recorded so the
 *      3:1 claim can be checked;
 *   2. tap targets — every interactive element, aria-disabled INCLUDED (the
 *      BlockedButton pattern is still interactive and still in the tree),
 *      whose hit box is under 44px in either dimension. The hit box is the
 *      border box, widened by a wrapping <label> for a radio or checkbox and
 *      by an absolutely positioned ::before/::after (the nav-hit-floor fix's
 *      mechanism), which a bounding rect alone would miss. A link inside
 *      running text is recorded as such, because WCAG exempts it and the
 *      report has to say so rather than count it;
 *   3. colour-only candidates — small elements with a painted background or
 *      border and no text, label or title of their own (dots, swatches,
 *      bars), listed by class for the hand review the third class needs.
 *
 * It changes nothing. Output is one JSON file per run, which
 * scripts/a11y-sweep-report.mjs folds into the defect list. A screenshot per
 * route at 1440 light is kept for the colour-only review.
 *
 * First run 15 September 2026, stopped by Isabella after three roles because
 * the conformance pass runs first (docs/queue-pending.md, the order note);
 * the baseline it produced is docs/a11y-sweep-baseline-2026-09-15.md. The
 * sweep proper re-runs this, from the top, once conformance is committed.
 *
 * Run: SIGN_IN_URL=<magic link or a plain URL for anonymous surfaces> \
 *      ROLE=<label> ROUTES=/a,/b OUT=<file.json> SHOTS=<dir> node scripts/a11y-sweep.mjs
 * Scratch only: the link comes from the scratch project's service role.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://127.0.0.1:3001';
const { SIGN_IN_URL, ROLE, ROUTES, OUT, SHOTS } = process.env;
const PORT = Number(process.env.PORT ?? 9343);
if (!ROLE || !ROUTES || !OUT) { console.error('ROLE, ROUTES and OUT are required'); process.exit(1); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let ws, nextId = 1; const pending = new Map();
const send = (method, params = {}, sessionId) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'fydr-a11y-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);

/* The in-page audit, evaluated in the page as a string. */
const AUDIT = `(() => {
  const parse = (s) => { const m = s && s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => { const a = fg.a + bg.a * (1 - fg.a); if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a, g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a, b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a, a }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const rgb = (c) => 'rgb(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ')';
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sig = (el) => { let s = el.tagName.toLowerCase(); const cls = [...el.classList].filter((c) => !/^(is-|has-)/.test(c)).slice(0, 3).join('.'); if (cls) s += '.' + cls; for (const a of ['data-tone','data-status','data-kind','aria-pressed','aria-selected','aria-current','aria-disabled','role','type']) if (el.hasAttribute(a)) s += '[' + a + '=' + el.getAttribute(a) + ']'; return s; };
  const path = (el) => { const parts = []; let e = el; let depth = 0; while (e && e.nodeType === 1 && e !== document.body && depth < 4) { parts.unshift(sig(e)); e = e.parentElement; depth += 1; } return parts.join(' > '); };
  const ground = (el) => {
    const layers = []; let e = el.parentElement; let gradient = false;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e);
      /* A real gradient or image makes the ground unmeasurable here and is
         flagged. .app's rail strip — linear-gradient(--surf, --surf), one
         solid colour sized to the sidebar column — is not a gradient, and
         everything under it also sits on .sidebar's own solid fill. */
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/^linear-gradient\\((rgba?\\([^)]*\\)), \\1\\)$/.test(cs.backgroundImage)) gradient = true;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      e = e.parentElement;
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) out = over(layers[i], out);
    return { colour: out, gradient };
  };
  const selfGround = (el) => { const cs = getComputedStyle(el); const own = parse(cs.backgroundColor); const g = ground(el); if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/^linear-gradient\\((rgba?\\([^)]*\\)), \\1\\)$/.test(cs.backgroundImage)) g.gradient = true; return own && own.a > 0 ? { colour: over(own, g.colour), gradient: g.gradient } : g; };
  const opacityOf = (el) => { let o = 1; let e = el; while (e && e.nodeType === 1) { o *= parseFloat(getComputedStyle(e).opacity || '1'); e = e.parentElement; } return o; };
  const hiddenSubtree = (el) => { let e = el; while (e) { if (e.nodeType === 1 && (e.classList.contains('visually-hidden') || e.classList.contains('sr-only') || e.getAttribute('aria-hidden') === 'true')) return true; e = e.parentElement; } return false; };
  const textOf = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\\s+/g, ' ').trim();
  const isLarge = (size, weight) => size >= 24 || (size >= 18.66 && weight >= 700);

  const contrast = [];
  const record = (el, text, colour, g, kind) => {
    const cs = getComputedStyle(el);
    const fg0 = parse(colour); if (!fg0) return;
    const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10) || 400;
    const op = opacityOf(el);
    const fg = { ...fg0, a: fg0.a * op };
    const fgc = over(fg, g.colour);
    const r = ratio(fgc, g.colour);
    const large = isLarge(size, weight);
    const floor = large ? 3 : 4.5;
    if (r >= floor) return;
    contrast.push({ kind, path: path(el), text: text.slice(0, 48), ratio: Math.round(r * 100) / 100, floor, size: Math.round(size * 10) / 10, weight, large, fg: colour, fgEff: rgb(fgc), ground: rgb(g.colour), gradient: g.gradient, opacity: Math.round(op * 100) / 100, cls: [...el.classList].join(' '), tag: el.tagName.toLowerCase(), nativeDisabled: !!el.closest('[disabled],:disabled'), ariaDisabled: !!el.closest('[aria-disabled=true]') });
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NEXTJS-PORTAL') continue;
    if (!visible(el) || hiddenSubtree(el)) continue;
    const text = textOf(el);
    if (text) record(el, text, getComputedStyle(el).color, selfGround(el), 'text');
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.getAttribute('placeholder') && !el.value) {
      const pc = getComputedStyle(el, '::placeholder').color;
      record(el, '(placeholder) ' + el.getAttribute('placeholder'), pc, selfGround(el), 'placeholder');
    }
    if (el.tagName === 'SELECT' && el.selectedIndex >= 0) record(el, el.options[el.selectedIndex].text, getComputedStyle(el).color, selfGround(el), 'select');
  }

  const targets = [];
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=link],[role=menuitem],[role=option],[tabindex]:not([tabindex="-1"]),[aria-disabled=true]';
  const seen = new Set();
  for (const el of document.body.querySelectorAll(sel)) {
    if (seen.has(el) || !visible(el) || hiddenSubtree(el)) continue; seen.add(el);
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) { const lab = el.closest('label') || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')); if (lab && lab.parentElement && lab.parentElement.closest(sel)) continue; }
    let r = el.getBoundingClientRect(); let w = r.width, h = r.height, via = 'box';
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) { const lab = el.closest('label') || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')); if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width > w || lr.height > h) { w = Math.max(w, lr.width); h = Math.max(h, lr.height); via = 'label'; } } }
    for (const ps of ['::before', '::after']) { const p = getComputedStyle(el, ps); if (p.content !== 'none' && p.position === 'absolute') { const ph = parseFloat(p.height), pw = parseFloat(p.width); if (ph > h) { h = ph; via = ps; } if (pw > w) { w = pw; via = ps; } } }
    const min = Math.min(w, h);
    if (Math.round(min) >= 44) continue;
    const cs = getComputedStyle(el);
    const inlineInText = /^inline/.test(cs.display) && el.tagName === 'A' && !!el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    targets.push({ path: path(el), text: (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\\s+/g, ' ').trim().slice(0, 40), w: Math.round(w), h: Math.round(h), min: Math.round(min), via, tag: el.tagName.toLowerCase(), cls: [...el.classList].join(' '), ariaDisabled: el.getAttribute('aria-disabled') === 'true', nativeDisabled: el.hasAttribute('disabled'), inlineInText, type: el.getAttribute('type') || '', role: el.getAttribute('role') || '' });
  }

  const swatches = new Map();
  for (const el of document.body.querySelectorAll('span,i,b,div,em,svg,circle,rect')) {
    if (!visible(el) || hiddenSubtree(el)) continue;
    if ((el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.children.length > 0) continue;
    const r = el.getBoundingClientRect(); if (r.width > 28 || r.height > 28 || r.width < 3 || r.height < 3) continue;
    const cs = getComputedStyle(el); const bg = parse(cs.backgroundColor); const bc = parse(cs.borderTopColor); const fill = parse(cs.fill);
    const painted = (bg && bg.a > 0) || (bc && bc.a > 0 && parseFloat(cs.borderTopWidth) > 0) || (el.namespaceURI && el.namespaceURI.includes('svg') && fill && fill.a > 0);
    if (!painted) continue;
    const key = path(el);
    const cur = swatches.get(key) || { key, count: 0, parentText: '' };
    cur.count += 1; cur.parentText = (el.parentElement && el.parentElement.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
    swatches.set(key, cur);
  }
  return { contrast, targets, swatches: [...swatches.values()], title: document.title, h1: (document.querySelector('h1') || {}).textContent || '', url: location.href, theme: document.documentElement.getAttribute('data-theme') };
})()`;

try {
  let version = null;
  for (let i = 0; i < 60 && !version; i++) { try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); } };
  const { targetInfos } = await send('Target.getTargets');
  const page = targetInfos.find((t) => t.type === 'page');
  const { sessionId: S } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, S)).result?.value;
  const goto = async (url) => { await send('Page.navigate', { url }, S); let last = null; for (let i = 0; i < 80; i++) { await sleep(250); const st = await evaluate('JSON.stringify({rs:document.readyState,href:location.href})'); if (st === last && JSON.parse(st).rs === 'complete') break; last = st; } await sleep(700); };
  const shot = async (name) => { if (!SHOTS) return; await evaluate(`document.querySelectorAll('nextjs-portal').forEach((n) => n.remove()); 'ok'`); const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, S); writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64')); };
  if (SIGN_IN_URL) {
    await goto(SIGN_IN_URL);
    for (let i = 0; i < 4; i++) { const href = await evaluate('location.href'); if (!/\/login(\?|$)/.test(href)) break; await sleep(1500); await goto(SIGN_IN_URL); }
    /* Prove the session took before measuring anything: a sweep that silently
       measured the login page as every role would report a clean product. */
    await goto(`${BASE}${ROUTES.split(',')[0].trim()}`);
    const landed = await evaluate('location.pathname');
    if (/^\/login/.test(landed)) throw new Error(`sign-in did not take for ${ROLE}: landed on ${landed}`);
    process.stderr.write(`${ROLE} signed in → ${landed}\n`);
  }
  const results = [];
  const routes = ROUTES.split(',').map((r) => r.trim()).filter(Boolean);
  for (const route of routes) {
    for (const width of [1440, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: width === 390 }, S);
      await goto(`${BASE}${route}`);
      await evaluate(`document.querySelectorAll('nextjs-portal').forEach((n) => n.remove()); 'ok'`);
      for (const theme of ['light', 'dark']) {
        await evaluate(`try { localStorage.setItem('fydr-theme', '${theme}'); } catch {} document.documentElement.setAttribute('data-theme', '${theme}'); 'ok'`);
        await sleep(350);
        const audit = await evaluate(AUDIT);
        results.push({ role: ROLE, route, theme, width, ...(audit ?? { contrast: [], targets: [], swatches: [], title: '', h1: '', url: '' }) });
        process.stderr.write(`${ROLE} ${route} ${theme} ${width}: ${audit?.contrast.length ?? '?'} contrast, ${audit?.targets.length ?? '?'} targets → ${(audit?.url ?? '').replace(BASE, '')}\n`);
        if (width === 1440 && theme === 'light') await shot(route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root');
      }
    }
  }
  writeFileSync(OUT, JSON.stringify(results));
} catch (e) { console.error('ERROR', e.message); process.exitCode = 1; } finally { cleanup(); }
