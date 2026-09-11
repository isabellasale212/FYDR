/* ATH-ADULT-03, the entry-form pattern — commit 2, built from the approved
 * final board (docs/designs/ath-adult-03-final/) on this system's tokens under
 * the decisions Isabella gave on 2026-09-11: no bottom sheet, the forms stay
 * pages; A1 and A2 on all four `.subm` forms; A3–A9, C-c, C-d, C-e on
 * /check-in only; helper ranges are the validator's own numbers.
 *
 * THE RULES THIS PINS, each with where it came from:
 *
 *   A1  The footer is a distinct block pinned to the viewport on a normally
 *       scrolling page — `position: sticky; bottom: 0` resolves against the
 *       document now that .phone-body is no longer a (dead) scroll pane
 *       (commit 1, C-g). The outstanding count is ITS OWN LINE at full
 *       --text, so it reads the same whether the action is live or blocked.
 *       Nothing in the footer is opacity-dimmed: the count used to sit inside
 *       a button dimmed twice and measured 1.24:1 (§0s).
 *   A2  A blocked action is aria-disabled and wears the kit secondary
 *       (.btn-ghost) — the treatment 01 built for Locked — never `disabled`
 *       and never --o-disabled. `disabled` is kept for the pending moment
 *       only, because a second submission is then genuinely impossible.
 *   A3  On the last answer the count becomes a good-tone chip.
 *   A4  Irreversibility is one line above the button; the reasoning sits
 *       behind "Why can't I edit it?" (C-d: a native disclosure holding the
 *       explanation the footer used to spell out in full).
 *   A5  Scale ends carry their numeral: "1 · Very sore", "5 · No soreness".
 *   A6  "Not answered" is neutral --muted, and the per-scale "X of 5" readout
 *       is gone — the footer count is the only "of N" on the screen.
 *   A7  The two disclosure fields have a field-error pattern: the field
 *       itself marked, a message beside it, helper text underneath.
 *   A9  Chosen option = accent fill + ring; unanswered = --surf2.
 *   C-c Sleep starts EMPTY ("–") and counts as a question: "0 of 6 answered".
 *   C-e An out-of-range heart rate or body mass blocks Submit with an inline
 *       error, and the footer reads "Fix one field to submit".
 *   B9  The helper text states the validator's ranges — 25 to 120 bpm, 30 to
 *       200 kg — from ONE config, so the copy cannot drift from the schema.
 *   D7  The nutrition footer copy is blocked by the board's addendum until
 *       the 3b board is final; its existing line stays.
 *
 * C-i, the render half — that the primary action is inside the viewport at
 * 375×812 — needs a layout engine, so it lives in
 * scripts/test-ath-adult-03-render.mjs and runs against the app locally.
 * This file pins everything a source read can.
 */
import { readFileSync } from 'node:fs';
import {
  BODY_MASS_RANGE,
  RESTING_HR_RANGE,
  WELLNESS_SCALES,
  WellnessEntryInput,
  fieldHelp,
  fieldProblem,
} from '@/lib/validation/wellness';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/&rsquo;/g, '’');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};
/** The opening tag that contains `marker`, scanned to its `>` at brace depth
 *  zero — a `[^>]*` regex stops at the `=>` of an inline handler. Whitespace
 *  collapsed so multi-line attributes can be matched as one string. */
const openingTag = (src: string, marker: string): string => {
  const at = src.indexOf(marker);
  if (at < 0) return '';
  const start = src.lastIndexOf('<', at);
  let depth = 0, i = start;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') depth -= 1;
    else if (src[i] === '>' && depth === 0) break;
  }
  return src.slice(start, i + 1).replace(/\s+/g, ' ');
};
const checkIn = strip(read('src/components/CheckInForm/CheckInForm.tsx'));
const rpe = strip(read('src/components/RpeForm/RpeForm.tsx'));
const nutrition = strip(read('src/components/NutritionCheckinForm/NutritionCheckinForm.tsx'));
const report = strip(read('src/components/ProblemReportForm/ProblemReportForm.tsx'));
const scaleInput = strip(read('src/components/ScaleInput/ScaleInput.tsx'));
const validation = strip(read('src/lib/validation/wellness.ts'));
const FORMS = { CheckInForm: checkIn, RpeForm: rpe, NutritionCheckinForm: nutrition, ProblemReportForm: report } as const;

