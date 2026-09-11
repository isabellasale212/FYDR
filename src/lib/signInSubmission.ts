/* The sign-in form's two ways of arriving at /auth/sign-in, and the promise
 * that neither can put a password in a URL.
 *
 * WHAT HAPPENED. LoginForm.tsx was `<form onSubmit={onSubmit} noValidate>` —
 * no method, no action. React's onSubmit does preventDefault and fetches JSON,
 * so once the page has hydrated the browser never submits the form itself.
 * BEFORE it has hydrated the browser is the only thing listening, and a form
 * with no method submits as GET to its own URL with every field in the query
 * string. On 2026-09-11 that produced `/login?email=…&password=…` three times
 * over: into the browser history, into the dev server's request log, into
 * any access log in front of a deployment. Anything that delays hydration
 * reproduces it — a slow connection, a blocked script, a first compile.
 *
 * THE FIX IS TWO ATTRIBUTES AND ONE ROUTE. `method="post"` means a native
 * submit carries the fields in the request body, never the URL. `action=
 * "/auth/sign-in"` means it carries them to the route the fetch already uses,
 * so a pre-hydration submit signs the athlete in rather than dead-ending on a
 * JSON 400. The route reads a form-encoded body the same way it reads JSON,
 * and answers a native submit with a redirect rather than JSON, because the
 * browser is going to navigate to whatever comes back.
 *
 * THE COST OF ACCEPTING A FORM BODY, and why isSameOriginSubmit exists. A
 * JSON-only route was cross-site-safe for free: no HTML form can send
 * application/json, and a fetch with that content type triggers a preflight
 * this route never answers. A form-encoded body is exactly what any site's
 * <form action="https://fydr…/auth/sign-in"> sends, which is login CSRF — a
 * victim signed into the attacker's account without knowing it. So a native
 * submit is accepted only when the browser's Origin header names this host.
 * Browsers always send Origin on a POST form submission; the JSON path is not
 * subject to the check because it never needed it.
 *
 * Everything here is pure so the tests can exercise it without Next. */
import { safeNextPath } from '@/lib/safeRedirect';

export type SignInSubmission = {
  email: string;
  password: string;
  /** Where to go afterwards. Only a native submit carries it (a hidden field);
   *  the fetch path reads it from the page URL client-side, as before. */
  next: string | null;
  /** True when the browser submitted the form itself — the body was
   *  form-encoded, and the answer must be a navigation, not JSON. */
  native: boolean;
};

/** The failure copy, in one place so the route and the form cannot drift:
 *  the route sends these to the fetch path as JSON, and to the native path as
 *  a code in the redirect URL that the form turns back into the same words. */
export const SIGN_IN_COPY = {
  missing: 'Enter your email and password.',
  invalid: 'That email and password do not match an account.',
  locked: 'Too many attempts.',
  'no-roles': 'That account holds no role in any club. Ask your club administrator to grant one.',
  /** Not a code — the form's own wording for the last step before a lockout,
   *  chosen from the count rather than sent by the route. See messageForFailure. */
  lastAttempt: 'That did not match. One attempt left before a short wait.',
} as const;

export type SignInErrorCode = 'missing' | 'invalid' | 'locked' | 'no-roles';
const ERROR_CODES: ReadonlySet<string> = new Set<SignInErrorCode>(['missing', 'invalid', 'locked', 'no-roles']);

export function isSignInErrorCode(value: string | null | undefined): value is SignInErrorCode {
  return value !== null && value !== undefined && ERROR_CODES.has(value);
}

/* ---------------------------------------------------------------------------
 * "One attempt left" — F2 from the ATH-ADULT-01 review — and the condition it
 * was built under: a real account's wrong password and an unknown email's any
 * password must be indistinguishable. Same field, same words, same timing.
 *
 * THE COUNT IS SAFE TO SHOW because login_attempt_record_result (0048) is
 * keyed on the email alone: an address with no account gets a row, a streak
 * and a lockout on the same curve as one that exists, so attempts_remaining
 * is the same number at the same step either way.
 *
 * THE BODY IS BUILT FROM THE RECORD ALONE — failureBody has no other input,
 * so the route cannot pass it what it knows about the account.
 *
 * THE TIMING is the part outside the limiter. Measured on scratch before this
 * was built: ~570ms for a real account's failure against ~435ms for an
 * unknown email. Two causes. The failed-sign-in audit row is written only for
 * accounts that exist — the route now writes it in next/server's after(), off
 * the response path. And GoTrue only runs bcrypt when there is a hash to
 * compare — that is not ours to change, so every failure is held to a floor
 * from the request's start. The floor is above the slow path's tail as
 * measured, and a failed sign-in taking three quarters of a second is a
 * cost only a wrong password pays.
 * ------------------------------------------------------------------------ */

