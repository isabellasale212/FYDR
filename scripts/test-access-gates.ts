/* The guard against hand-rolled access gates.
 *
 * WHY THIS EXISTS. Three separate access bugs on production in one day, all the
 * same shape: a page decided who could see something by testing
 * `claims.roles.includes('coach')` inline instead of resolving a set from
 * lib/access.ts. Each was invisible to every sweep, because a sweep looks for
 * the shared helper and these call nothing. The reports hub was found by a
 * person hitting it; the week-template detail page was found by accident while
 * answering an unrelated question. That is not a process, it is luck.
 *
 * WHAT IT CATCHES, deliberately narrow. A const whose name begins can/is/has/
 * allow, assigned from `roles.includes(...)`, inside a page or route. That is
 * the shape of a GATE. It does not flag `roles.includes` used inline for
 * wording, for an audit actor label, or in a component that edits role lists —
 * those are not access decisions and a rule that flagged them would be
 * weakened until it flagged nothing.
 *
 * HOW TO SATISFY IT. Resolve the set from lib/access.ts:
 *
 *     const canWrite = hasAnyRole(claims.roles, SESSION_EDIT);
 *
 * If a site genuinely must test a single role — and a few do — mark it:
 *
 *     // access-exempt: <why this is not a gate, or why no set fits>
 *
 * The marker is the point. An exemption is then a sentence somebody wrote and a
 * reviewer can disagree with, rather than silence that reads identically to an
 * oversight. Every exemption below was added with a reason, not to go green.
 *
 * WHERE IT RUNS. package.json's `prebuild`, so `npm run build` runs it and so
 * does every Vercel deployment, because Vercel's build command is `npm run
 * build`. It needs no database and no environment, which is what makes that
 * placement possible: a guard that needed SUPABASE_DB_URL could not run on the
 * deploy path and would be back to relying on somebody remembering.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components'];
const GATE_NAME = /^(can|is|has|allow)[A-Z]/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

type Violation = { file: string; line: number; text: string };
const violations: Violation[] = [];
let exempted = 0;
let checked = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (!/\.(tsx?|ts)$/.test(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      /* Comments describing the rule are not the rule. Without this the file's
         own explanation of what it replaced would trip its own guard, which is
         how a guard teaches people to delete explanations. */
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (!/roles\.includes\(/.test(code)) return;

      const assigned = code.match(/const\s+([A-Za-z_$][\w$]*)\s*=/);
      const name = assigned?.[1];
      if (!name || !GATE_NAME.test(name)) return;

      checked += 1;
      /* The marker is looked for on the line itself or in the three above it,
         because a reason worth writing rarely fits on one line and a guard that
         demanded it did would get one-word reasons. */
      const window = [line, ...lines.slice(Math.max(0, i - 3), i)].join('\n');
      if (/access-exempt:/.test(window)) {
        exempted += 1;
        return;
      }
      violations.push({ file, line: i + 1, text: name });
    });
  }
}

console.log(`access gates: ${checked} gate-shaped booleans built from roles.includes()`);
console.log(`  ${exempted} carry an access-exempt reason`);
console.log(`  ${violations.length} do not`);

if (violations.length > 0) {
  console.error('\nThese decide access from a role literal instead of a set in lib/access.ts.');
  console.error('Resolve the set with hasAnyRole(claims.roles, SOME_SET), or add');
  console.error('  // access-exempt: <why>\n');
  for (const v of violations) console.error(`  ${v.file}:${v.line}  const ${v.text}`);
  console.error('');
  process.exit(1);
}

console.log('\nEvery access gate resolves from lib/access.ts, or says why not.');