console.log('A1. the footer is pinned to the viewport, on a normally scrolling page');
{
  const subm = rule('.subm');
  assert(subm !== '', '.subm exists');
  assert(/position:\s*sticky/.test(subm) && /bottom:\s*0/.test(subm), 'position: sticky; bottom: 0 — the document is the scroll context it resolves against');
  assert(!/overflow/.test(rule('.phone-body')) && !/overflow/.test(rule('.phone')), 'and no shell ancestor is a scroll container, so it can (commit 1, C-g)');
  assert(/env\(safe-area-inset-bottom/.test(subm), 'it carries the bottom safe-area inset — when pinned, the tab bar that normally carries it is off-screen');
  assert(/border-top:\s*1px solid var\(--border\)/.test(subm), '1px --border top');
  assert(/background:\s*var\(--surf\)/.test(subm), 'on --surf');
  assert(/box-shadow:\s*var\(--shadow\)/.test(subm), 'with --shadow (B5)');
  assert(/calc\(-1 \* var\(--sp-20\)\)/.test(subm) && /var\(--sp-20\)/.test(/padding:\s*([^;]+);/.exec(subm)?.[1] ?? ''), 'it bleeds to the shell edge — the negative inline margin undoes .phone-body\'s 20px gutter and the padding puts the button back on the content column');
  const inCard = rule('.card > .subm');
  assert(/--pad-card-x/.test(inCard) && /--pad-card-y/.test(inCard) && /border-end-start-radius:\s*var\(--r-card\)/.test(inCard) && /border-end-end-radius:\s*var\(--r-card\)/.test(inCard), 'inside a card (the report form) it bleeds to the card\'s edge instead and takes the card\'s two bottom corners, from the card token');
}

console.log('\nA1/A2. nothing in the footer is dimmed, and a blocked action is not `disabled`');
{
  const footerRules = [...css.matchAll(/(?:^|[}\n])\s*(\.subm[^{]*)\{([^}]*)\}/g)];
  assert(footerRules.length > 0, 'the footer rules exist');
  assert(footerRules.every((m) => !/opacity/.test(m[2]!) && !/--o-disabled/.test(m[2]!)), 'no .subm rule sets opacity or reads --o-disabled');
  assert(footerRules.every((m) => !/\[disabled\]/.test(m[1]!)), 'the `[disabled]` 35%-accent rule that compounded the dimming is gone');
  assert(footerRules.every((m) => !/rgb\(var\(--accent-rgb\) \/ 0\.35\)/.test(m[2]!)), 'and so is the 35% fill itself');
  const pending = rule('.subm .btn-primary:disabled');
  assert(/background:\s*var\(--accent\)/.test(pending) && /color:\s*var\(--on-accent\)/.test(pending), 'the pending button (the only `disabled` left) keeps its full accent fill and --on-accent label');
  for (const [name, src] of Object.entries(FORMS)) {
    const btn = openingTag(src, 'type="submit"');
    assert(btn !== '', `${name}: has a submit button`);
    assert(/className=\{blocked \? 'btn-ghost' : 'btn-primary'\}/.test(btn), `${name}: wears .btn-ghost while blocked and .btn-primary when live (A2, the Locked treatment from 01)`);
    assert(/aria-disabled=\{blocked \|\| undefined\}/.test(btn), `${name}: aria-disabled while blocked — focusable, announced with its label`);
    assert(/disabled=\{pending\}/.test(btn) || /disabled=\{[a-zA-Z.]*isPending\}/.test(btn), `${name}: \`disabled\` only for the pending moment`);
    assert(/onClick=\{\(event\) => \{ if \(blocked\) event\.preventDefault\(\); \}\}/.test(btn), `${name}: the press is refused at the control while blocked`);
    assert(/if \(blocked\) return;/.test(src), `${name}: and again in onSubmit, so Enter in a field does nothing either`);
  }
  for (const [name, src] of Object.entries(FORMS)) {
    const sticky = new RegExp(`\\.subm[^{]*\\{[^}]*position:\\s*sticky`).test(css);
    assert(sticky && /className="subm"/.test(src), `${name}: renders the shared footer`);
  }
}

