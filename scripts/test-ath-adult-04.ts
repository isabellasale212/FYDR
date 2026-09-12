/* ATH-ADULT-04 — Wellness already submitted, built 2026-09-12 from the
 * "ATH-ADULT-04-06-08 · After submit states" board on this system's tokens.
 * A items only (overnight rule): existing tokens, no behaviour change, no
 * spec conflict. The record is docs/overnight-records-2026-09-12.md.
 *
 *   A1 the form's subhead ("45 seconds · 5 is always the best you can feel")
 *      renders only with the form — not above "Already submitted"
 *   A2 the fact is the largest thing: heading --fs-28/800, the time at
 *      --fs-20/700 --text, the recourse at --fs-13 --muted beneath
 *   A3 one emphasised card: .after-card on --wash-accent with
 *      --border-accent-soft, the athlete card radius, --shadow
 *   A4 every exit is a 44px button in the footer, labelled after the
 *      destination — "Back to Today" / "Back to My data" — never a text link
 *   A5 the board's recourse copy, two sentences
 *   A6 "Nothing submitted" takes the same shape
 * Not built (C1): the Corrected pill — the page's fetch does not read
 * revision_of, so that is a query change, not a design one.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/&rsquo;/g, '’');
const read = (p: string): string => readFileSync(p, 'utf8');
const page = strip(read('src/app/(athlete)/check-in/page.tsx'));
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('A1. the subhead belongs to the form');
{
  const head = page.slice(page.indexOf('<div className="sheet-head">'), page.indexOf('<Link href={backHref} className="sheet-x"'));
  assert(/\{!existing && entryDate === today \? \([\s\S]*?45 seconds[\s\S]*?\) : null\}/.test(head), 'the sheet head renders "45 seconds …" only when the form will render — not above Already submitted or Nothing submitted');
  assert((page.match(/45 seconds/g) ?? []).length === 1, 'and nowhere else');
}

console.log('\nA2–A5. the already-submitted card');
{
  const card = page.slice(page.indexOf('{existing ? ('), page.indexOf(') : entryDate === today ? ('));
  assert(/className="after-card"/.test(card), 'the emphasised card');
  assert(/<h2 className="after-heading">\s*Already submitted/.test(card), '"Already submitted" as the heading');
  assert(/className="after-fact num"/.test(card) && /You sent today/.test(card) && /check-in at/.test(card), 'the fact line: "You sent today’s check-in at HH:MM."');
  assert(/You can’t change an entry yourself\. Tell your coach or medical staff and they\s+can correct it for you\./.test(card), 'the board\'s recourse sentence');
  assert(/The original stays visible in My data, marked Corrected\./.test(card), 'and what happens to the original');
  assert(!/linklike/.test(card) && !/>Back<\/Link>/.test(card), 'no text link');
  assert(!/A submitted check-in can’t be edited, by you or by anyone/.test(card), 'the 40-word paragraph is gone');
  assert(!/Corrected<\/span>|pill-accent/.test(card), 'no Corrected pill — C1, not built (the fetch does not read revision_of)');
}

console.log('\nA4/A6. the footer, on both non-form branches');
{
  const footers = [...page.matchAll(/<div className="subm">[\s\S]*?<\/div>/g)].map((m) => m[0]);
  assert(footers.length === 2, `two footers — Already submitted and Nothing submitted (${footers.length})`);
  for (const f of footers) {
    assert(/<Link href=\{backHref\} className="btn-primary"/.test(f), 'a full-width primary Link to backHref');
    assert(/\{backLabel\}/.test(f), 'labelled after the destination');
  }
  assert(/const backLabel = entryDate === today \? 'Back to Today' : 'Back to My data';/.test(page), '"Back to Today" for today\'s entry, "Back to My data" for a past day — the label follows backHref');
  assert(/const backHref = entryDate === today \? '\/today' : '\/my-data\?tab=wellness';/.test(page), 'backHref itself is unchanged');
  const nothing = page.slice(page.indexOf('Nothing submitted'), page.indexOf('Nothing submitted') + 1200);
  assert(/className="after-card"/.test(page.slice(page.lastIndexOf('className="after-card"'))) && /after-heading">Nothing submitted/.test(page), '"Nothing submitted" is the same card shape');
  assert(!/linklike/.test(nothing), 'and has no text link either');
}

console.log('\nthe rules, from existing tokens');
{
  const card = rule('.after-card');
  assert(/background:\s*var\(--wash-accent\)/.test(card) && /border:\s*1px solid var\(--border-accent-soft\)/.test(card), '.after-card: --wash-accent fill, --border-accent-soft edge (B2)');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(card) && /box-shadow:\s*var\(--shadow\)/.test(card) && /padding:\s*var\(--sp-18\)/.test(card), 'the athlete card radius, --shadow, --sp-18 padding');
  const heading = rule('.after-heading');
  assert(/font-size:\s*var\(--fs-28\)/.test(heading) && /font-weight:\s*800/.test(heading), '.after-heading --fs-28 / 800 (B1: the board\'s 30 has no step)');
  const fact = rule('.after-fact');
  assert(/font-size:\s*var\(--fs-20\)/.test(fact) && /font-weight:\s*700/.test(fact) && /color:\s*var\(--text\)/.test(fact), '.after-fact --fs-20 / 700 / --text (B3)');
  const note = rule('.after-note');
  assert(/font-size:\s*var\(--fs-13\)/.test(note) && /color:\s*var\(--muted\)/.test(note), '.after-note --fs-13 --muted');
  assert(/margin-top:\s*auto/.test(rule('.phone-body.phone-body > .subm')), 'a footer that is a direct child of the shell sits at the bottom of the screen — the empty space is above the action, as drawn');
  assert(/font-size:\s*var\(--fs-16\)/.test(rule('.subm .btn-primary,\n.subm .btn-ghost')) || /\.subm \.btn-primary,\s*\.subm \.btn-ghost \{[^}]*--fs-16/.test(css), 'the button takes 03\'s footer size (44px+)');
  assert(!/text-decoration/.test(rule('.subm .btn-primary')) , 'nothing turns the Link back into a text link');
}

console.log('\nthe contrast, measured from tokens.css');
{
  const tokens = read('src/styles/tokens.css');
  const block = (start: string, end: string): string => tokens.slice(tokens.indexOf(start), tokens.indexOf(end, tokens.indexOf(start)));
  const light = block(":root[data-theme='light'] {", '.dark-tokens,');
  const dark = block(":root[data-theme='dark'] {", '@media (prefers-color-scheme: dark) {');
  const base = tokens.slice(0, tokens.indexOf(':root,'));
  type RGB = [number, number, number];
  const hex = (src: string, name: string): RGB => { const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(src) ?? new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(base); if (!m) throw new Error(`no ${name}`); return [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as RGB; };
  const triplet = (src: string, name: string): RGB => { const m = new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+)`).exec(src) ?? new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+)`).exec(base); if (!m) throw new Error(`no ${name}`); return [Number(m[1]), Number(m[2]), Number(m[3])]; };
  const alpha = (src: string, name: string): number => { const m = new RegExp(`${name}:\\s*rgb\\(var\\(--[a-z]+-rgb\\) / ([0-9.]+)\\)`).exec(src); if (!m) throw new Error(`no ${name}`); return Number(m[1]); };
  const lum = (c: RGB): number => { const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]); };
  const ratio = (a: RGB, b: RGB): number => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const over = (tone: RGB, ground: RGB, a: number): RGB => [0, 1, 2].map((i) => Math.round((1 - a) * ground[i]! + a * tone[i]!)) as RGB;
  for (const [theme, src] of [['light', light], ['dark', dark]] as const) {
    /* The card sits on the athlete ground, and its own fill is the accent wash over that ground. */
    const fill = over(triplet(src, '--accent-rgb'), hex(src, '--phone-bg'), alpha(src, '--wash-accent'));
    for (const [tok, name] of [['--text', 'the heading and the fact'], ['--muted', 'the recourse']] as const) {
      const r = ratio(hex(src, tok), fill);
      assert(r >= 4.5, `${theme}: ${name}, ${tok} on --wash-accent over --phone-bg = ${r.toFixed(2)}:1`);
    }
  }
}

