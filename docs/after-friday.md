# After Friday — everything deferred for the 18 September meeting

Frozen 15 September. Nothing on this list is worked on before the Scottish
Rugby meeting on Friday 18 September. Added to, not worked from, until then.

The Friday plan itself is in `docs/friday-demo-checklist.md`.

## Product and code

- **The shell costs 217–456ms before anything paints**, in the same region
  as the database, and is now the largest single cost on most screens.
  Bigger prize than any remaining render work. `decisions/skeleton-gate.md`,
  final section.
- **The `$RT` react-dom internal** used by the skeleton floor's hard-load
  path. Pinned by guard; confirm the guard's failure mode degrades to "floor
  not enforced on a hard load" and never to a crash.
- **The 23 tap targets short at 1440 only.** Not defects under ruling #8
  (44px is a touch rule). On record if that ruling ever changes.
- **Accessibility "other findings", 7.** None of the three classes.
- **The five remaining Class 3 defects** (colour as the only carrier) if
  step 2 does not reach them.
- **`--muted-on-tint` on the athlete's tinted grounds** — measure properly
  rather than swapping to `--text` by default.
- **The LEGAL-\* placeholder refs are 10px.** Too small whatever the
  contrast. They may disappear when the legal text lands.
- **PATTERN-S3's board files still say the coach's pitch-side form carries
  availability**, contradicting the confirmed database rule. Design folders
  are read-only to the builder — Isabella or the design manager.
- **The remaining open rows on `docs/design-decisions-outstanding.md`.**
- **The reviewer session** has been idle since 14 September.

## Data and infrastructure

- **34 `healthkit_sync` consent rows on production**, recording consent for
  an integration removed from the product. Raise with the solicitor before
  deleting; they are evidence of what was agreed.
- **The region move**, Ireland (`eu-west-1`) to London (`eu-west-2`),
  rebuilt from migrations, clean, no synthetic data.
- **A full club onboarding by hand**, end to end through the interface.
  Never done. Not attempted this week.

## Legal and company — the only real gate on a pilot

None of this is code and none of it moves without Isabella.

- **The lawful basis question.** Six questions in
  `decisions/lawful-basis-open.md`. This is the single thing standing
  between Fydr and a real club.
- Form a limited company.
- ICO registration.
- The DPIA.
- The Children's Code assessment.