export const FAILED_SIGN_IN_MIN_MS = 800;

/** Waits out whatever remains of `minMs` since `startedAt`. Nothing if it has
 *  already passed. */
export function holdUntil(startedAt: number, minMs: number): Promise<void> {
  const remaining = startedAt + minMs - Date.now();
  return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
}

export type LimiterRecord = {
  is_locked: boolean;
  locked_until: string;
  seconds_remaining: number;
  attempts_remaining: number;
};

export type SignInFailure = { ok: false; locked: false; error: string; attemptsRemaining: number | null };

/** The 401 body. Its only input is the limiter's record; null when the
 *  limiter was unavailable, which is the same null for every email. */
export function failureBody(record: LimiterRecord | undefined): SignInFailure {
  return {
    ok: false,
    locked: false,
    error: SIGN_IN_COPY.invalid,
    attemptsRemaining: typeof record?.attempts_remaining === 'number' ? record.attempts_remaining : null,
  };
}

/** What the form shows for a failure, from the count alone. One attempt left
 *  is the only step that says anything beyond the generic refusal: the board
 *  draws the warning there and nowhere earlier. */
export function messageForFailure(attemptsRemaining: number | null | undefined): string {
  return attemptsRemaining === 1 ? SIGN_IN_COPY.lastAttempt : SIGN_IN_COPY.invalid;
}

const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data'];

export function isNativeFormSubmit(headers: Headers): boolean {
  const type = (headers.get('content-type') ?? '').toLowerCase();
  return FORM_TYPES.some((t) => type.startsWith(t));
}

/** Reads email, password and next from either body shape. Never throws: an
 *  unreadable body is an empty submission, which the route answers with the
 *  same "Enter your email and password" it always has. The password is never
 *  trimmed — whitespace in a password is part of the password. */
export async function readSignInSubmission(request: Request): Promise<SignInSubmission> {
  const native = isNativeFormSubmit(request.headers);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');

  if (native) {
    const form = await request.formData().catch(() => null);
    return {
      email: str(form?.get('email')).trim(),
      password: str(form?.get('password')),
      next: form?.get('next') ? str(form.get('next')) : null,
      native: true,
    };
  }

  const body = await request.json().catch(() => null);
  return {
    email: str(body?.email).trim(),
    password: str(body?.password),
    next: null,
    native: false,
  };
}

/** A browser form POST always carries Origin. It must name this host — the one
 *  the request arrived at (Host), or the one the platform says it arrived at
 *  (X-Forwarded-Host, which a browser cannot set and a cross-site form cannot
 *  influence). No Origin, or another host, is not a submission from our page. */
export function isSameOriginSubmit(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  if (!originHost) return false;
  const hosts = [headers.get('x-forwarded-host'), headers.get('host')]
    .filter((h): h is string => typeof h === 'string' && h.length > 0)
    .map((h) => h.split(',')[0]!.trim().toLowerCase());
  return hosts.includes(originHost);
}

export type NativeOutcome =
  | { kind: 'ok' }
  | { kind: 'mfa' }
  | { kind: 'locked'; secondsRemaining: number }
  | { kind: 'invalid'; attemptsRemaining: number | null }
  | { kind: 'missing' };

/** Where a native submit lands. Built from the OUTCOME and the requested
 *  destination only — the credentials are not an input, so no path this
 *  returns can carry them. `next` goes through the same open-redirect guard
 *  the client path uses. */
export function nativeRedirectPath(outcome: NativeOutcome, next: string | null): string {
  const dest = safeNextPath(next);
  if (outcome.kind === 'ok') return dest;
  if (outcome.kind === 'mfa') return `/login/mfa?next=${encodeURIComponent(dest)}`;

  const q = new URLSearchParams();
  q.set('e', outcome.kind);
  if (outcome.kind === 'locked') q.set('s', String(Math.max(0, Math.floor(outcome.secondsRemaining))));
  if (outcome.kind === 'invalid' && outcome.attemptsRemaining !== null) q.set('a', String(outcome.attemptsRemaining));
  if (dest !== '/') q.set('next', dest);
  return `/login?${q.toString()}`;
}
