# Deploy record — 15 September 2026

**Deployed and live.** Commit `49da9ee` (head of `build/walkthrough`,
containing the merged reviewer branch), deployment
`dpl_E9fk3TwtkDxVR6tRxz5RiQQ1CiQZ` = `fydr-7n84eodqg-fydr.vercel.app`,
region `dub1`, aliased `https://fydr.app` and `https://www.fydr.app`,
`aliasError` null. Deployed from the CLI, pinned `vercel@59.11.0`, out of a
fresh `../fydr-deploy` worktree at the approved commit with a clean
`git status`.

Previous production was `e28c750`. This deploy closed a gap of 37 commits
and five migrations.

## Migrations applied to production

`0128` body mass flaggable · `0129` remove the consent backfill · `0130`
test assignments · `0131` body mass rules · `0132` programme assignment
dates.

Read-only `migration list` beforehand showed `0127` on both sides and
exactly those five remote-missing, and nothing else. `npm run db:push`
listed the same five and no others. `verify:tier-rls` 14 passed, 0 failed,
with the withdrawal path confirmed open.

Data these carried into production: a new default threshold rule backfilled
into every configured organisation (0128); athletes previously treated as
consented returned to the consent flow (0129, as ruled); every test
definition assigned to the whole squad (0130); existing programme
assignments left deliberately unmapped with "Set start date" (0132). All 46
production accounts are synthetic; no club is on it.

## What went right that had gone wrong before

- **The alias was verified against Vercel, not against a 200.** A `curl` to
  `/login` returns 200 whether or not the alias moved; on 11 September a
  deploy succeeded while `fydr.app` stayed on the previous build. The check
  that counts is the deployment's own `alias` list and `aliasError`.
- **`vercel link` was followed by a `project.json` comparison** before the
  deploy ran. That flag combination created a stray project once.
- **No command passed `SUPABASE_DB_URL` as a bare argument.** The read-only
  migration list ran through `scratchpad/migration-list.mjs`, which redacts
  the connection string from both output streams. An inline command leaked
  the production password into the terminal on 11 September and the password
  had to be rotated.
- **No rollback command appeared anywhere in the sequence.** On 11 September
  one was pasted along with the rest and ran.

## Order changed from the plan, deliberately

Five known fixes (a September `Intl` hydration mismatch on
`/reports/athlete/[id]`, the rated-session database trigger, the athlete
programme screen header, five org-unscoped pgTAP files, a caption for a
drag gesture that was never built) were scheduled to land *before* this
deploy. Isabella shipped first instead. That was the better call: none of
the five is a regression this batch introduced, the hydration bug was
already live, and closing a 37-commit gap and then shipping five small
fixes is easier to reason about than shipping 42 commits at once.

Known and accepted while those fixes are outstanding: the programme screen
header names one block while listing every live block's sessions, visible
in production from tonight because 0132 shipped. Cosmetic until a real club
exists.

## Post-deploy checks, all passed

The streaming skeleton's hold and floor on `/reports/gps`; an existing
programme assignment reading "Set start date"; the new not-found screen
readable in dark; a synthetic athlete landing on the consent flow.

## Noted, not acted on

`verify:tier-rls` reports **34 `healthkit_sync` consent rows still on
production**, recording consent for an integration removed from the product
entirely. Harmless, but they should not be sitting in a production consent
table during the lawful-basis conversation with a solicitor.
