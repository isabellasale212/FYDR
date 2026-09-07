/* Corner radius, button treatment and typeface.
 *
 * THE DECISION THIS RECORDS. Asked whether radius and font should become
 * tokens or be replaced literally, the repo answered it: radius tokens already
 * existed (--r-pill, --r-tab, --r-field, --r-toggle) and 47 of the 58
 * interactive rules ignored them, carrying raw values instead. A literal
 * sweep would have edited 47 numbers and left nothing stopping a forty-eighth.
 * So the sweep happened AND the result is named — var(--r-control) — with
 * check-control-radius.ts failing the build on any raw radius under a control
 * selector.
 *
 * The font was already a variable, and still named after its family:
 * --font-sora. That is the same mistake one level up, and the reason this
 * change had to rewrite 62 references rather than one line. It is --font-sans
 * now, so the next family swap is the layout file alone.
 *
 * WHAT IS NOT ASSERTED HERE. That the app LOOKS right — that is a screenshot's
 * job, and one was taken. These are the claims a screenshot cannot make: that
 * no rule anywhere kept a pill, that the guard has teeth, and that the
 * tabular-nums requests are still in place after a swap that changed which
 * family renders every digit in the product.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findViolations } from './check-control-radius';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const CSS = 'src/styles/base.css';
const TOKENS = 'src/styles/tokens.css';
const LAYOUT = 'src/app/layout.tsx';
const css = read(CSS);
const rule = (name: string): string => {
  const i = css.indexOf(`${name} {`);
  return i === -1 ? '' : css.slice(i, css.indexOf('}', i));
};

console.log('one radius, named once');
{
  assert(/--r-control:\s*6px;/.test(read(TOKENS)), '--r-control is 6px in tokens.css');
  /* The legacy tokens keep their own values. Aliasing them to --r-control was
     the first attempt and it silently reshaped three progress bars, which is
     the opposite of a token keeping its meaning. */
  assert(/--r-pill:\s*20px;/.test(read(TOKENS)), '--r-pill still means 20px, and still shapes the progress bars');
  assert(
    !/border-radius:\s*var\(--r-(pill|field|tab|toggle)\)/.test(
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((m) => /btn|chip|\btab\b|segment|toggle|\bfield\b|input/i.test((m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')))
        .filter((m) => !/track|knob|bar\b/i.test(m[1] ?? ''))
        .map((m) => m[2])
        .join(''),
    ),
    'and no control reads a legacy radius token any more',
  );
  assert(/--r-card:\s*18px;/.test(read(TOKENS)), '--r-card is untouched — a card is not a control');
}

console.log('\nnothing clickable is pill-shaped any more');
{
  assert(findViolations(css).length === 0, 'no interactive rule sets its own radius');
  const pills = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => {
    const sel = (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const v = /border-radius:\s*([^;]+);/.exec(m[2] ?? '')?.[1]?.trim() ?? '';
    /* Switch tracks and knobs excluded by name — see SHAPED_ON_PURPOSE. */
    if (/track|knob|bar\b/i.test(sel)) return false;
    return /btn|chip|pill|\btab\b|segment|toggle/i.test(sel) && /^(999px|9999px|[2-9][0-9]px|[0-9]{3,}px)$/.test(v);
  });
  assert(pills.length === 0, `no control keeps a 20px+ or 999px radius (found ${pills.length})`);
  const pillReaders = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /border-radius:\s*var\(--r-pill\)/.test(m[2] ?? ''))
    .map((m) => (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim());
  assert(
    pillReaders.every((s) => /bar\b|track|fill/i.test(s)),
    `--r-pill is read only by bars now (${pillReaders.join(', ') || 'nothing'})`,
  );
}

console.log('\nthe guard has teeth');
{
  const dir = mkdtempSync(join(tmpdir(), 'fydr-radius-'));
  try {
    const guard = resolve('scripts/check-control-radius.ts');
    const run = (body: string): number => {
      const f = join(dir, 'probe.css');
      writeFileSync(f, body);
      try {
        execFileSync(process.execPath, ['--experimental-strip-types', guard, f], { stdio: 'pipe' });
        return 0;
      } catch (e) {
        return (e as { status?: number }).status ?? -1;
      }
    };
    assert(run('.btn-primary { border-radius: 20px; }') === 1, 'a 20px button fails');
    assert(run('.squad-chip { border-radius: 999px; }') === 1, 'a 999px chip fails');
    assert(run('.btn-primary { border-radius: 6px; }') === 1, 'even a RAW 6px fails — the value is not the point, the token is');
    assert(run('.btn-primary { border-radius: var(--r-control); }') === 0, 'the token passes');
    assert(run('.plan-switch-knob { border-radius: 50%; }') === 0, 'a knob is exempt by name, not by number');
    assert(run('.card { border-radius: 18px; }') === 0, 'and a card is not a control at all');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\nbuttons are crisp, not soft');
{
  const primary = rule('.btn-primary');
  assert(/background: var\(--accent\)/.test(primary), 'primary is a solid fill');
  assert(!/gradient/.test(primary), 'with no gradient');
  assert(!/box-shadow/.test(primary), 'and no glow');
  assert(!/transform/.test(rule('.btn-primary:active')), 'the press is not a scale — that springy shrink is gone');
  assert(/background: var\(--accent-border\)/.test(rule('.btn-primary:active')), 'it is a colour change instead');
  assert(/letter-spacing: -0\.01em/.test(primary), 'and the label carries tight tracking');

  const ghost = rule('.btn-ghost');
  assert(/border: 1px solid var\(--border\)/.test(ghost), 'ghost is a 1px solid border');
  assert(/background: none/.test(ghost), 'over a transparent fill');
  assert(!/box-shadow|blur/.test(ghost), 'with no elevation or blur');
  assert(/border-color/.test(rule('.btn-ghost:hover')), 'and hover moves the border, not the shadow');
}

console.log('\nstate changes are snappy');
{
  const t = read(TOKENS);
  const ms = (name: string): number => Number((new RegExp(`${name}:\\s*([0-9.]+)s`).exec(t) ?? [])[1] ?? 0) * 1000;
  assert(ms('--t-state') > 0 && ms('--t-state') <= 150, `--t-state is ${ms('--t-state')}ms, inside the 100–150ms band`);
  assert(ms('--t-press') > 0 && ms('--t-press') <= 150, `--t-press is ${ms('--t-press')}ms`);
}

console.log('\nthe typeface is Roboto, and the variable is not named after it');
{
  const l = read(LAYOUT);
  assert(/import \{ Roboto \} from 'next\/font\/google'/.test(l), 'Roboto is loaded through next/font/google');
  assert(!/\bSora\b(?![^*]*\*\/)/.test(l.replace(/\/\*[\s\S]*?\*\//g, '')), 'and Sora is gone from the code, kept only in the comment that explains the swap');
  for (const w of ['400', '500', '600', '700', '800']) {
    assert(new RegExp(`'${w}'`).test(l), `weight ${w} is requested`);
  }
  assert(/variable: '--font-sans'/.test(l), "the variable is --font-sans, not --font-roboto");

  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((e) => {
      const p = join(d, e);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(p) ? [p] : [];
    });
  const stragglers = walk('src').filter((p) => /var\(--font-sora\)/.test(read(p)));
  assert(stragglers.length === 0, `nothing still reads --font-sora (${stragglers.join(', ') || 'none'})`);
  assert(/font-family: var\(--font-sans\)/.test(css), 'and base.css sets the family from the new name');
}

console.log('\ntabular figures survived the swap');
{
  /* Roboto's digits are tabular by default — measured, delta 0 at 20px, with
     Georgia at delta 9.99 as the positive control. So these requests are no
     longer load-bearing, and they stay exactly because of that: they are what
     stops the NEXT font swap reintroducing drifting columns silently, the way
     this one nearly shipped a comment claiming a hazard it had not measured. */
  assert(/font-variant-numeric:\s*tabular-nums/.test(css), 'tabular-nums is still requested explicitly');
  const numRule = rule('.num');
  assert(/tabular-nums/.test(numRule), 'and .num — the class every numeric column uses — is where it is requested');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