console.log('\nA1/A3. the count is its own line, legible in every state, and a chip when complete');
{
  const count = rule('.subm-count');
  assert(/font-size:\s*var\(--fs-13\)/.test(count) && /font-weight:\s*700/.test(count) && /color:\s*var\(--text\)/.test(count), '.subm-count is --fs-13 / 700 / --text (B6)');
  const complete = rule('.subm-count[data-complete]');
  assert(/background:\s*var\(--wash-good\)/.test(complete) && /border:\s*1px solid var\(--border-good\)/.test(complete), 'complete: --wash-good fill with --border-good — the 01/02 banner pair');
  assert(/border-radius:\s*var\(--r-control\)/.test(complete) && /padding:\s*var\(--sp-4\) var\(--sp-8\)/.test(complete), 'at --r-control, padding --sp-4 --sp-8 (B2, B7)');
  assert(/countText/.test(checkIn) && /className="subm-count"/.test(checkIn) && /data-complete=\{blocked \? undefined : ''\}/.test(checkIn), 'CheckInForm renders it and flips the chip when nothing blocks');
  assert(/`\$\{answered\} of \$\{TOTAL_QUESTIONS\} answered · \$\{remaining\} to go`/.test(checkIn), '"N of 6 answered · M to go" while incomplete');
  assert(/'All six answered'/.test(checkIn), '"All six answered" when complete (board copy)');
  assert(/className="subm-count"/.test(rpe) && /'0 of 1 answered · 1 to go'/.test(rpe) && /'Answered'/.test(rpe), 'RpeForm: "0 of 1 answered · 1 to go" → "Answered"');
  assert(/className="subm-count"/.test(nutrition) && /'0 of 1 answered · 1 to go'/.test(nutrition) && /'Answered'/.test(nutrition), 'NutritionCheckinForm: the same, for its one question');
  assert(!/subm-count/.test(report), 'ProblemReportForm has no count line — it has no questions to count; its character counter already says what state it is in');
  assert(!/to go`/.test(/<button[\s\S]*?<\/button>/.exec(checkIn)?.[0] ?? ''), 'and the count no longer lives inside the button label');
}

console.log('\nthe contrast, measured from tokens.css in both themes');
{
  const tokens = read('src/styles/tokens.css');
  const block = (start: string, end: string): string => tokens.slice(tokens.indexOf(start), tokens.indexOf(end, tokens.indexOf(start)));
  const light = block(":root[data-theme='light'] {", '.dark-tokens,');
  const dark = block(":root[data-theme='dark'] {", '@media (prefers-color-scheme: dark)');
  const base = tokens.slice(0, tokens.indexOf(':root,'));
  type RGB = [number, number, number];
  const hex = (src: string, name: string): RGB => {
    const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(src) ?? new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(base);
    if (!m) throw new Error(`no ${name}`);
    const h = m[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const triplet = (src: string, name: string): RGB => {
    const m = new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+)`).exec(src) ?? new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+)`).exec(base);
    if (!m) throw new Error(`no ${name}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const alpha = (src: string, name: string): number => {
    const m = new RegExp(`${name}:\\s*rgb\\(var\\(--[a-z]+-rgb\\) / ([0-9.]+)\\)`).exec(src);
    if (!m) throw new Error(`no ${name}`);
    return Number(m[1]);
  };
  const lum = (c: RGB): number => {
    const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  };
  const ratio = (a: RGB, b: RGB): number => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const over = (tone: RGB, bg: RGB, a: number): RGB => [0, 1, 2].map((i) => Math.round((1 - a) * bg[i]! + a * tone[i]!)) as RGB;
  for (const [theme, src] of [['light', light], ['dark', dark]] as const) {
    const surf = hex(src, '--surf');
    const text = hex(src, '--text');
    const r1 = ratio(text, surf);
    assert(r1 >= 4.5, `${theme}: the count, --text on --surf = ${r1.toFixed(2)}:1 (was 1.24:1 inside the dimmed button)`);
    const chip = over(triplet(src, '--good-rgb'), surf, alpha(src, '--wash-good'));
    const r2 = ratio(text, chip);
    assert(r2 >= 4.5, `${theme}: the complete chip, --text on --wash-good over --surf = ${r2.toFixed(2)}:1`);
    const r3 = ratio(hex(src, '--muted'), surf);
    assert(r3 >= 4.5, `${theme}: the blocked button's label, --muted on --surf = ${r3.toFixed(2)}:1`);
    /* ON THE SHELL GROUND, which is where the check-in form's disclosure
       actually sits: /check-in draws no card around the form, so the error
       line lands on .phone's --phone-bg. Measured there and not on --surf on
       purpose — dark --bad-text on dark --surf is 4.47:1 (tokens.css's own
       note says 4.94, which the current --surf no longer gives), so this
       pattern must be re-measured before it is moved into a card. */
    const r4 = ratio(hex(src, '--bad-text'), hex(src, '--phone-bg'));
    assert(r4 >= 4.5, `${theme}: the field error, --bad-text on --phone-bg (the form's ground) = ${r4.toFixed(2)}:1 (B8: --bad-text is the on-bad-strong the board asked for)`);
    const r5 = ratio(hex(src, '--muted'), hex(src, '--phone-bg'));
    assert(r5 >= 4.5, `${theme}: "Not answered", the anchor chips' words and the helper text, --muted on --phone-bg = ${r5.toFixed(2)}:1`);
  }
}

