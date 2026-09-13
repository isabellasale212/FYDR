# PATTERN-S10-final

Nutrition section, leaderboards, and the report shapes. Authoritative for those
three areas.

**Board numbering.** S9 is athlete consent and first run, folded into the
closing sweep with no folder of its own. S10 is this.

## What belongs here, and nothing is buildable from S10 until all three exist

| File | Where it comes from |
|---|---|
| `S10 revision Claude Design prompt.md` | The design manager. Copy across verbatim. |
| `notes.md` | The markdown notes Claude Design returns with the revised board. Save verbatim, do not summarise. |
| The board export | PNG or PDF of the revised board, frame labels legible. |

**Precedence, unchanged.** `notes.md` beats the Claude Code prompt, which beats
the persona review, which beats the walkthrough, which beats the specification.
A standing decision in `docs/decisions/` beats all five.

## Why this folder exists before its contents do

The report catalogue sat in the project rather than the repo for a day and the
builder wrote its own from the specifications. Anything built from S10 before
these files land is built from something the builder cannot read.
