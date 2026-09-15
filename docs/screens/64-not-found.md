# 64. Not found

## 1. Page name and URL

**Not found** — three files, one set of words. Built 15 September 2026
(Isabella, `decisions/decision-batch-2026-09-15.md` #3).

- `src/app/(staff)/not-found.tsx` — inside the staff shell (sidebar, the phone
  tab bar), wherever a page under `(staff)` calls `notFound()`.
- `src/app/(athlete)/not-found.tsx` — inside the athlete shell (tab bar, the
  layout's Back button), wherever a page under `(athlete)` calls `notFound()`.
- `src/app/not-found.tsx` — outside either shell, for an address that matches
  no route at all. A route group owns no URL prefix, so Next cannot know whose
  shell a stray address belongs to; the same words, on the tokens.

The words live once, in `src/lib/notFoundCopy.ts`, so the three cannot drift.

## 2. Who can access this page

Anyone who reaches it: the shells require a session (their layouts do), the
root one does not. It reads nothing and reveals nothing.

## 3. How you get here

`notFound()` is called in 25 places: a malformed id in the address (checked
after authentication, so it is never a probe), a row that the club's row-level
security did not return, a gym session that is not this athlete's, an injury
in another club. Or a typed address that matches nothing.

## 4. What you see

Eyebrow **Not found**. Title **There is nothing here**. One sentence: *It may
have been removed, or the link may be out of date. If someone sent you the
link, ask them to check it.* One primary action: the shell's own home —
**Go to Today** (athlete), **Go to the dashboard** (staff), **Go to Fydr**
(root; `/` sends a signed-in person to their own home and everyone else to
sign in).

**Honest means vague here, on purpose.** The screen catches two things and
must not tell them apart: a thing that was removed, and a thing that exists
but belongs to someone else. Every self-only read is RLS self-only, so the
missing row and the foreign row arrive as the same empty result, and the
words must not undo that: the rule set for the gym session
(`docs/athlete/screens/09-one-gym-session-logged.md` §10 — "a 403 would
confirm the row exists") applies to every not-found. Never "you cannot see
this", never "no permission", never a status code.

**Readable in both themes.** Next's default not-found was black text that
does not read the app's theme; on the athlete app's dark ground it measured
1.23:1 (the a11y sweep, C1–C2). These three inherit the tokens like any other
screen. Measured 15 September on the dev server: title 14.6:1 light /
11.8:1 dark, body 17.9 / 12.7, the button 8.6 / 4.8; the button 50px.

**The head is the shell's own.** Staff: the `topbar` / `page-head` frame the
denied screen uses (PATTERN-S6 C7), its sibling. Athlete: the `hd` head
`/me/status` draws, the card below.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Control | Where | What it does |
|---|---|---|
| Go to Today / Go to the dashboard / Go to Fydr | The card | A link to the shell's home |

## 7. How this page is built, in plain English

Three `not-found.tsx` files (Next's convention: the nearest one up the tree
renders when `notFound()` is thrown; the root one also serves every
unmatched address). They render nothing dynamic and read no data. The
response is a `404` where the page had not started streaming, and a `200`
with the not-found body where it had (a route with a `loading.tsx`
skeleton) — Next's documented behaviour, and the reason the athlete profile's
not-found arrives as a 200. The browser tab keeps the page's own title where
the page declared one; the root one is "Not found · Fydr".

Guard: `scripts/test-not-found.ts` (prebuild) — the three files exist, share
the copy module, name no permission and no status code, and link to their
shell's home.

## 8. Open issues

- A page's own static `metadata` wins over the not-found's inside a segment,
  so the staff athlete page's not-found is titled "Athlete · Fydr". Cosmetic;
  left.
- On a non-streamed 404 the dev console warns "Encountered a script tag while
  rendering React component" — the root layout's theme script being
  re-created on the client by Next's not-found handling, not these files.
  Pre-existing; dev only; noted, not fixed.