console.log('\nA4/C-d. irreversibility is one line, the reasoning is behind a disclosure — check-in only');
{
  assert(/You can’t change this after you submit\./.test(checkIn), 'the line: "You can’t change this after you submit."');
  assert(/<details className="subm-why">/.test(checkIn) && /<summary>[\s\S]*?Why can’t I edit it\?[\s\S]*?<\/summary>/.test(checkIn), 'the link is the summary of a native <details>');
  assert(/tell your coach[\s\S]*record a correction[\s\S]*what you first reported/.test(checkIn), 'and the existing explanation — who corrects it, and that My Data shows both — is what opens');
  const note = rule('.subm-note');
  assert(/font-size:\s*var\(--fs-12\)/.test(note) && /color:\s*var\(--muted\)/.test(note), 'the line is --fs-12 --muted');
  const why = rule('.subm-why-link');
  assert(/font-size:\s*var\(--fs-13\)/.test(why) && /font-weight:\s*600/.test(why) && /color:\s*var\(--accent-text\)/.test(why), 'the link is --fs-13 / 600 / --accent-text');
  assert(/min-height:\s*44px/.test(rule('.subm-why summary')), 'and its summary is a 44px target');
  assert(/Once this is sent it can’t be edited\./.test(rpe) && !/subm-why/.test(rpe), 'RpeForm keeps its full sentence — A4 was approved for /check-in only');
  assert(/Saved on this phone first — it sends even if your signal drops\./.test(nutrition) && !/change this after you submit/.test(nutrition), 'NutritionCheckinForm keeps its existing line — D7, the footer copy is blocked until the 3b board is final');
}

