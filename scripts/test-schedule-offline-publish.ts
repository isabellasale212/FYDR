/* §0al — a network failure at publish loses nothing. Decided by Isabella
 * 2026-09-11 ("persist pending edits in sessionStorage, and never
 * router.refresh() after a network failure"), built 2026-09-12.
 *
 * Two halves, both pinned here:
 *   1. The four pieces of pending state — edits, added, removed, newDraft —
 *      round-trip through sessionStorage (pending.ts), restored on mount and
 *      cleared when the state empties (a successful publish, a Discard).
 *      Exercised for real against a fake store below; the workspace's wiring
 *      is read from source, since this repo has no React test renderer.
 *   2. handlePublish does not call router.refresh() after a NETWORK failure —
 *      a TypeError: Failed to fetch (Chrome), Load failed (Safari),
 *      NetworkError (Firefox) — because nothing was written and a refresh
 *      offline is the full-page reload that wiped the week. Every other
 *      failure keeps the refresh, for the partial-publish case
 *      test-schedule-publish-reset.ts exists for.
 */
import { readFileSync } from 'node:fs';
import {
  clearPending,
  isEmptyPending,
  isNetworkFailure,
  pendingKey,
  readPending,
  writePending,
  type PendingStore,
  type PendingWeek,
} from '@/components/ScheduleGrid/pending';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

const fakeStore = (): PendingStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
};
const draft = { id: 'new-1', dow: '2026-09-14', start: 9, mins: 60, title: 'Reviewer publish test', type: 'training' as const, location: null, mdOffset: null, groupIds: ['g1'] };
const full: PendingWeek = {
  edits: { 'abc': { start: 9.5, title: 'Moved' } },
  added: [draft],
  removed: { 'def': true },
  newDraft: { ...draft, id: 'new-2', title: '' },
};

console.log('1. the pending week round-trips through the store');
{
  const store = fakeStore();
  const key = pendingKey('org-1', '2026-09-14');
  assert(key === 'fydr-schedule-pending:org-1:2026-09-14', 'one key per organisation and week');
  assert(readPending(store, key) === null, 'nothing stored reads as null');
  writePending(store, key, full);
  const back = readPending(store, key);
  assert(JSON.stringify(back) === JSON.stringify(full), 'edits, added, removed and newDraft all come back as written');
  writePending(store, key, { edits: {}, added: [], removed: {}, newDraft: null });
  assert(!store.data.has(key) && readPending(store, key) === null, 'writing an empty week removes the key — a successful publish or a Discard empties the store by construction');
  writePending(store, key, full);
  clearPending(store, key);
  assert(!store.data.has(key), 'clearPending removes it outright');
  assert(isEmptyPending({ edits: {}, added: [], removed: {}, newDraft: null }) && !isEmptyPending({ edits: {}, added: [], removed: {}, newDraft: draft }), 'a lone half-filled new draft counts as pending');
}

console.log('\n   and refuses what it did not write');
{
  const store = fakeStore();
  const key = pendingKey('org-1', '2026-09-14');
  store.setItem(key, '{not json');
  assert(readPending(store, key) === null, 'unparseable → null, not a throw');
  store.setItem(key, JSON.stringify({ edits: [], added: {}, removed: {}, newDraft: null }));
  assert(readPending(store, key) === null, 'the wrong shape → null');
  store.setItem(key, JSON.stringify({ edits: {}, added: [], removed: {}, newDraft: null }));
  assert(readPending(store, key) === null, 'an empty week → null (nothing to restore)');
  const throwing: PendingStore = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('SecurityError'); } };
  let threw = false;
  try { readPending(throwing, key); writePending(throwing, key, full); clearPending(throwing, key); } catch { threw = true; }
  assert(!threw, 'a store that throws (Safari private mode, quota) never breaks the page — the in-memory state is still the truth');
}

console.log('\n2. a network failure is told apart from a server refusal');
{
  assert(isNetworkFailure(new TypeError('Failed to fetch')), 'Chrome: TypeError: Failed to fetch');
  assert(isNetworkFailure(new TypeError('Load failed')), 'Safari: TypeError: Load failed');
  assert(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.')), 'Firefox: NetworkError');
  assert(isNetworkFailure('TypeError: Failed to fetch'), 'and the message string a query helper returns');
  assert(!isNetworkFailure(new Error('No current season is set up for this club.')), 'a server-side refusal is not');
  assert(!isNetworkFailure('duplicate key value violates unique constraint'), 'nor a constraint');
  assert(!isNetworkFailure('This session changed since you opened it.'), 'nor an optimistic-lock conflict');
  assert(!isNetworkFailure(undefined) && !isNetworkFailure(42), 'nor nothing');
}

console.log('\n3. the workspace is wired to both halves');
{
  const src = readFileSync('src/components/ScheduleGrid/ScheduleWorkspace.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
  assert(/from '\.\/pending'/.test(src) && /readPending\(/.test(src) && /writePending\(/.test(src), 'it reads and writes the pending week through pending.ts');
  assert(/pendingKey\(orgId, weekStart\)/.test(src), 'under the key for this organisation and week');
  assert(/readPending\(window\.sessionStorage/.test(src) && /writePending\(window\.sessionStorage/.test(src), 'in sessionStorage — this tab\'s editing session, not localStorage');
  assert(/const \[restored, setRestored\] = useState\(false\)/.test(src) && /if \(!restored\) return;/.test(src), 'the write effect waits for the restore, so the initial empty state cannot overwrite a saved week');
  assert(/setEdits\(pending\.edits\)/.test(src) && /setAdded\(pending\.added\)/.test(src) && /setRemoved\(pending\.removed\)/.test(src) && /setNewDraft\(pending\.newDraft\)/.test(src), 'all four pieces are restored');
  assert(/clearPending\(window\.sessionStorage, storageKey\)/.test(src), 'Discard clears the store explicitly, as well as by emptying the state');

  const body = src.slice(src.indexOf('async function handlePublish'));
  const fn = body.slice(0, body.indexOf('\n  }\n') + 4);
  assert(/let networkFailed = false;/.test(fn), 'handlePublish tracks whether the failure was the network');
  assert(/catch \(error\) \{[\s\S]*?networkFailed = isNetworkFailure\(error\);/.test(fn), 'set from the thrown value in catch');
  assert(/failures\.some\(\(f\) => isNetworkFailure\(f\)\)/.test(fn), 'and from a returned "Failed to fetch" message, which also means nothing was written');
  const fin = fn.slice(fn.search(/\bfinally\s*\{/));
  assert(/setPublishing\(false\);/.test(fin), 'the button is re-enabled whatever happened (test-schedule-publish-reset.ts)');
  assert(/if \(!networkFailed\) router\.refresh\(\);/.test(fin), 'and router.refresh() runs only when the failure was NOT the network — offline it is the reload that wiped the week');
  assert(!/^\s*router\.refresh\(\);\s*$/m.test(fin), 'no unconditional refresh remains in finally');
}

console.log('\n4. the spec says so');
{
  const spec = readFileSync('docs/screens/07-schedule.md', 'utf8');
  assert(/sessionStorage/.test(spec) && !/Unsaved edits are lost if the connection drops/.test(spec), '07-schedule.md\'s Offline paragraph describes the kept week, not the loss');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
