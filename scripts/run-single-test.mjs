// Runs specific pgTAP test files against SUPABASE_DB_URL, bypassing the full suite
// (which currently fails on an unrelated concurrent agent's in-progress work in
// 010_rls_coverage_test.sql — _probe_idx_test and gym_session_logs_current/
// gym_set_logs_current stray anon grants, nothing to do with compliance_expectations).
// Mirrors scripts/test-tenancy.mjs's runWithPg() fallback exactly.

import { readFileSync } from 'node:fs';
import pg from 'pg';

const dbUrl = process.env.SUPABASE_DB_URL;
const files = process.argv.slice(2);

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
        if (sql[j] === quote && sql[j + 1] === quote) { j += 2; continue; }
        if (sql[j] === quote) { j += 1; break; }
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

let failed = false;
for (const file of files) {
  process.stdout.write(`\n── ${file}\n`);
  const sql = readFileSync(file, 'utf8');
  const statements = splitStatements(sql);
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
        console.error(`  at: ${statement.slice(0, 300)}`);
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
  if (fileFailed) { failed = true; break; }
}

if (failed) {
  console.error('\nFAILED.');
  process.exit(1);
}
console.log('\nPASSED.');