console.log('\nA5/A6/A9. the scales: numbered ends, neutral "Not answered", no second readout, filled options');
{
  assert(/Not answered/.test(scaleInput) && !/not answered/.test(scaleInput), '"Not answered", capitalised as the board writes it');
  assert(!/of 5/.test(scaleInput), 'the per-scale "X of 5" readout is gone — the footer count is the only "of N" on the screen');
  const un = rule('.sc-v.un');
  assert(/color:\s*var\(--muted\)/.test(un) && !/--warn-text/.test(un), '.sc-v.un is --muted, not amber: an untouched form is a starting state, not a fault');
  assert(/\{1\} · \{copy\.low\}|1 · \{copy\.low\}/.test(scaleInput) && /5 · \{copy\.high\}/.test(scaleInput), 'the ends read "1 · {low}" and "5 · {high}"');
  const anchor = rule('.sc-a > span');
  assert(/font-size:\s*var\(--fs-11\)/.test(anchor) && /font-weight:\s*600/.test(anchor) && /color:\s*var\(--muted\)/.test(anchor), 'anchor chips at --fs-11 / 600 / --muted');
  assert(/background:\s*var\(--surf\)/.test(anchor) && /border:\s*1px solid var\(--border\)/.test(anchor) && /border-radius:\s*var\(--r-control\)/.test(anchor) && /padding:\s*var\(--sp-4\) var\(--sp-8\)/.test(anchor), 'on --surf, 1px --border, --r-control, --sp-4 --sp-8 (B2, B7)');
  const opt = rule('.dots .opt > span');
  assert(/background:\s*var\(--surf2\)/.test(opt), 'an unanswered option is filled --surf2 (A9)');
  assert(/border-radius:\s*14px/.test(opt), 'and keeps its 14px radius — pinned by test-athlete-token-audit, not part of this change');
  const chosen = rule('.dots .opt[data-selected] > span');
  assert(/background:\s*var\(--accent\)/.test(chosen) && /color:\s*var\(--on-accent\)/.test(chosen) && /box-shadow:\s*var\(--ring-accent\)/.test(chosen), 'the chosen option is --accent + --on-accent with --ring-accent (B5)');
}

console.log('\nC-c. sleep starts empty and counts as a question');
{
  assert(/useState<number \| null>\(null\)/.test(checkIn) && /const \[sleepHours, setSleepHours\]/.test(checkIn), 'sleepHours starts null');
  assert(/const SLEEP_START = 7;/.test(checkIn), 'the first tap starts it at 7.0');
  assert(/h === null \? SLEEP_START : Math\.max\(0, h - 0\.5\)/.test(checkIn) && /h === null \? SLEEP_START : Math\.min\(14, h \+ 0\.5\)/.test(checkIn), 'either key — minus or plus — starts it; neither counts as a step from nothing');
  assert(/sleepHours === null \? '–' : sleepHours\.toFixed\(1\)/.test(checkIn), 'it reads "–" until then');
  assert(/data-empty=\{sleepHours === null \? '' : undefined\}/.test(checkIn) && /color:\s*var\(--faint\)/.test(rule('.step .val .v[data-empty]')), 'in --faint, the set value in --text');
  assert(/const TOTAL_QUESTIONS = WELLNESS_SCALES\.length \+ 1;/.test(checkIn), 'six questions: the five scales plus sleep');
  assert(WELLNESS_SCALES.length + 1 === 6, 'and that is six, which "All six answered" spells out');
  assert(/\(sleepHours === null \? 0 : 1\)/.test(checkIn), 'sleep is counted only once set');
  assert(!/useState\(7\)/.test(checkIn), 'no 7-hour default remains — a number the athlete never gave is not an answer');
}

