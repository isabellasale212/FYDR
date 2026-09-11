# STAFF-SS-01: build the staff dashboard and the phone shell

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"STAFF-SS-01 · FINAL"** in `docs/designs/staff-ss-01-final/`, with `notes.md` beside it. It supersedes every other dashboard design.

- Use `notes.md` for exact tokens and sizes.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Before anything else: §0ae

The last-admin guard only runs in the browser. Any sport scientist can remove their own role at the database, and a club can lock itself out. Apply the database trigger you filed for §0ae first, and prove it: try to remove the last sport scientist role directly at the database and show it's refused.

## Prerequisites

- The new design system and kit components are in code.

## Step 1. Report before building

Answer each from the code. Wait for my reply before Step 2.

1. **Flags:** what makes a flag "above a threshold" today? Are thresholds stored per club, with who set them and when? If not, what's needed?
2. **Flag counting:** is an open flag one per athlete, or one per athlete per metric per day? When does a flag close?
3. **Reasons:** is an unavailability reason marked clinical or non-clinical? Is the role gate on reasons enforced server side, under RLS?
4. **Group filter:** do flag counts and the availability denominator recompute server side when a group is selected?
5. **Week strip:** does it start on Monday club-local, or roll from today?
6. **Fixture range:** how far ahead counts as "Ready for {matchday}"? The board assumes 14 days.
7. **Role access:** list what each role (sport scientist, coach, medic, S&C, nutritionist) can see and do on the dashboard today.
8. **Reminders:** does "Send a reminder" for missing check-ins exist? If not, what's needed?

## Step 2. The phone shell (§0af)

- Below 768px: a fixed bottom bar with Dashboard, Squad, Schedule, plus a fourth slot by role (Flags for sport scientist, coach and medic; Gym for S&C; Nutrition for nutritionist), plus More.
- More opens a sheet with the remaining sections and Log out, 52px rows.
- A 64px title bar with the page name and the active group chip. Content starts right below it.
- Desktop sidebar (1024px and up) and the 64px rail (768 to 1023px) stay as they are.
- Every tap target on a phone at least 44px, including athlete names and Log out.
- All icons neutral, accent when active. No gold.

## Step 3. The dashboard

- **Lead card:** "Ready for {matchday}" with counts, then Doubtful (warn tone card) and Ruled out (bad tone card), each athlete with status and restriction. With no fixture in range, the week card leads instead.
- **Reasons:** only the medic sees the reason. Clinical reasons sit under "Medical · visible to medical staff". Non-clinical reasons (e.g. Academic) are shown to the medic without that label. Every other role sees status and restriction only.
- **Summary cards are toggles:** the stat is the button text, with the written state ("Closed · opens a list" / "Open · showing the list") and `aria-expanded`.
- **Needs attention:** counts athletes, not flags. Each row: name, reading in plain words, evidence line. Wellness readings first, then load. Two columns on desktop. Zero reads "No one flagged today".
- **Thresholds line** on every attention panel: "Thresholds set by {name} · {date} · Change ›". Use the same stored date everywhere.
- **No judgement words:** never "at risk", "fatigued", "improving".
- **Not checked in:** ordered by mornings in a row, "Not submitted", last entry date, "Send a reminder" (only if it exists, per Step 1).
- **Week strip:** six days with MD labels. Hidden on a heavy morning and for S&C.
- **Flags badge** in the navigation counts the same athletes as the attention card. Hidden at zero.
- **Role versions:** build the S&C (four toggles, gym and weigh-ins) and nutritionist (two toggles) versions as drawn, then check each role against its walkthrough section and report any difference.

## Everywhere

- Missing values in words ("Not submitted"), never 0 or 0%.
- Tabular figures for all numbers.
- No new tokens.

## Verify

- §0ae: the refused database call.
- Screenshots of every board frame on the real build: desktop at 1440×900, phone at 375×812.
- The dashboard signed in as each of the five roles, showing what each can and can't see.
- A group filter applied, with counts changing.
- The phone shell with content starting at the top.

Commit one step at a time.
