# Persona review — STAFF-COACH-08, -09, -10 and -11

**Persona.** The head coach, planning next week on a Saturday evening after the match,
and adjusting a session pitch-side an hour before it starts.

**Account.** Mark Iremonger (`m.iremonger@`, coach only), port 9502; Jane Pemberton for the
identity check. **Reviewed 2026-09-12** at **1280×900 and 375×812**. Nothing published:
the draft path was exercised in the grid's local state only (a wizard draft added, removed,
storage confirmed empty afterwards); the group filter was returned to Whole squad.

**Method for "identical".** The two create forms were fingerprinted for both accounts at
both widths and diffed; Edit mode, the selected-session panel and the remove confirmation
were driven for both accounts at 1280 and compared field by field.

---

## STAFF-COACH-08 — Create a session

**Identical, verified.** `/schedule/new`: 25 leaves, 21 controls, 904px / 1,198px, no
difference at either width. Duration `required`, "Choose at least one group." on submit —
the §0ah / §0ai closures hold for the coach. **At 375 no control is under 44px.**

**The toolbar's "+ Session" (the wizard) is the coach's pitch-side path**, and it works on
a phone: the three-step card opens at the top of the rail (267px from the top of the page,
in view), the seven type chips and "Next" at 44px, "✕ Discard this session" 44×44; step 2's
day chips and the four steppers (`Earlier` / `Later` / `Shorter` / `Longer`) at 38×44;
step 3's "Add to Sunday" at 44. The name and location inputs are still unlabelled (§0aj,
open).

**After "Add to Sunday" the coach is left looking at nothing.** The draft lands in the
grid (block at 1,480px) and the selected-session panel opens with "Remove session",
"Duplicate" and the preview "Publishes to Backs · appears under Today on the morning of
Sunday 13 Sept" — **at 3,636px**, with the page still at scroll 0. The banner "1 change not
yet in the athlete app" is at 644px, so it is also off-screen when the wizard was near the
top. On a phone the add is silent (§0aw, design).

**A half-filled wizard does not survive a reload.** The draft is written to sessionStorage
on every step (`71035f5`), but reopening `/schedule` restores edits, additions and
removals and not the open wizard — the stored `newDraft` is there and nothing shows it;
the next "+ Session" starts over. Small (§0aw).

## STAFF-COACH-09 — Create a fixture

**Identical, verified.** `/schedule/fixtures/new`: 20 leaves, 16 controls, 904 / 1,114px,
no difference; no sub-44 control at 375. Nothing coach-specific — a fixture names nobody
and reaches every athlete, as the form says, which is exactly the thing a coach should read
before pressing "Create fixture".

## STAFF-COACH-10 — Edit a session in the grid

**Identical, verified** at 1280: the same six blocks, the same panel facts ("Duration",
"Group", "What the athlete sees", "MD-5", **"RPE due from 11:30"** — the §0aj fix, live),
the same steppers (38×40 at desktop), the same actions (group chips, "Duplicate"), the same
2,511px page.

**Where the panel is.** The document says the panel "opens in the right-hand rail". At
1280 `.sg-panels` sits **below the grid at 1,644px** (static, full width); clicking a block
at the top of the page opens a panel the coach cannot see without scrolling. At 375 it is
at 3,364–3,636px. Corrected in the document; a design question for the pitch-side case
(§0aw).

**On the day, after the match, every block is past.** The current week's six sessions
all precede the moment of review (Saturday evening), so Edit mode offers "Duplicate" alone
on each of them and next week is empty. The coach's Saturday job — build next week — is
"+ Session", "Week templates" and "Duplicate", and Duplicate is the one that starts from
what worked. Persona note for the brief; not a defect.

**The phone title bar's group label goes stale.** Pressing "Forwards" in the chip row
updates the chips and the URL (`?groups=…`) and the page; the shell's title bar still reads
"Schedule · Whole squad" until the next navigation — measured twice, both directions
(§0aw, defect). And a "Back" button renders on `/schedule`, a bottom-bar root, above the
chip row: on a phone a root screen with a back button is a small contradiction the shell
build inherited from every page's `.back-btn` (§0aw, design).

## STAFF-COACH-11 — Remove a session, and restore it

**The draft path, as the coach at 375:** "Remove session" on the wizard's draft → "Remove
this draft? It was never published, so there is nothing to undo." (the `b2062d3` copy,
live) with "Yes, remove" (`.sg-btn-remove`) and "Never mind" (`.btn-ghost`) **both 44px**
(were 37 / 44) → the draft vanishes, no ghost, no Restore, the banner returns to "The
athlete app is up to date", the pending store is empty. **The published-session ghost
path was not re-exercised** — it needs a session published for the purpose, which is a
write; SS-11 verified it on 2026-09-11 and nothing in the coach's permissions differs.

---

## Summary for design

1. **The add is silent on a phone**: after "Add to {day}" the confirmation panel is
   3,000px below the wizard that just closed. *(Design, §0aw.)*
2. **The panel below the grid at 1280** — 1,644px down, not a right-hand rail; the
   document corrected. *(Design, §0aw — the same finding at both widths.)*
3. **Title bar group label stale after an in-page filter change.** *(Defect, §0aw;
   shell.)*
4. **"Back" on a bottom-bar root screen.** *(Design, §0aw; shell.)*
5. **The open wizard is not restored on reload** though its draft is stored. *(Defect,
   small, §0aw.)*
6. **Right and worth keeping:** the wizard at the top of the rail on a phone, everything
   in it at the floor; the draft-remove copy; the fixture form's "names nobody" note;
   "Duplicate" as the Saturday-evening tool.
7. **Deliberate boundaries:** none new — the coach holds `SESSION_EDIT` and the four
   flows are the sport scientist's.

## Claims checked

| Claim | Verdict |
|---|---|
| 08, 09, 10, 11 identical to the sport scientist | **Identical** by fingerprint (08, 09, both widths) and by driven comparison (10, 11 at 1280). |
| 10: the panel "opens in the right-hand rail" | **Below the grid** at 1280 (1,644px) and at 375 (3,364px). Corrected. |
| 10: steppers "40px" | 38×40 at 1280; **38×44 at 375** since `6a2f1d4`. Corrected. |
| 10: Expects line | **"RPE due from 11:30"** — `5f68cb6` live. |
| 11: "Yes, remove" 37px | **44px at 375** since `6a2f1d4`; the draft copy is `b2062d3`'s. Corrected. |
| 08: wizard inputs unlabelled | **Still unlabelled** (§0aj third bullet, open). |
