/* "One attempt left" — F2 from the ATH-ADULT-01 review, built under one
 * condition Isabella set on 2026-09-11: the failure a wrong password gets for
 * a REAL account must be indistinguishable from the failure ANY password gets
 * for an email that has no account — same field, same wording, same timing —
 * so the count cannot be used to test which emails exist.
 *
 * HOW THAT HOLDS, and what this file pins about each part:
 *
 *   THE COUNT. login_attempt_record_result (migration 0048) is keyed on the
 *   email alone and never asks whether an account exists: an unknown email
 *   gets a login_attempts row, a streak, and a lockout on exactly the same
 *   curve as a real one. So attempts_remaining is the same number at the same
 *   step for both. Pinned by reading the function body for any reference to a
 *   users table.
 *
 *   THE FIELD AND THE WORDS. The 401 body is built by failureBody(), whose
 *   only input is the limiter's record — the route cannot pass it anything it
 *   knows about the account. The warning copy is chosen from attemptsRemaining
 *   alone, and the native path carries the same number as ?a=.
 *
 *   THE TIMING. Two things made a real account's failure slower than an
 *   unknown one's — measured on scratch at ~570ms against ~435ms: the
 *   failed-sign-in audit row, which is written only for accounts that exist,
 *   and GoTrue's own bcrypt comparison, which only runs when there is a hash
 *   to compare. The first is moved off the response path with next/server's
 *   after(); the second is outside this codebase, so every failure is held to
 *   a floor — FAILED_SIGN_IN_MIN_MS from the request's start — chosen above
 *   the slow path's measured tail. The route is pinned to apply the hold
 *   before every 401 and to reference nothing account-specific between the
 *   auth call's failure and the response.
 */
import { readFileSync } from 'node:fs';
import {
  failureBody,
  FAILED_SIGN_IN_MIN_MS,
  holdUntil,
  messageForFailure,
  nativeRedirectPath,
  SIGN_IN_COPY,
} from '@/lib/signInSubmission';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const route = strip(read('src/app/auth/sign-in/route.ts'));
const form = strip(read('src/components/LoginForm/LoginForm.tsx'));

console.log('1. the count is the same number for any email');
{
  const sql = read('supabase/migrations/0048_login_attempts.sql');
  const start = sql.indexOf('create or replace function public.login_attempt_record_result');
  const body = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  const code = body.replace(/--.*$/gm, '');
  assert(body.length > 0, 'login_attempt_record_result is where attempts_remaining comes from');
  assert(!/\busers\b|auth\.users|athletes/.test(code), 'and it never asks whether the email has an account — keyed on the email alone');
  assert(/greatest\(v_threshold - v_row\.attempt_count, 0\)/.test(code), 'attempts_remaining is threshold minus the streak, the same arithmetic for every row');
}

console.log('\n2. the field and the words come from the record alone');
{
  const a = failureBody({ is_locked: false, locked_until: '', seconds_remaining: 0, attempts_remaining: 1 });
  const b = failureBody({ is_locked: false, locked_until: '', seconds_remaining: 0, attempts_remaining: 1 });
  assert(JSON.stringify(a) === JSON.stringify(b), 'two failures at the same step produce byte-identical bodies');
  assert(a.ok === false && a.locked === false && a.error === SIGN_IN_COPY.invalid && a.attemptsRemaining === 1, 'ok:false, locked:false, the generic wording, and the count');
  assert(failureBody(undefined).attemptsRemaining === null, 'when the limiter was unavailable the count is null — for every email alike');
  assert(failureBody.length === 1, 'failureBody takes the record and nothing else — there is no argument through which the account could leak');
  assert(messageForFailure(1) === SIGN_IN_COPY.lastAttempt, 'at one attempt left the form says so');
  assert(SIGN_IN_COPY.lastAttempt === 'That did not match. One attempt left before a short wait.', 'in the board\'s words');
  for (const n of [null, 4, 3, 2, 0, 5]) assert(messageForFailure(n) === SIGN_IN_COPY.invalid, `at ${n === null ? 'null' : n} it is the generic refusal`);
  assert(nativeRedirectPath({ kind: 'invalid', attemptsRemaining: 1 }, null) === '/login?e=invalid&a=1', 'a native submit carries the count as ?a=');
  assert(nativeRedirectPath({ kind: 'invalid', attemptsRemaining: null }, null) === '/login?e=invalid', 'and nothing when there is none');
  assert(/messageForFailure\(/.test(form) && /params\.get\('a'\)/.test(form) && /result\.attemptsRemaining/.test(form), 'LoginForm turns both the JSON count and the ?a= count into the same message through the same function');
  assert(/data-tone=\{tone\}/.test(form) && /message === SIGN_IN_COPY\.lastAttempt \? 'warn' : 'bad'/.test(form), 'and marks the warning warn, everything else bad');
  const css = strip(read('src/styles/base.css'));
  const warn = /\.launch \.form-error\[data-tone='warn'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/var\(--wash-warn\)/.test(warn) && /var\(--border-warn\)/.test(warn), 'the phone banner takes the warn tone from --wash-warn / --border-warn');
  assert(/\.launch \.form-error\[data-tone='warn'\]::before\s*\{[^}]*var\(--warn\)/.test(css), 'with a --warn dot');
}

console.log('\n3. the timing: nothing account-specific stands between the auth failure and the 401');
{
  const failIdx = route.indexOf('const { data: signInData, error: signInError }');
  const invalidIdx = route.indexOf("answer({ kind: 'invalid'");
  assert(failIdx > 0 && invalidIdx > failIdx, 'the 401 is answered after the auth call');
  const between = route.slice(failIdx, invalidIdx);
  assert(/after\(\(\) =>[\s\S]*?recordSignInFailure\(/.test(between), 'the failed-sign-in audit row is written in after(), off the response path');
  assert(!/await recordSignInFailure\(/.test(route), 'and is never awaited before responding');
  assert(/import \{[^}]*\bafter\b[^}]*\} from 'next\/server'/.test(route), 'after comes from next/server');
  const hold = between.lastIndexOf('await holdUntil(startedAt, FAILED_SIGN_IN_MIN_MS)');
  assert(hold > 0, 'every failure is held to the floor before the 401');
  assert(/const startedAt = Date\.now\(\);/.test(route.slice(0, failIdx)), 'measured from the request\'s start, not from the auth call');
  const afterHold = between.slice(hold);
  assert(!/userRow|signInError\.message|signInError\.status/.test(afterHold), 'and after the hold, nothing about the account is read before answering');
  assert(!/record\?\.is_locked[\s\S]*?holdUntil/.test(afterHold), 'the lockout answer (per email, before any account is known) is not delayed by the floor');
}

console.log('\n4. the floor itself');
{
  assert(Number.isInteger(FAILED_SIGN_IN_MIN_MS) && FAILED_SIGN_IN_MIN_MS >= 700, `the floor is ${FAILED_SIGN_IN_MIN_MS}ms, above the slow path measured on scratch (570ms typical, 860ms first hit)`);
  const t0 = Date.now();
  await holdUntil(t0, 120);
  const waited = Date.now() - t0;
  assert(waited >= 118, `holdUntil waits out the remainder of the floor (${waited}ms for a 120ms floor)`);
  const t1 = Date.now() - 500;
  const before = Date.now();
  await holdUntil(t1, 120);
  assert(Date.now() - before < 30, 'and does not wait at all once the floor has already passed');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
