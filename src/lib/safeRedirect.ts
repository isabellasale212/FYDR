/** Only a same-origin, relative path is a safe redirect target for the
 *  `?next=` query param on /login and /login/mfa. Both pages read it
 *  straight from the URL and hand it to `router.replace()` after a real,
 *  successful sign-in — with no validation, an attacker could send
 *  `/login?next=https://evil.example/fake-login`, the victim would sign in
 *  for real (real domain, real cert), and be hard-navigated off-site
 *  immediately afterward, landing on a page that looks like it's asking
 *  them to "sign in again" to harvest credentials.
 *
 *  middleware.ts's own `next` (set from the current request's own
 *  `pathname + search` when it redirects an unauthenticated visitor to
 *  /login) is always same-origin by construction and doesn't need this —
 *  this guards the value once it comes back off a URL a user could have
 *  been sent by anyone. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  // Must start with exactly one '/' — not a scheme ("https://…",
  // "javascript:…") and not protocol-relative ("//evil.example", which
  // the browser resolves as "https://evil.example").
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  // Some browsers normalise a leading backslash to a forward slash before
  // resolving the URL, making "/\evil.example" behave like "//evil.example".
  if (next.startsWith('/\\')) return '/';
  return next;
}
