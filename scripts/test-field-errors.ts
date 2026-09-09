/* A field that is wrong says so, and says why, and the "why" exists.
 *
 * WHAT AN AUDIT FOUND AND WHAT IT GOT WRONG. On 2026-09-09 a sweep reported 233
 * form controls, 322 setError call sites and ZERO aria-invalid, and framed it as
 * 233 controls needing the attribute. Reading the code says otherwise: of 54
 * components that hold a control and its own error state, FIFTY produce only
 * submission errors — `json.error`, a network failure, a rejected mutation. This
 * app validates very little in the browser; it submits and reports what the
 * server said.
 *
 * aria-invalid means THE VALUE IS WRONG. On a network failure the value is
 * usually fine, so setting it there would be a lie told to exactly the users who
 * cannot see the form to check. Those fifty are already correct: role="alert" is
 * the right mechanism for a form-level failure and all 54 carry it.
 *
 * So this guard covers the four forms where validation genuinely names a field,
 * and it enforces the two things that make the attribute worth anything:
 *
 *   1. aria-invalid is BOUND TO STATE, never a bare `true` — a permanently
 *      invalid field is noise a screen reader repeats on every visit.
 *   2. aria-invalid comes WITH aria-describedby, and the id it points at
 *      actually renders in the same file. A dangling reference is the quietest
 *      failure in this whole area: nothing errors, the browser drops the
 *      association, and the field announces "invalid" with no reason given.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
};

/** Forms whose validation names the field it rejected, so the field can say so.
 *  Pinned by name: this is the set the work covered, and a removal here has to
 *  be deliberate rather than a quiet regression. */
export const FIELD_ATTRIBUTABLE = [
  { file: 'src/components/ProblemReportForm/ProblemReportForm.tsx',
    why: 'the body is over 1000 chars — the value itself is wrong, and the counter already said so' },
  { file: 'src/components/GymSessionSetsList/GymSessionSetsList.tsx',
    why: 'validateCorrection knows whether reps or load failed; it used to return a bare string and throw that away' },
  { file: 'src/components/ChangePasswordForm/ChangePasswordForm.tsx',
    why: 'length and reuse belong to the new password, mismatch to the confirmation, the wrong current password to that field' },
] as const;

const files = walk('src');

console.log('the forms that know which field is wrong say which field is wrong');
{
  for (const { file } of FIELD_ATTRIBUTABLE) {
    const src = readFileSync(file, 'utf8');
    assert(/aria-invalid=/.test(src), `${file.split('/').pop()} marks a field invalid`);
    assert(/aria-describedby=/.test(src), `  ...and points it at the reason`);
  }
}

console.log('\naria-invalid is bound to state, never asserted');
{
  const hard: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    /* `aria-invalid` with a literal true, or the string "true", is a field that
       is invalid forever. */
    for (const m of src.matchAll(/aria-invalid=(\{true\}|"true")/g)) {
      hard.push(`${f.replace('src/', '')}: ${m[0]}`);
    }
  }
  assert(hard.length === 0, hard.length === 0
    ? 'no control is marked invalid unconditionally'
    : hard.join(' · '));
}

console.log('\nevery aria-invalid comes with a reason, and the reason exists');
{
  const missingDesc: string[] = [], dangling: string[] = [], unverifiable: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/aria-invalid=/.test(src)) continue;

    const rendered = new Set<string>();
    for (const m of src.matchAll(/id="([^"]+)"/g)) rendered.add(m[1]!);
    for (const m of src.matchAll(/id=\{([A-Z][A-Z0-9_]*)\}/g)) {
      const decl = new RegExp(`const ${m[1]} = '([^']+)'`).exec(src);
      if (decl) rendered.add(decl[1]!);
    }
    for (const m of src.matchAll(/id=\{`([^`$]+)`\}/g)) rendered.add(m[1]!);

    /* Element-level check: within the same JSX tag, an aria-invalid wants an
       aria-describedby beside it. Tags are found by scanning from `<` to the
       matching `>` at depth zero, so a nested expression does not end it early. */
    for (const m of src.matchAll(/<(input|textarea|select)\b/g)) {
      let i = (m.index ?? 0), depth = 0, end = i;
      for (; i < src.length; i++) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        else if (src[i] === '>' && depth === 0) { end = i; break; }
      }
      const tag = src.slice(m.index ?? 0, end);
      if (!/aria-invalid=/.test(tag)) continue;
      if (!/aria-describedby=/.test(tag)) {
        missingDesc.push(`${f.replace('src/', '')} <${m[1]}> marked invalid with no describedby`);
        continue;
      }
      /* THE REFERENCED ID MUST RENDER IN THIS FILE, and extracting it needs more
         care than a quoted-string grab. A first version matched the first quoted
         string inside the attribute expression, so
         `aria-describedby={invalidField === 'reps' ? ERROR_ID : undefined}`
         yielded "reps" — the ternary's CONDITION read as an id, and the guard
         reported two dangling references against correct code.

         So: a plain string attribute is checked directly; an expression is
         resolved only through a `const NAME = '...'` in the same file, which is
         how an id constant is actually written. Anything else is counted as
         unverifiable and reported, never passed silently. */
      const ids: string[] = [];
      const literal = /aria-describedby="([^"]+)"/.exec(tag);
      if (literal) ids.push(...literal[1]!.split(/\s+/).filter(Boolean));
      else {
        const expr = /aria-describedby=\{([^}]*)\}/.exec(tag)?.[1] ?? '';
        const idents = [...expr.matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g)].map((m) => m[1]!);
        if (idents.length === 0) unverifiable.push(`${f.replace('src/', '')} <${m[1]}>`);
        for (const ident of idents) {
          const decl = new RegExp(`const ${ident} = '([^']+)'`).exec(src);
          if (decl) ids.push(decl[1]!);
          else unverifiable.push(`${f.replace('src/', '')} ${ident} not resolvable`);
        }
      }
      /* THE SET OF IDS THIS FILE ACTUALLY RENDERS, resolved the same way the
         references are. A first version had a blanket escape hatch — if the file
         contained any `id={SOME_CONST}` at all, the dangling check was skipped —
         which meant a describedby pointing at a literal that renders nowhere
         passed as long as some unrelated constant id existed. Proven by planting
         exactly that. Constants are resolvable, so there is no need to give up. */
      for (const id of ids) {
        if (!rendered.has(id)) dangling.push(`${f.replace('src/', '')} → #${id} never rendered`);
      }
    }
  }
  assert(missingDesc.length === 0, missingDesc.length === 0
    ? 'every invalid control also names the message that explains it'
    : missingDesc.join(' · '));
  assert(dangling.length === 0, dangling.length === 0
    ? 'and every id referenced by aria-describedby actually renders'
    : dangling.join(' · '));
  assert(unverifiable.length === 0, unverifiable.length === 0
    ? 'and every reference is resolvable, so none is passed on trust'
    : `unverifiable: ${unverifiable.join(' · ')}`);
}

console.log('\nthe fifty submission-only forms are left alone, and still announce');
{
  /* The other half of the finding: these must keep role="alert", which is the
     correct mechanism for a failure that belongs to the form rather than to a
     value. If one loses it, that IS a regression — the same defect four
     components had this morning. */
  let withControls = 0, announcing = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/<(input|select|textarea)\b/.test(src) || !/setError\(/.test(src)) continue;
    withControls += 1;
    if (/role="alert"|aria-live=/.test(src)) announcing += 1;
  }
  assert(withControls === announcing,
    `all ${withControls} components holding a control and its own error state announce it (${announcing})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
