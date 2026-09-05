/* Run the pgTAP cross-tenant suite in supabase/tests.
 *
 * Definition of done for Phase 0, CONTRACT.md: every table, every role, zero
 * rows returned when reading another organisation's data. The files are plain
 * SQL, so this runs them through psql in order and fails on the first error.
 *
 *   npm run test:tenancy
 *
 * Falls back to a pure Node/pg runner when psql is not on PATH (this machine
 * has no PostgreSQL client and no Docker, so `supabase test db` is not an
 * option either). The fallback executes each file's statements one at a time
 * against SUPABASE_DB_URL and fails the suite if any pgTAP assertion prints
 * "not ok", or if a statement itself errors. Prefer psql when it is present:
 * it is the same tool CI uses, so that path is the one to trust for a final
 * answer. This one is here so the suite is runnable at all without it.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dbUrl =
  process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/* Stop at the first failing file, which is the right default: a suite this
 * size is unreadable once a broken fixture cascades. TENANCY_CONTINUE=1 runs
 * every file anyway and reports the full list, which is what you want when a
 * single change (a role rename, say) is expected to touch many files at once.
 * It never changes the verdict, only how much of the picture you get. */
const CONTINUE_ON_FAIL = process.env.TENANCY_CONTINUE === '1';

const testDir = join(process.cwd(), 'supabase', 'tests');

const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files in ${testDir}`);
  process.exit(1);
}

/* G-38. Every file that switches to `authenticated` must also assert the canary,
 * because the canary is what proves the switch happened at all. Checked before a
 * single statement runs: a file that quietly loses its switch would otherwise
 * pass everything vacuously, which is exactly what G-32 and G-35 were. */
const SWITCH = /set local role authenticated;/g;
const CANARY = /rls_is_engaged\(\)/g;
const unguarded = files
  .map((f) => {
    const src = readFileSync(join(testDir, f), 'utf8');
    return { f, sw: (src.match(SWITCH) ?? []).length, cn: (src.match(CANARY) ?? []).length };
  })
  .filter((x) => x.sw > 0 && x.sw !== x.cn);

if (unguarded.length > 0) {
  console.error('\nA test file switches role without asserting the canary:\n');
  for (const u of unguarded) console.error(`  ${u.f}: ${u.sw} role switch(es), ${u.cn} canary assertion(s)`);
  console.error('\nAdd `select ok(tests.rls_is_engaged(), ...)` after each switch. Without it,');
  console.error('a file that loses its switch passes everything while testing nothing.\n');
  process.exit(1);
}

const probe = spawnSync('psql', ['--version'], { encoding: 'utf8' });

if (!probe.error) {
  await runWithPsql();
} else {
  console.error(
    'psql was not found on PATH. Falling back to a plain Node/pg runner.\n' +
      '(Install the PostgreSQL client for the version CI actually uses, or run\n' +
      ' `supabase test db` if Docker is available, to double check with the real tool.)\n',
  );
  await runWithPg();
}

async function runWithPsql() {
  let failed = false;
  for (const file of files) {
    process.stdout.write(`\n── ${file}\n`);
    const run = spawnSync(
      'psql',
      ['--set', 'ON_ERROR_STOP=1', '--quiet', '--file', join(testDir, file), dbUrl],
      { stdio: 'inherit' },
    );
    if (run.status !== 0) {
      failed = true;
      if (!CONTINUE_ON_FAIL) break;
    }
  }
  finish(failed);
}

async function runWithPg() {
  const { default: pg } = await import('pg');
  let failed = false;

  for (const file of files) {
    process.stdout.write(`\n── ${file}\n`);
    const sql = readFileSync(join(testDir, file), 'utf8');
    const statements = splitStatements(sql);

    // Each file gets its own connection, mirroring "pg_prove runs each file in
    // its own psql session" in 000_setup_test_helpers.sql's header comment.
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();

    let fileFailed = false;
    try {
      for (const statement of statements) {
        let result;
        try {
          result = await client.query(statement);
        } catch (err) {
          console.error(`ERROR: ${err.message}`);
          console.error(`  at: ${statement.slice(0, 200)}`);
          fileFailed = true;
          break;
        }

        for (const row of result?.rows ?? []) {
          const line = Object.values(row)[0];
          if (typeof line !== 'string') continue;
          process.stdout.write(`${line}\n`);
          if (/^not ok\b/.test(line.trim())) fileFailed = true;
        }
      }
    } finally {
      await client.end();
    }

    if (fileFailed) {
      failed = true;
      if (!CONTINUE_ON_FAIL) break;
    }
  }

  finish(failed);
}

function finish(failed) {
  if (failed) {
    console.error('\nTenancy suite failed. Nothing ships until it passes.');
    process.exit(1);
  }
  console.log('\nTenancy suite passed.');
}

/* Split a SQL file into individual statements on top-level semicolons,
 * treating '...', "...", $tag$...$tag$ bodies, and -- / block comments as
 * atomic so a semicolon inside a function body or a string never splits
 * the statement it belongs to. */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const c = sql[i];

    if (c === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end + 1;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === quote && sql[j + 1] === quote) {
          j += 2;
          continue;
        }
        if (sql[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const closeIdx = sql.indexOf(tag, i + tag.length);
        const j = closeIdx === -1 ? n : closeIdx + tag.length;
        current += sql.slice(i, j);
        i = j;
        continue;
      }
    }

    if (c === ';') {
      current += c;
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }

    current += c;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);
  return statements;
}
