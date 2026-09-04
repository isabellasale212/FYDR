---
description: Re-read the code against the specification and report differences. Changes nothing.
---

Compare the current code against the binding specification and report what has
drifted. **Change nothing.** This command reports; it does not fix.

## What to check, in this order

**1. Access.** For every page under `src/app/(staff)/`, establish the roles that
can actually reach it, then compare with `docs/access-matrix.md`.

A page's guard appears in **three** patterns, and a scan that looks for only the
first will under-report:

- a call to a named guard: `requireStaff`, `requireReportAccess`,
  `requireSubjectAccess`, `loadAthleteDomainContext`
- an inline redirect on a role test, for example
  `if (!claims.roles.includes('medical')) redirect(...)`
- a `hasAccess` variable used to render a refusal in place of the page

Counting how often a file mentions a role is **not** a way to detect a guard: it
cannot tell a guard from a comment. This mistake was made once and produced a
false finding.

Report any page whose real access differs from the matrix, and any page reachable
by a role the matrix marks X.

**2. Metrics.** For every metric in `docs/metrics.md`, check the implementation
location still exists and the formula still matches. Report:

- a formula that has changed without its registry entry changing
- a metric whose implementation location no longer exists
- a number displayed on a screen with no registry entry
- **two implementations of the same named quantity**, which is the failure the
  registry exists to catch

**3. Screens.** For each file in `docs/screens/`, check that the page still
exists at the stated address, and that section 6's controls still match what the
page renders. Report controls that have appeared, disappeared, or changed what
they write.

**4. Row level security.** Confirm every table created in
`supabase/migrations/` still has row level security enabled and at least one
policy. Note that enabling is often done in bulk loops inside `do $$ ... $$`
blocks, not one statement per table.

**5. Resolved items.** Check whether anything in `docs/spec-gaps.md` has since
been fixed, and anything in `docs/decisions-required.md` has since been answered
in code.

## How to report

Group by the five headings above. For each difference give: what the
specification says, what the code does, the files and line numbers, and whether
it looks like drift or a deliberate change nobody recorded.

**Rank by risk**, highest first, on the same scale `docs/spec-gaps.md` uses:
data exposure, then loss or corruption, then misleading a coach, then missing,
then cosmetic.

**Never guess.** If something cannot be established from the code, write
`UNVERIFIED: not found` and list the files searched. A false finding costs more
than a missing one, because it sends somebody to fix working code.

**End with the counts**: pages checked, differences found by risk band, and
unverified items.