console.log('\nC-e/B9. out-of-range heart rate or body mass blocks Submit, inline, from one config');
{
  assert(RESTING_HR_RANGE.min === 25 && RESTING_HR_RANGE.max === 120, 'RESTING_HR_RANGE is 25 to 120');
  assert(BODY_MASS_RANGE.min === 30 && BODY_MASS_RANGE.max === 200, 'BODY_MASS_RANGE is 30 to 200');
  assert(/resting_hr: z\.number\(\)\.int\(\)\.min\(RESTING_HR_RANGE\.min\)\.max\(RESTING_HR_RANGE\.max\)/.test(validation), 'the schema reads the same constants for resting_hr');
  assert(/body_mass_kg: z\.number\(\)\.min\(BODY_MASS_RANGE\.min\)\.max\(BODY_MASS_RANGE\.max\)/.test(validation), 'and for body_mass_kg — one config, so the helper text cannot drift from the validator');
  assert(fieldHelp('resting_hr') === 'Usually 25 to 120 bpm', `helper: "${fieldHelp('resting_hr')}"`);
  assert(fieldHelp('body_mass_kg') === 'Usually 30 to 200 kg', `helper: "${fieldHelp('body_mass_kg')}"`);
  assert(fieldProblem('resting_hr', '') === null && fieldProblem('body_mass_kg', '  ') === null, 'an empty field is not a problem — both are optional');
  assert(fieldProblem('resting_hr', '52') === null && fieldProblem('body_mass_kg', '104.5') === null, 'in-range values pass');
  assert(fieldProblem('resting_hr', '24') !== null && fieldProblem('resting_hr', '121') !== null, 'and 24 or 121 bpm is refused');
  assert(fieldProblem('body_mass_kg', '1045') === 'Check this. Body mass is usually between 30 and 200 kg.', `"${fieldProblem('body_mass_kg', '1045')}" — the board's sentence with the validator's numbers`);
  assert(fieldProblem('resting_hr', '300') === 'Check this. Resting heart rate is usually between 25 and 120 bpm.', 'and the same shape for heart rate');
  assert(fieldProblem('resting_hr', 'abc') !== null, 'a non-number is refused too');
  /* The same refusal the schema makes. If the inline check ever accepted a
     value the schema refuses, the athlete would tap a live button and get the
     generic message — the exact "silent-ish failure" C-e exists to remove. */
  for (const raw of ['24', '25', '120', '121', '52.5', '0', '-3']) {
    const n = Number(raw);
    const schemaOk = WellnessEntryInput.shape.resting_hr.safeParse(n).success;
    assert((fieldProblem('resting_hr', raw) === null) === schemaOk, `resting_hr "${raw}": inline check agrees with the schema (${schemaOk ? 'accepted' : 'refused'})`);
  }
  for (const raw of ['29.9', '30', '200', '200.1', '82.55', '82.5']) {
    const n = Number(raw);
    const schemaOk = WellnessEntryInput.shape.body_mass_kg.safeParse(n).success;
    assert((fieldProblem('body_mass_kg', raw) === null) === schemaOk, `body_mass_kg "${raw}": inline check agrees with the schema (${schemaOk ? 'accepted' : 'refused'})`);
  }
  assert(/fieldProblem\('resting_hr', restingHr\)/.test(checkIn) && /fieldProblem\('body_mass_kg', bodyMassKg\)/.test(checkIn), 'CheckInForm runs the inline check on both fields');
  assert(/fieldHelp\('resting_hr'\)/.test(checkIn) && /fieldHelp\('body_mass_kg'\)/.test(checkIn), 'and renders the helper text from the same config');
  assert(/'Fix one field to submit'/.test(checkIn) && /'Fix two fields to submit'/.test(checkIn), 'the footer reads "Fix one field to submit" — "two fields" when both are wrong');
  assert(/const blocked = remaining > 0 \|\| problems > 0;/.test(checkIn), 'and a field problem blocks the action exactly as an unanswered question does');
  const hr = openingTag(checkIn, 'id="ci-hr"');
  const bm = openingTag(checkIn, 'id="ci-bm"');
  assert(/aria-invalid=\{hrProblem \? true : undefined\}/.test(hr) && /aria-describedby="ci-hr-help ci-hr-error"/.test(hr), 'the heart-rate field is marked invalid from state and points at its help and its error');
  assert(/aria-invalid=\{bmProblem \? true : undefined\}/.test(bm) && /aria-describedby="ci-bm-help ci-bm-error"/.test(bm), 'so is body mass');
  assert(/min=\{RESTING_HR_RANGE\.min\}/.test(hr) && /max=\{RESTING_HR_RANGE\.max\}/.test(hr) && /min=\{BODY_MASS_RANGE\.min\}/.test(bm) && /max=\{BODY_MASS_RANGE\.max\}/.test(bm), 'the inputs\' own min/max read the constants too, not literals');
  assert(/id="ci-hr-error"/.test(checkIn) && /id="ci-bm-error"/.test(checkIn) && /id="ci-hr-help"/.test(checkIn) && /id="ci-bm-help"/.test(checkIn), 'and every id they point at renders in this file');
  const invalid = rule(".disclose-body .field[aria-invalid='true']");
  assert(/border-color:\s*var\(--bad\)/.test(invalid) && /box-shadow:\s*0 0 0 3px rgb\(var\(--bad-rgb\) \/ 0\.18\)/.test(invalid), 'the field: 1px --bad and a 3px ring of --bad-rgb at 0.18 (A7)');
  const err = rule('.err-line');
  assert(/font-size:\s*var\(--fs-13\)/.test(err) && /font-weight:\s*600/.test(err) && /color:\s*var\(--bad-text\)/.test(err), 'the message: --fs-13 / 600 / --bad-text');
  const dot = rule('.err-dot');
  assert(/background:\s*var\(--wash-bad\)/.test(dot) && /color:\s*var\(--bad-pill-text\)/.test(dot) && /border-radius:\s*var\(--r-full\)/.test(dot), 'its glyph: --wash-bad / --bad-pill-text / --r-full');
  const help = rule('.help-line');
  assert(/font-size:\s*var\(--fs-12\)/.test(help) && /color:\s*var\(--muted\)/.test(help), 'helper text: --fs-12 --muted, under the field rather than as a placeholder, so it stays readable once a value is typed');
  assert(!/Answer all six before you send it/.test(checkIn) || /if \(blocked\) return;/.test(checkIn), 'the generic message can only be reached past the blocked guard');
}

