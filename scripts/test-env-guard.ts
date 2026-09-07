/* Tests for the env-file guard.
 *
 * A guard is worth what its teeth are worth. This one exists to stop the
 * 2026-09-06 incident recurring, so the central case is not "does it run" but
 * "does it fail, with a non-zero exit, on the exact file that caused it" — a
 * `.env.local` naming the production project.
 *
 * Run as a subprocess against a real temporary directory, rather than by
 * importing a function, because the exit code IS the behaviour: prebuild only
 * stops if the process stops. A test that imported a predicate would pass while
 * the guard exited 0.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const GUARD = resolve('scripts/check-env-files.ts');
const PROD = 'asbxorjytxsvrzefwzqp';
const SCRATCH = 'stfgzkuvczbpxyevxkak';
const url = (ref: string) => `NEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\n`;

/** Run the guard in a throwaway directory containing exactly `files`. */
function runIn(files: Record<string, string>): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fydr-env-guard-'));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    const r = spawnSync(process.execPath, ['--experimental-strip-types', GUARD], {
      cwd: dir,
      encoding: 'utf8',
    });
    return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('it fails on the file that actually caused the incident');
{
  const r = runIn({ '.env.local': url(PROD) });
  assert(r.code === 1, '.env.local naming production exits non-zero');
  assert(/\.env\.local/.test(r.out), 'and names the offending file');
  assert(/production/i.test(r.out), 'and says what is wrong with it');
  assert(/\.env\.production\.explicit/.test(r.out), 'and says where production is supposed to live');
}

console.log('\nand on every other file Next loads without being asked');
{
  for (const f of ['.env', '.env.development', '.env.development.local', '.env.test', '.env.test.local']) {
    assert(runIn({ [f]: url(PROD) }).code === 1, `${f} naming production exits non-zero`);
  }
}

console.log('\nit catches the file even when a good one sits above it');
{
  /* The state the app was actually in: .env.development.local held scratch and
     won, so nothing was wrong TODAY. The guard still has to fail, because the
     only thing standing between localhost and live data was a file that could
     be deleted without anybody noticing. */
  const r = runIn({ '.env.development.local': url(SCRATCH), '.env.local': url(PROD) });
  assert(r.code === 1, 'a scratch .env.development.local does not excuse a production .env.local');
}

console.log('\nit passes on the arrangement being put in place');
{
  const r = runIn({
    '.env.local': url(SCRATCH),
    '.env.development.local': url(SCRATCH),
    '.env.production.explicit': url(PROD),
  });
  assert(r.code === 0, 'scratch in the unmarked files, production in the explicit one');
  assert(/none name production/.test(r.out), 'and it says so rather than passing silently');
}

console.log('\na filename that announces production is left alone');
{
  assert(
    runIn({ '.env.production.explicit': url(PROD) }).code === 0,
    '.env.production.explicit may name production — that is the whole point of it',
  );
  assert(
    runIn({ '.env.production.local': url(PROD) }).code === 0,
    '.env.production.local too: auto-loaded by next build, but its name IS the deliberate act',
  );
}

console.log('\nno env files at all is not a failure');
{
  const r = runIn({});
  assert(r.code === 0, 'a machine with no env files passes');
  assert(/nothing to check/.test(r.out), 'and says why, rather than implying it checked something');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
