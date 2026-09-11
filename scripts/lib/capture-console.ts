/* Capture console.error for the duration of a test case that EXPECTS a
 * failure — §0ao, filed 2026-09-11, built 2026-09-12.
 *
 * The code under test logs the errors it swallows (recordSignIn's "audit
 * write failed, sign-in itself unaffected" and friends). That is right at
 * runtime and wrong in a build log: a suite that feeds those functions a
 * client that throws printed ~50 "error" lines and stack traces per build,
 * Vercel flagged them, and a real error among them would go unread.
 *
 * So a case that expects a failure wraps it here, gets back what was logged,
 * and ASSERTS on it — the message is part of the behaviour under test, so
 * asserting it is strictly better than printing it. console.error is
 * replaced only inside the callback and restored in `finally`, never
 * silenced globally: a suite that went quiet by suppression would hide the
 * very thing this is about, and an unexpected error outside a capture still
 * prints as loudly as before.
 */

export type Captured<T> = { result: T; logged: string[] };

const render = (args: unknown[]): string =>
  args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');

/** Run `fn` with console.error captured. Each call becomes one string in
 *  `logged` — the message and, for an Error argument, `name: message` (no
 *  stack: the frames were the noise). Restored whatever `fn` does. */
export async function captureConsoleError<T>(fn: () => Promise<T> | T): Promise<Captured<T>> {
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(render(args)); };
  try {
    return { result: await fn(), logged };
  } finally {
    console.error = original;
  }
}