console.log('\nC1 + C4 (decided 2026-09-12): a corrected day says so, and by whom');
{
  /* C1: the page reads the day's revision chain (the same read My data uses)
     rather than the _current view alone, so a corrected day is told from an
     original. C4: visibility.md forbids nothing about naming the staff member
     who corrected an entry, and My data's history rows already say "Corrected
     by {name}", so the check-in page says the same — one wording, one source. */
  assert(/fetchWellnessWithRevisions\(db, orgId, athleteId, \{ from: entryDate, to: entryDate \}\)/.test(page), 'the page reads the day\'s chain');
  assert(/const corrected = /.test(page) && /priorRevisions\.length > 0/.test(page), 'and decides "corrected" the way My data does');
  assert(/<span className="pill pill-neutral"[^>]*>\s*Corrected\s*<\/span>/.test(page), 'a Corrected pill beside the heading');
  assert(/Corrected by \$\{corrected\.correctedBy \?\? 'a member of staff'\}/.test(page), '"Corrected by {name}" — the wording My data uses, with its fallback');
  assert(/on \$\{formatDate\(corrected\.correctedAt, timezone\)\}/.test(page), 'and the date');
  assert(!/NO "Corrected" PILL YET/.test(read('src/app/(athlete)/check-in/page.tsx')), 'the "not yet" note is gone');
  assert(/const sentAt = corrected\?\.priorRevisions\[0\]\?\.submitted_at \?\? existing\?\.submitted_at/.test(page), '"You sent … at" is the athlete\'s own time on a corrected day, not the correction\'s');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/02-morning-check-in.md');
  assert(/Corrected by/.test(spec), 'and the corrected state');
  assert(/Back to Today/.test(spec) && /Back to My data/.test(spec) && /emphasised card/.test(spec), '02-morning-check-in.md describes the after-submit card and its footer button');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
