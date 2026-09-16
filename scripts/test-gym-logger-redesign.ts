/* The gym session logger — rebuilt set by set on 2026-09-12 (ATH-ADULT-09 C1,
 * approved by Isabella with the two target-size tokens --hit-lg 56px and
 * --hit-md 52px; 10 C1 and 11 C1 with it). This file was the 8 September
 * redesign's guard and pinned that build's shape: the exercise-card LIST, its
 * "1 more · Nordic curl" disclosure, the "Recommended / Your weight" row, the
 * amber part-done pill, the inline finish button. The rebuild supersedes all
 * of it on purpose, so this file now pins the rebuilt shape instead — the
 * things a future edit could quietly undo:
 *
 *   1. one exercise at a time, what is next stated beneath, no disclosure
 *   2. the two numbers at --fs-48 between --hit-md steppers, the unit beside
 *   3. the one primary at --hit-lg, labelled with what it writes
 *   4. the set chips as the state display — one accent, no disabled control
 *   5. the deviation as information: "Prescribed 100 kg · +2.5", a real minus
 *   6. Finish early in the header, dashed and neutral; Finish session in the
 *      footer once every set is logged; Save correction / Cancel while a
 *      correction is open
 *   7. completeMutation is still reachable — the one control that closes a
 *      session (the 8 Sept file's own warning, still the one that matters)
 *
 * What the 8 Sept file guarded against and still holds: no Close/timer row,
 * no floating finish bar. The elapsed clock on the progress row went on
 * 16 Sept 2026 — the row says "Started HH:MM" instead.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const src = strip(readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
/* Escape the whole selector. The first version wrote `\\${sel}` and left the
   brackets raw, so `.gym-set-key[data-logged]` compiled to a character class
   and matched nothing — four rules that ARE correct were reported missing. A
   test apparatus that cannot find what it is looking for reports absence
   exactly like a real absence does. */
