# Architecture Decision Records

A record of every decision that would be expensive to reverse, why it was made, and what it
costs. The purpose is not documentation for its own sake. It is so that in eight months,
when something is painful, the reason it was chosen is recoverable and the alternatives are
already costed.

`CLAUDE.md` §1 applies: if you are about to contradict an ADR, stop and say so rather than
quietly building the other thing.

---

## Format

Each ADR is one file, `adr-NNN-short-slug.md`, with exactly these sections:

| Section | Contains |
|---|---|
| **Status** | One of the values below, plus the date and who decided |
| **Context** | The forces at play. What is true that makes this a decision rather than an obvious choice. |
| **Decision** | What was chosen, stated in the active voice, with enough specificity to build from |
| **Consequences** | What follows. Good and bad. The bad ones are the reason the document exists. |
| **Alternatives considered** | What else was on the table and why it lost, with real numbers where they exist |

Open questions arising from an ADR are numbered `O-nn` and appear at the end of the file.
The numbering is **global across the whole document set**, not per file, so an open question
can be referenced unambiguously from anywhere.

### Status values

| Status | Means |
|---|---|
| `PROPOSED` | Written up, not yet agreed |
| `ACCEPTED` | Agreed. Build to it. |
| `CONTESTED` | The client and the developer currently disagree. The ADR states both positions honestly and names the recommendation. Building continues in the direction that keeps both options open. |
| `SUPERSEDED by adr-NNN` | Replaced. Kept in place, never deleted. |
| `DEPRECATED` | No longer relevant, and nothing replaced it |

**A `CONTESTED` ADR is not a blocked ADR.** Where a decision can be deferred without cost,
it is deferred and the code is kept compatible with both outcomes. ADR-001 was the case in
point and it is now `ACCEPTED`: one pooled database, `org_id`, row-level security, with the
per-client escape hatch withdrawn. **No ADR is currently contested.** A document that still
carries an "if per-client is adopted" branch is out of date, not cautious.

---

## Index

| ADR | Title | Status | Reversibility |
|---|---|---|---|
| [001](adr-001-multi-tenancy.md) | Multi-tenancy model | **ACCEPTED**, 5 Aug 2026. Pooled, `org_id`, RLS. Escape hatch withdrawn. | Pooled → per-client is cheap. Per-client → pooled is expensive. |
| [002](adr-002-react-native-expo.md) | React Native with Expo for the mobile app | ACCEPTED | Moderate. A rewrite, but a bounded one. |
| [003](adr-003-supabase.md) | Supabase as the backend platform | ACCEPTED | Moderate. Postgres is portable; auth and realtime are not. |
| [004](adr-004-offline-first.md) | Offline-first athlete data entry | ACCEPTED | Low cost to remove, high cost to add later |
| [005](adr-005-immutable-entries.md) | Immutable entries with revisions | ACCEPTED | Very hard to reverse once data exists |
| [006](adr-006-programme-override-model.md) | Programme overrides rather than copies | ACCEPTED | Hard. Changes the meaning of stored programmes. |
| [007](adr-007-clinical-data-separation.md) | Clinical data in a separate table | ACCEPTED | Hard, and reversing it is a compliance regression |

---

## When to write one

Write an ADR when a choice satisfies any of these:

- Reversing it later would take more than a week
- It constrains the schema, the authorisation model, or the data an athlete owns
- Two reasonable engineers would disagree
- It was contested by the client, whichever way it landed
- It has a recurring cost (money, operational time) rather than a one-off cost

Do not write one for library choices with no data or security implication, naming
conventions, or anything reversible in an afternoon.
