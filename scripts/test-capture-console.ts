/* The capture helper itself, §0ao: it captures only inside the callback,
 * restores on every path, and never suppresses an error it was not asked to
 * catch. Also the build-log claim: the suites that expect failures print no
 * "error" lines any more — checked by running the one that used to, with
 * stderr collected. */
import { spawnSync } from 'node:child_process';
import { captureConsoleError } from './lib/capture-console';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

console.log('the helper captures, renders, and restores');
{
  const original = console.error;
  const { result, logged } = await captureConsoleError(async () => {
    console.error('audit write failed', new Error('audit down'));
    console.error('skipped', { hasOrg: false });
    return 42;
  });
  assert(result === 42, 'the callback\'s result comes back');
  assert(logged.length === 2, 'each console.error call is one entry');
  assert(logged[0] === 'audit write failed Error: audit down', 'an Error argument renders as name: message, no stack');
  assert(logged[1] === 'skipped {"hasOrg":false}', 'an object argument renders as JSON');
  assert(console.error === original, 'console.error is restored afterwards');

  let threw = false;
  try { await captureConsoleError(() => { throw new Error('boom'); }); } catch { threw = true; }
  assert(threw && console.error === original, 'a throwing callback still restores it (finally), and the throw propagates');

  const sync = await captureConsoleError(() => { console.error('sync'); return 'ok'; });
  assert(sync.result === 'ok' && sync.logged[0] === 'sync', 'a synchronous callback works too');
}

console.log('\nthe suites that expect failures no longer print them');
{
  /* Run the suite that produced ~21 stderr lines per build and collect its
     stderr. Node's own module-type warning is not the subject and is
     filtered; anything else on stderr is a failure of this item. */
  /* spawnSync, not execFileSync: the latter hands back stderr only when the
     child fails, and the first version of this assertion passed on a suite
     that was still printing 21 lines. */
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './scripts/lib/register-ts-aliases.mjs', 'scripts/test-sign-in-audit.ts'], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  assert(run.status === 0, `test-sign-in-audit.ts exits 0 (status ${run.status})`);
  const noise = (run.stderr ?? '').split('\n').filter((l) => l.trim() !== '' && !/MODULE_TYPELESS_PACKAGE_JSON|Reparsing as ES module|trace-warnings|add "type": "module"/.test(l));
  assert(noise.length === 0, noise.length === 0 ? 'test-sign-in-audit.ts writes nothing to stderr' : `stderr still carries ${noise.length} line(s): ${noise[0]}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
