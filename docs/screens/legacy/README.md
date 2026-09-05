# Legacy screen documents

**Nothing in this folder is binding.** These 38 files predate the build
specification and describe what Fydr was intended to be at an earlier point.

**The binding specification is in `docs/screens/`, in the numbered files**:
`01-dashboard.md` through `62-import-gps.md`, in route order.

## Why these were kept rather than deleted

Three reasons, and the third is the one that matters.

**They carry reasoning the numbered files do not repeat.** Several record
decisions that were made, reversed, and made again, with the argument each time.
The numbered specifications state what the app should do; these often say why an
alternative was rejected.

**The code cites them by name.** `training-report.md` is named in the training
report's own source as the origin of its scoring model, including the four cutoffs
nobody can currently explain. `md-planner.md` is named as the source of six open
product questions the week template feature deliberately did not answer. Deleting
these files would orphan those references.

**They record open questions with identifiers.** Several carry numbered questions
in the form O-286, O-313, O-700 that the code refers back to. Those identifiers
appear nowhere else.

## Why they are dangerous to read as instructions

They contradict the current app in real ways. `dashboard.md` describes a Squad
state card that was removed on 4 September 2026 and folded into Ready for
Saturday, because the two were one fact rendered twice. Anyone following it would
rebuild the duplication deliberately.

Several also predate decisions recorded in `docs/decisions-required.md`, so they
describe a four role model that is no longer the agreed one.

## How to use them

**Read them to understand why something is the way it is.** Do not read them to
find out what the app should do.

If a legacy file and a numbered specification disagree, **the numbered
specification wins**, and the disagreement is worth raising: it may mean a
decision was recorded in one place and not the other.