const rule = (sel: string): string => {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('the two tokens — 12 Sept 2026, Isabella\'s decision, dated beside their values');
{
  assert(/--hit-lg: 56px;/.test(tokens) && /--hit-md: 52px;/.test(tokens), '--hit-lg 56px and --hit-md 52px exist');
  const block = tokens.slice(tokens.indexOf('THE GYM LOGGER\'S TWO TARGET SIZES'), tokens.indexOf('--hit-md: 52px;'));
  assert(/12 Sept 2026, Isabella/.test(block) && /decisions log/.test(block), 'dated, named, and pointed at the decisions log');
  const readers = [...css.matchAll(/var\(--hit-(lg|md)\)/g)].length;
  assert(readers >= 3, `read by the logger's primary and steppers (${readers} reads)`);
  assert(!/44px floor.*changed/.test(block), 'the 44px floor is unchanged (nothing else reads them)');
}

console.log('\n1. one exercise at a time, what is next beneath');
{
  assert(/const card = correctingExercise \?\? active;/.test(src), 'the card is the active exercise — or the one being corrected');
  assert(/\(alreadyComplete && showSets \? exercises : card \? \[card\] : \[\]\)\.map/.test(src), 'one card while the session is open; every exercise only once it is closed and "Correct a set" is pressed');
  assert(/className="gl-then-line"/.test(src) && /className="gl-then-row"/.test(src), 'THEN — one line when one exercise remains, rows otherwise');
  assert(!/gym-more/.test(src) && !/showAllExercises/.test(src) && !/hiddenExercises/.test(src), 'no disclosure, no "1 more" row — what is next is always visible');
  for (const dead of ['.gym-more', '.gym-ex-card', '.gym-weight', '.gym-stepper', '.gym-correct']) {
    assert(!new RegExp(`\\n${dead.replace('.', '\\.')}\\s*\\{`).test(css), `${dead} is gone from the stylesheet, not just the markup`);
  }
}

console.log('\n2. the two numbers are the screen');
{
  const v = rule('.gl-num-v');
  assert(/font-size:\s*var\(--fs-48\)/.test(v) && /font-weight:\s*(?:800|var\(--w-black\))/.test(v) && /letter-spacing:\s*-0\.025em/.test(v), 'the value at --fs-48, 800, -0.025em');
  assert(/font-size:\s*var\(--fs-15\)/.test(rule('.gl-num-v small')) && /color:\s*var\(--muted\)/.test(rule('.gl-num-v small')), 'the unit beside it at --fs-15 in --muted, not inside the figure');
  const grid = rule('.gl-num');
  assert(/grid-template-columns:\s*var\(--hit-md\) minmax\(0, 1fr\) var\(--hit-md\)/.test(grid), 'between two --hit-md columns');
  const step = rule('.gl-step');
  assert(/width:\s*var\(--hit-md\)/.test(step) && /min-height:\s*var\(--hit-md\)/.test(step) && /border:\s*none/.test(step) && /background:\s*var\(--surf2\)/.test(step), 'the stepper is a --hit-md square (min-height, so the glyph scales with the text setting), no border, the surf2 fill');
  assert(/numberBlock\('weight'\)/.test(src) && /numberBlock\('reps'\)/.test(src), 'weight and reps, each a block');
  assert(/showWeight \? numberBlock\('weight'\) : null/.test(src) && /Bodyweight · reps only/.test(src), 'a bodyweight exercise logs reps only');
  assert(/stepValue\(kind, -step\)/.test(src) && /stepValue\(kind, step\)/.test(src) && /const step = kind === 'weight' \? card\.weight_step_kg : 1;/.test(src), 'the weight steps by the exercise\'s own increment, reps by one');
  assert(/data-words=\{value === null \? '' : undefined\}/.test(src) && /'Not set'/.test(src), 'an absent value is words, at the words\' size');
  assert(!/<input[^>]*inputMode="decimal"/.test(src) && !/<input[^>]*type="number"[^>]*load/i.test(src), 'no keypad for the numbers — steppers only');
}

console.log('\n3. the one primary, labelled with what it writes');
{
  assert(/min-height:\s*var\(--hit-lg\)/.test(rule('.gl-primary')), '.gl-primary at --hit-lg');
  assert(/`Log set \$\{nextSetNumber\}\$\{setWords\(weightFor\(card\), repsFor\(card\)\)/.test(src), '"Log set 2 · 100 kg × 8" — the label is the write');
  /* REPINNED 16 Sept 2026 (Isabella's evening queue, the text rule): "Sets
     save as you log them." was her cited example of helper prose and is gone
     from the footer; the primary stands alone. */
  assert(!/Sets save as you log them\./.test(src), 'no footer note — the text rule (16 Sept 2026)');
  assert(!/can’t change|cannot change|can't change/.test(src), 'no "can\'t change" line');
  assert(/return `\$\{formatKg\(weight\)\} kg × \$\{reps\}`/.test(src), 'setWords: "102.5 kg × 8"');
}

console.log('\n4. the set chips are the state display, one accent, no disabled control');
{
  const chip = rule('.gym-set-key');
  /* --faint-on-tint from 15 Sept 2026 (the chip sits on --surf2, a tinted
     ground, where System A's --faint measured 4.21:1), then --muted the same
     night (a11y sweep C21, Isabella's ruling on the --faint family): the
     context ink aliases --faint in dark, 3.89:1 on dark --surf2; --muted is
     5.50 / 5.69. */
  assert(/min-height:\s*48px/.test(chip) && /background:\s*var\(--surf2\)/.test(chip) && /color:\s*var\(--muted\)/.test(chip) && /border:\s*none/.test(chip), 'a chip is 48px, --muted on --surf2 (C21), no border');
  const next = rule('.gym-set-key[data-next]');
  assert(/background:\s*var\(--wash-accent\)/.test(next) && /box-shadow:\s*var\(--ring-accent\)/.test(next), 'the current chip is the accent tint with the ring');
  const logged = rule('.gym-set-key[data-logged]');
  assert(/background:\s*var\(--accent\)/.test(logged) && /color:\s*var\(--on-accent\)/.test(logged) && !/--gym/.test(logged), 'a logged chip is the accent with --on-accent ink, never gym-tinted');
  assert(/'✓'/.test(src), 'and draws a tick');
  assert(!/\.gym-set-key:disabled/.test(css) && !/disabled=\{!loggedRow/.test(src), 'no disabled chip: not-reached and current are spans, not controls');
  assert(/<span[\s\S]{0,200}className="gym-set-key"[\s\S]{0,120}data-next=/.test(src) && /<button[\s\S]{0,200}className="gym-set-key"[\s\S]{0,60}data-logged=""/.test(src), 'logged is a button (the correction target); the others are spans');
  assert(!/pill-warn/.test(src.slice(0, src.indexOf('alreadyComplete && !finishedEarly'))), 'no amber part-done pill on the logger');
  assert(!/--warn/.test(rule('.gl-num-ref')) && !/--gym/.test(css.slice(css.indexOf('.gl-card {'), css.indexOf('.gym-head-row2 {'))), 'one accent and no second hue inside the logger');
  assert(/background:\s*var\(--accent\)/.test(rule('.gym-progress-fill')), 'the progress fill is the accent');
}

console.log('\n5. the deviation is information, not an error');
{
  assert(/Prescribed \{formatKg\(rec\)\} kg · <b>\{signed\(value - rec\)\}<\/b>/.test(src), '"Prescribed 100 kg · +2.5", the difference in bold');
  assert(/return `\$\{delta >= 0 \? '\+' : '−'\}/.test(src), 'a real minus sign, never a hyphen');
  assert(/color:\s*var\(--muted\)/.test(rule('.gl-num-ref')) && /color:\s*var\(--text\)/.test(rule('.gl-num-ref b')), 'in --muted, the figure in --text; no warn colour');
  assert(!/Your weight/.test(src) && !/Recommended/.test(src), 'the old "Recommended / Your weight" relabelling is gone');
}

console.log('\n6. the header, the footer, and the correction');
{
  assert(/className="gym-head-row2"/.test(src) && /className="btn-ghost gym-finish-early"/.test(src), 'Finish early sits in the header (10 C1)');
  const early = rule('.gym-finish-early');
  assert(/border:\s*1px dashed var\(--border-strong\)/.test(early) && /color:\s*var\(--muted\)/.test(early) && /min-height:\s*(?:44px|var\(--tap-min\))/.test(early), 'dashed, --muted, 44px');
  assert(/aria-label=\{`Finish early · \$\{doneCount\} of \$\{totalSets\} sets`\}/.test(src), 'and says the count');
  assert(/\{!alreadyComplete && !allLogged \? \(/.test(src), 'only while sets remain');
  assert(/allLogged \? \(\s*<div className="subm">[\s\S]{0,400}Finish session/.test(src), '"Finish session" takes the footer once every set is logged');
  assert(/Set \$\{done\.length \+ 1\} of \$\{ex\.sets\}\$\{ex\.rest_seconds \? ` · Rest \$\{ex\.rest_seconds\}s` : ''\}/.test(src), '"Set 2 of 3 · Rest 90s" — rest is reference text');
  assert(!/setInterval\([^)]*rest/i.test(src) && !/countdown/i.test(src), 'no rest timer, no countdown');
  assert(/correcting && correctingRow \? \(\s*<div className="subm">[\s\S]{0,700}Save correction · \$\{setWords\(corr\.weight, corr\.reps\)[\s\S]{0,400}Cancel/.test(src), 'while a correction is open the footer reads Save correction / Cancel (11 C1)');
  assert(/onClick=\{\(\) => openCorrection\(loggedRow\)\}/.test(src), 'a correction is reached from a logged chip');
  assert(/className="gl-strip"/.test(src) && /Correct it/.test(src), 'the set that just landed is stated above the card with its way back');
  assert(/Correcting set \$\{correctingRow\.set_number\} · was \$\{wasLine/.test(src), 'and the card says which set is being corrected and what it was');
  assert(/c\.weight === null && delta < 0\s*\? c/.test(src), 'a minus on "Not set" stays "Not set"');
}

console.log('\n7. what the 8 Sept guard protected still holds');
{
  assert(/completeMutation\.mutate\(\)/.test(src), 'completeMutation is still wired to something an athlete can press');
  assert(/Finish session/.test(src) && /Finish early/.test(src), 'both labels');
  assert(!/gym-head-row\b/.test(src) && !/gym-close/.test(src) && !/gym-clock/.test(src) && !/gym-footer/.test(src), 'no Close/timer row, no floating bar');
  for (const dead of ['.gym-head-row', '.gym-close', '.gym-clock', '.gym-footer']) {
    assert(!new RegExp(`\\n${dead.replace('.', '\\.')}\\s*\\{`).test(css), `${dead} is gone from the stylesheet`);
  }
  /* REPINNED 16 Sept 2026 (Isabella, after the second walkthrough): no
     running clock — the row says when the session was started, "Started
     07:05", in the club's clock. The timer (and its pause) is not built. */
  assert(!/setInterval/.test(src) && !/elapsed\(/.test(src) && /Started \{formatTime\(startedAt, timezone\)\}/.test(src), 'no clock: the progress row says "Started HH:MM" (16 Sept 2026)');
  assert(/gym-head-eyebrow/.test(src) && /gym-head-title/.test(src), 'one eyebrow line and the title');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
