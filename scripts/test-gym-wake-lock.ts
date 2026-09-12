/* ATH-ADULT-09 C5 (approved 2026-09-12): the logger keeps the screen on for
 * the session and buzzes when a set logs — feature-detected, never a throw.
 */
import { readFileSync } from 'node:fs';
import { acquireWakeLock, buzz, releaseWakeLock } from '@/lib/wakeLock';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

console.log('wake lock');
{
  assert((await acquireWakeLock(undefined)) === null, 'no navigator: null');
  assert((await acquireWakeLock({})) === null, 'no Wake Lock API (a desktop browser, older Safari): null');
  assert((await acquireWakeLock({ wakeLock: { request: async () => { throw new Error('NotAllowedError'); } } })) === null, 'the browser refuses (low battery, hidden tab): null, not a throw');
  let released = 0;
  const sentinel = { release: async () => { released += 1; } };
  const got = await acquireWakeLock({ wakeLock: { request: async () => sentinel } });
  assert(got === sentinel, 'granted: the sentinel comes back');
  await releaseWakeLock(got);
  assert(released === 1, 'and release releases it');
  await releaseWakeLock(null);
  await releaseWakeLock({ release: async () => { throw new Error('already released'); } });
  assert(true, 'releasing nothing, or an already-released lock, is silent');
}

console.log('\nthe buzz');
{
  assert(buzz(undefined) === false && buzz({}) === false, 'no vibrate (iPhone Safari): false, silently');
  let got: number | number[] | null = null;
  assert(buzz({ vibrate: (p) => { got = p; return true; } }) === true && got === 10, '10 ms when the API is there');
  assert(buzz({ vibrate: () => { throw new Error('blocked'); } }) === false, 'a throwing vibrate is swallowed');
}

console.log('\nthe logger');
{
  const src = readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8');
  assert(/acquireWakeLock\(navigator\)/.test(src), 'requests the lock on open');
  assert(/document\.addEventListener\('visibilitychange'/.test(src), 're-acquires when the tab comes back');
  assert(/releaseWakeLock\(/.test(src), 'and releases on leave');
  assert(/buzz\(navigator\)/.test(src), 'buzzes when a set logs');
  const spec = readFileSync('docs/athlete/screens/05-gym-session.md', 'utf8');
  assert(/Wake Lock|stays awake|screen on/.test(spec), '05-gym-session.md records it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
