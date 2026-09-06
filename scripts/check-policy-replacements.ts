/* The guard against a policy replacement that quietly drops the rule it replaced.
 *
 * WHY THIS EXISTS. Migration 0080 added one clause to
 * programme_assignments_update with `drop policy` + `create policy`, and wrote a
 * fresh WITH CHECK containing only the new clause. 0022/0070's rehab-authorship
 * rule went with it, handing a coach and a nutritionist UPDATE on rehab
 * assignments. Nothing failed. Every test written alongside 0080 asserted the
 * rule being ADDED, and a policy that is too permissive breaks no assertion that
 * only exercises the permitted path. Run-level verification could not catch it
 * either: walking the app only exercises paths the broken policy allows. It was
 * found by reading the superseded migration before pushing, which is luck
 * wearing a process's clothes.
 *
 * WHAT IT CHECKS. For every migration above the baseline that drops and
 * re-creates an existing policy, it works out which roles the PREVIOUS
 * definition refused, and requires each one to be either:
 *
 *   - still asserted as refused, in a pgTAP test, as that role; or
 *   - declared as an intentional widening, in the migration, with a reason.
 *
 * HOW "REFUSED" IS INFERRED, and where it is deliberately crude. A clause that
 * calls auth_has_any_role() is treated as role-gating, and the roles it admits
 * are the app_role literals it names -- ALL of them, not the first ARRAY[...],
 * which is a mistake this project has already made once. A policy admits a role
 * only if BOTH its USING and its WITH CHECK admit it, so the admitted set is the
 * intersection; a missing clause constrains nothing.
 *
 * That is a heuristic and it can OVER-report: an old clause like
 * `(injury_id is null or medic)` lets a coach through without naming them, and
 * the guard will still claim the coach was refused. Over-reporting is the safe
 * direction. The cost is one assertion or one sentence; the cost of
 * under-reporting is 0080 again.
 *
 * FIVE STAFF ROLES, not six. The athlete is not checked. Athlete isolation is
 * the subject of its own tests throughout the tenancy suite, and requiring an
 * athlete refusal on every staff-policy replacement would add noise to every
 * run -- and a guard that cries wolf gets widened until it catches nothing,
 * which is the failure mode test-access-gates.ts warns about in its own header.
 *
 * HOW TO SATISFY IT. Add the refusal to the pgTAP file that covers the table:
 *
 *     select tests.set_jwt(tests.uid('orga', 'user_coach'));
 *     select throws_ok(
 *       format($q$update the_table set ... where id = %L$q$, ...),
 *       '42501', null, 'the coach still cannot ...');
 *
 * A USING mismatch raises nothing and matches no row, so assert those as a
 * count instead -- throws_ok would pass only when the GRANT is missing, which is
 * a different fact. Both shapes are recognised.
 *
 * If the replacement genuinely ADMITS a role the old policy refused, say so in
 * the migration:
 *
 *     -- policy-widening: strength_conditioning — restores 0022/0070 authorship
 *
 * The marker is the point, the same as test-access-gates' access-exempt: a
 * widening becomes a sentence a reviewer can disagree with, rather than silence
 * that reads identically to an oversight.
 *
 * WHERE IT RUNS. package.json's `prebuild`, beside test-access-gates, so
 * `npm run build` runs it and so does every Vercel deploy. It reads files only
 * -- no database, no environment -- which is what makes that placement possible.
 *
 * THE BASELINE. Migrations up to and including 0082 are grandfathered. 0066
 * alone rewrote 141 policies during the five-role migration, and retrofitting
 * assertions for all of them is real work with its own review, not something to
 * smuggle in behind a new guard. The rule is prospective, which is what it was
 * asked to be.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASELINE = 82;

export type Migration = { name: string; sql: string };
export type Policy = { name: string; table: string; using: string | null; check: string | null };
type StoredPolicy = Policy & { migration: string };
export type Finding = {
  migration: string;
  policy: string;
  table: string;
  replaces: string;
  refused: string[];
  declared: string[];
  uncovered: string[];
};
/** role -> table -> the test files asserting that role is refused on it. */
export type Coverage = Record<string, Record<string, string[]>>;

const STAFF_ROLES = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
  'nutritionist',
];

/* Which fixture account holds which role, from
   supabase/tests/000_setup_test_helpers.sql. user_admin keeps its old label:
   it is an input to md5() and renaming it would move every id it generates. */
