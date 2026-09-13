# Corrections to the design programme handover, 13 September 2026

The design programme handover written on 13 September is accurate about method
and about most of the boards. Eleven of its statements are out of date, several
by decisions made the same day. This file is the correction; the handover is
not the current source for any of the items below.

## Contradicted by decisions

| Handover says | Actually |
|---|---|
| "Sessions go live when created; no publish queue" (§4, §5) | PATTERN-S4 D1 **declined**. Publish stays. Every S4 row depending on D1 falls with it. |
| "The weekly nutrition check-in has two questions" (§5) | **Declined.** One question. |
| Entry form auto-advance, "a pause, then the next question scrolls into view" (§4) | **Declined**, with motion tokens. |
| "Apple Health is not offered until a native iOS app exists" (§4, §5) | **Removed from the product entirely.** There will be no native iOS app. See `docs/platform-decision.md`. |
| "for the pilot" throughout | Scope is **v1**, the complete product across free and premium. See `docs/decisions/scope.md`. |
| "The match report ships without played and minutes until the data exists" (§4) | Acceptable for a pilot, not for v1. Now a gap to close. |
| "Which three reports the pilot club needs in week one" (§11) | Obsolete. All of them ship. |

## Listed as open, actually closed

| Handover says | Actually |
|---|---|
| "§0ae, the last-admin guard is client-only. Apply it before the pilot" (§6) | **Closed.** Migration 0101 on production since 11 Sept; 0102 covers self-grant. |
| "The coach sees body site, protocol and stage" (§6) | **Half closed.** Protocol and stage are stripped at every query read for every viewer (`lib/restrictions.ts`). Body site and side remain open as PATTERN-S3 C8. |
| "Whether the coach sees body mass" (§11) | **Closed 12 Sept.** The coach does not see body mass at all, section as well as controls. |
| "Export logging does not exist" (§6) | **Wrong.** Exports are logged as `report.<type>.export`. What is missing is the row count on the audit row. |

## Stated as settled, actually undecided

§3 states that body site and side are not coach-visible, as a club setting
defaulting to off. That is the recommendation. It is still open on the decision
sheet as PATTERN-S3 C8 and is not a rule until Isabella rules.

## Right, and worth saying so

The handover names the prescription-on-logged-set question as the likeliest
migration in the whole programme. It was. That is migration 0111, written, on
scratch, deploying with the next release.

## What was kept from it

- §3 in full, as `docs/decisions/design-constitution.md`.
- §8 and §9, the precedence ladder and the two working habits, folded into
  `docs/README.md`.

The rest duplicates documents already in the repo that are more current.