console.log('\nthe specs moved with the behaviour');
{
  const spec = read('docs/athlete/screens/02-morning-check-in.md');
  assert(/starts empty/.test(spec) && /counts as a question|counted as a question/.test(spec), '02-morning-check-in.md: sleep starts empty and counts');
  assert(/Usually 25 to 120 bpm/.test(spec) && /Usually 30 to 200 kg/.test(spec), 'and states the helper text with the validator\'s ranges');
  assert(/of 6 answered/.test(spec) && /All six answered/.test(spec), 'and the footer count');
  assert(/Fix one field to submit/.test(spec), 'and the out-of-range footer state');
  assert(/Why can.t I edit it\?/.test(spec), 'and the disclosure');
  assert(/Not answered/.test(spec) && /`1 · Very sore`|"1 · Very sore"|1 · Very sore/.test(spec), 'and the neutral "Not answered" and numbered ends');
  const rpeSpec = read('docs/athlete/screens/03-session-rating.md');
  assert(/0 of 1 answered · 1 to go/.test(rpeSpec) && /aria-disabled/.test(rpeSpec), '03-session-rating.md: the count line and the blocked treatment');
  const nutSpec = read('docs/athlete/screens/04-weekly-nutrition-check-in.md');
  assert(/0 of 1 answered · 1 to go/.test(nutSpec) && /aria-disabled/.test(nutSpec), '04-weekly-nutrition-check-in.md: the same');
  const repSpec = read('docs/athlete/screens/15-report-a-problem.md');
  assert(/aria-disabled/.test(repSpec), '15-report-a-problem.md: the blocked treatment');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