const FIXTURE_ROLES: Record<string, string[]> = {
  user_admin: ['sport_scientist'],
  user_coach: ['coach'],
  user_medical: ['medic'],
  user_sc: ['strength_conditioning'],
  user_nutritionist: ['nutritionist'],
  user_dual: ['coach', 'strength_conditioning'],
};

/** Strip SQL comments before any pattern matching. This project has broken two
 *  of its own tests by matching prose that explained a rule as though it were a
 *  violation of it, so nothing below ever sees a comment. */
export function stripSql(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Read a parenthesised group starting at `open`, respecting nesting and single
 *  quotes. Regexes cannot do this, and a policy expression is full of nested
 *  calls — auth_has_any_role(ARRAY[...]) inside EXISTS(...) inside AND(...). */
function balanced(text: string, open: number): { body: string; end: number } | null {
  let depth = 0;
  let inQuote = false;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (inQuote) {
      if (c === "'") { if (text[i + 1] === "'") i += 1; else inQuote = false; }
      continue;
    }
    if (c === "'") inQuote = true;
    else if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Every `create policy` in one migration, with its USING and WITH CHECK. */
export function parsePolicies(sql: string): Policy[] {
  const text = stripSql(sql);
  const out: Policy[] = [];
  const re = /create\s+policy\s+"?([a-z0-9_]+)"?\s+on\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const table = m[2];
    if (!name || !table) continue;
    /* The statement runs to the next top-level semicolon. Quotes are tracked so
       a `;` inside a literal does not end it early. */
    let end = m.index;
    let inQuote = false;
    for (let i = m.index; i < text.length; i += 1) {
      if (text[i] === "'") inQuote = !inQuote;
      else if (text[i] === ';' && !inQuote) { end = i; break; }
      end = i;
    }
    const stmt = text.slice(m.index, end);

    const usingAt = stmt.search(/\busing\s*\(/i);
    const checkAt = stmt.search(/\bwith\s+check\s*\(/i);
    const grab = (at: number): string | null => {
      if (at < 0) return null;
      const open = stmt.indexOf('(', at);
      const b = balanced(stmt, open);
      return b ? b.body : null;
    };
    out.push({ name, table, using: grab(usingAt), check: grab(checkAt) });
  }
  return out;
}

/** Which roles a clause admits. A clause that never calls auth_has_any_role is
 *  not a role gate and constrains nobody. */
function admittedBy(clause: string | null): Set<string> {
  if (clause === null) return new Set(STAFF_ROLES);
  if (!/auth_has_any_role\s*\(/i.test(clause)) return new Set(STAFF_ROLES);
  const named = new Set<string>();
  /* ALL app_role literals in the clause, not the first ARRAY[...]. Reading only
     the first one is how group_memberships was once misread as medic-only when
     it is medic OR (coach/SS AND NOT rehab). */
  for (const m of clause.matchAll(/'([a-z_]+)'\s*::\s*(?:public\.)?app_role/gi)) {
    const role = m[1];
    if (role && STAFF_ROLES.includes(role)) named.add(role);
  }
  return named;
}

export function refusedByPolicy(policy: Policy): string[] {
  const admitted = admittedBy(policy.using);
  const check = admittedBy(policy.check);
  const both = new Set([...admitted].filter((r) => check.has(r)));
  return STAFF_ROLES.filter((r) => !both.has(r));
}

/** Refusal assertions in the pgTAP suite, grouped by the role acting.
 *
 *  Blocks are delimited by set_jwt, which is how every file in the suite
 *  switches actor — structural rather than proximity matching, because
 *  proximity matching against prose is exactly what broke earlier tests here. */
export function refusalCoverage(tests: readonly Migration[]): Coverage {
  const cover: Coverage = {};
  for (const { name, sql } of tests) {
    const text = stripSql(sql);
    const marks = [...text.matchAll(/set_jwt\s*\(\s*tests\.uid\s*\(\s*'[a-z]+'\s*,\s*'([a-z0-9_]+)'/gi)];
    marks.forEach((mark, i) => {
      const fixture = mark[1];
      const roles = fixture ? FIXTURE_ROLES[fixture] : undefined;
      if (!roles) return;
      const next = marks[i + 1];
      const block = text.slice(mark.index, next ? next.index : text.length);
      /* Two shapes, because the database refuses in two ways. A WITH CHECK
         violation RAISES 42501. A USING mismatch matches no row and raises
         nothing, so that one is asserted as a count. */
      const raises = [...block.matchAll(/throws_ok\s*\(([\s\S]*?)'42501'/gi)].map((x) => x[1] ?? '');
      const counts = [...block.matchAll(/\b(?:is|cmp_ok)\s*\(([\s\S]*?)0::bigint/gi)].map((x) => x[1] ?? '');
      for (const frag of raises.concat(counts)) {
        for (const t of frag.matchAll(/\b(?:from|update|into|table)\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
          const table = t[1];
          if (!table) continue;
          for (const role of roles) {
            const byTable = (cover[role] ??= {});
            (byTable[table] ??= []).push(name);
          }
        }
      }
    });
  }
  return cover;
}

function migrationNumber(filename: string): number | null {
  const m = /^(\d{4})/.exec(filename);
  return m?.[1] ? Number(m[1]) : null;
}

export function analyse({
  migrations,
  tests,
  baseline = BASELINE,
}: {
  migrations: readonly Migration[];
  tests: readonly Migration[];
  baseline?: number;
}): { findings: Finding[]; replacements: number } {
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  const previous = new Map<string, StoredPolicy>(); // "table.policy" -> definition
  const findings: Finding[] = [];
  let replacements = 0;

  for (const mig of ordered) {
    const num = migrationNumber(mig.name);
    const text = stripSql(mig.sql);
    const defs = parsePolicies(mig.sql);

    for (const def of defs) {
      const key = `${def.table}.${def.name}`;
      const dropped = new RegExp(
        `drop\\s+policy\\s+(?:if\\s+exists\\s+)?"?${def.name}"?\\s+on\\s+(?:public\\.)?"?${def.table}"?`,
        'i',
      ).test(text);
      const prior = previous.get(key);

      if (dropped && prior && num !== null && num > baseline) {
        replacements += 1;
        const refused = refusedByPolicy(prior);
        const declared = new Set(
          [...mig.sql.matchAll(/--\s*policy-widening:\s*([a-z_]+)\s*[—-]\s*(\S.*)$/gim)]
            .filter((m) => (m[2] ?? '').trim().length > 0)
            .map((m) => m[1] ?? ''),
        );
        const cover = refusalCoverage(tests);
        const uncovered = refused.filter(
          (role) => !declared.has(role) && (cover[role]?.[def.table]?.length ?? 0) === 0,
        );
        if (uncovered.length > 0) {
          findings.push({
            migration: mig.name,
            policy: def.name,
            table: def.table,
            replaces: prior.migration,
            refused,
            declared: [...declared],
            uncovered,
          });
        }
      }
      previous.set(key, { ...def, migration: mig.name });
    }
  }
  return { findings, replacements };
}

function readDir(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), 'utf8') }));
}

/* CLI. Skipped when imported by the guard's own test. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrations = readDir('supabase/migrations');
  const tests = readDir('supabase/tests');
  const { findings, replacements } = analyse({ migrations, tests });

  console.log(`policy replacements above migration ${String(BASELINE).padStart(4, '0')}: ${replacements}`);
  console.log(`  ${replacements - findings.length} carry a refusal assertion or a stated widening`);
  console.log(`  ${findings.length} do not`);

  if (findings.length > 0) {
    console.error('\nThese replace a policy without pinning what the old one refused.');
    console.error('A policy that is too permissive fails no test that only walks the permitted path —');
    console.error('this is how migration 0080 dropped the rehab-authorship rule silently.\n');
    for (const f of findings) {
      console.error(`  ${f.migration}  ${f.table}.${f.policy}  (replaces the definition in ${f.replaces})`);
      console.error(`    the old policy refused : ${f.refused.join(', ') || '(none)'}`);
      console.error(`    unaccounted for        : ${f.uncovered.join(', ')}`);
    }
    console.error('\nEither assert the refusal still holds, as that role, in the pgTAP file for the table:');
    console.error("    select tests.set_jwt(tests.uid('orga', 'user_coach'));");
    console.error("    select throws_ok(<the write>, '42501', null, '...');");
    console.error('  (a USING mismatch raises nothing — assert those as a count of 0::bigint)');
    console.error('\nor declare the widening in the migration, with a reason:');
    console.error('    -- policy-widening: coach — <why this role may now write>\n');
    process.exit(1);
  }

  console.log('\nEvery policy replacement pins what the old policy refused, or says why not.');
}
