/* Apply pending migrations to the database in SUPABASE_DB_URL.
 *
 *   npm run db:push
 *
 * A wrapper rather than a bare CLI call, for three reasons:
 *
 *  1. The URL carries a password. Sourcing it here keeps it out of the shell
 *     history and out of any transcript of the command that ran.
 *  2. The CLI version is PINNED, the same lesson package.json's `deploy` script
 *     records: a bare `npx supabase` resolves the `latest` dist-tag, and a
 *     `latest` that moves mid-session is how a deploy broke before. Bump the pin
 *     deliberately; never unpin. See docs/05-architecture.md §4.1.
 *  3. It prints WHICH database it is about to touch before it touches it. Host
 *     and database name only, never the credentials — enough to notice you are
 *     pointed at production when you meant a local stack.
 */
import { execFileSync } from 'node:child_process';

const SUPABASE_CLI = 'supabase@2.116.0';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Expected it in .env.local.');
  process.exit(1);
}

let target = '(unparseable URL)';
try {
  const u = new URL(url);
  target = `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
} catch {
  /* fall through with the placeholder — never echo the raw URL */
}
const local = /^(127\.0\.0\.1|localhost)/.test(target);
console.log(`\nApplying migrations to: ${target}${local ? '  (local)' : '  ← NOT local'}\n`);

try {
  execFileSync('npx', ['--yes', SUPABASE_CLI, 'db', 'push', '--db-url', url, '--yes'], {
    stdio: 'inherit',
  });
} catch (err) {
  console.error(`\nMigration push failed (exit ${err.status ?? 'unknown'}).`);
  process.exit(err.status ?? 1);
}
