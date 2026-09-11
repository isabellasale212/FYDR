# STAFF-SS-01 · FINAL: notes

Board: 8 desktop frames at 1440 × 900 (nothing below the fold) and 6 phone frames at 375 × 812. One club-local instant: Mon 7 Sept 2026, 07:40 Europe/London, match Sat 12 Sept v Colthorne RFC, squad of 30.

**Two corrections made after review** (not on the board): the thresholds date must be the same everywhere (the board shows "24 Aug" on attention panels and "31 Aug" on the quiet morning), and a non-clinical reason such as "Academic" must not sit under the "Medical · visible to medical staff" label.

## The shell decision (§0af)

Below 768px the sidebar becomes a bottom bar of four plus More. Dashboard, Squad and Schedule are fixed; the fourth slot follows the role. The remaining sections and Log out live in a More sheet at 52px a row. A 64px title bar carries the page name and the group chip, so content starts at y = 64 instead of y = 2209. The 214px sidebar at 1024+ and the 64px rail between 768 and 1023 are unchanged.

## What changed, and on which token

### Pattern

**The matchday card is the one emphasised card.** The lead keeps "Ready for {matchday}" with doubtful and ruled out. No other dashboard card may take the emphasised treatment. With no fixture inside 14 days the week card takes the emphasis and the matchday card is absent, not empty.
`--blue-100 + 1px --blue-200 + --shadow · --t-section / --w-black / --t-section-tracking · counts --font-num / --t-num-stat / --w-num-strong / tabular-nums`

**Doubtful and ruled out are tone-family cards, not stripes.** Warn for doubtful, bad for ruled out, each with its own foreground at full opacity. Same treatment approved for Modified and Unavailable on ATH-ADULT-02. The 3px bar is retained only for the first row of a dense list.
`--pill-warn + 1px --warn + --on-warn / --on-warn-meta · --pill-bad + 1px --bad + --on-bad / --on-bad-meta · --border-accent-w 3px`

**A summary card is a button and says which state it is in.** The stat stays the button text. Closed: `--surf2` well, ▸, "Closed · opens a list". Open: white fill, accent border, ▾, "Open · showing the list". The written state is what `aria-expanded` announces.
`closed --surf2 + 1px --border · open --surf + 1px --accent · --shadow + --r · state --t-caption / --w-semi · min-height --touch-min`

**Attention counts athletes and names them; the flag total is a footer.** "5 athletes", never "72 open flags". Each row: name, the reading in plain words, then the dates and values. On desktop the rows run two columns so every named athlete stays on the first screen. Zero reads "No one flagged today" as the button text.
`name --t-num-row / --w-bold · reading --t-body-sm · evidence --font-num / --t-num-caption / --faint · footer --t-num-body / --muted above --hair`

**No metric is high priority by default; the club sets the thresholds.** Every attention panel closes with "Thresholds set by Jane Pemberton · 24 Aug · Change ›", linking to where they are set. The footer count reads "none above a club threshold". Wellness readings lead the list and load readings follow, so ACWR stays available as a reading without leading a heavy morning.
`footer --t-body-xs / --muted with --accent link · no new token`

**No row states a diagnosis or a judgement.** Measurement, direction, sample. ▲ ▼, en dashes for ranges, minus signs for negatives. Nothing says fatigued, at risk or improving.

**Status and restriction for everyone; the reason only for the medic.** Data rule 6 applied literally. "Ruled out · Alex Grant (Academic)" loses its bracket for every role but the medic, who gains one reason line per name under "Medical · visible to medical staff", the sentence the athlete reads on ATH-ADULT-02. Non-clinical reasons (Academic, personal, work) are shown to the medic without the Medical label.
`reason --t-caption / --on-warn or --on-bad inside the tone card · eyebrow --t-eyebrow / --t-eyebrow-tracking`

**Missing check-ins order by run length and say "Not submitted".** Who, how many mornings in a row, last entry date, "Send a reminder". Never 0 or 0%; the denominator drops instead. (data rule 1)

**The gym glyph is neutral, like every other icon.** `--text` in the sidebar, `--muted` in the More sheet, `--accent` when active. Highlight gold stays available for gym content, not for navigation.

**The fourth phone slot follows the role.** Flags for sport scientist, coach and medic; Gym for S&C; Nutrition for the nutritionist. Whatever takes the slot leaves the More sheet and Flags joins it, so all nine sections stay reachable in exactly one place.
`bar --tabbar-bg + --bar-blur + --tabbar-pad · ph regular 24px · --t-pill · sheet --r-sheet + --shadow-raised over --scrim`

**Everything tappable is at least 44px on a phone.** Fixes the measured 34px names and 17px Log out at the shell, not per screen. Sheet rows 52px.
`--touch-min`

**The Flags badge counts the same athletes as the attention card.** 2 on a normal morning, 5 on a heavy one, absent rather than 0 on a quiet one.

### Screen-specific

**The week strip yields on a heavy morning, and for S&C.** The only element that gives way. The week is one sidebar row away, the five names are not.

**S&C runs four toggles, the nutritionist two.**
`repeat(4, minmax(0, 1fr))`

**The medic's flag count sits in the panel meta, not the footer.** The medic's lead card is the tallest, so the remainder moves up one line.

**Group filter bar and chips unchanged.** On a phone only the active chip appears, at 44px.

## Needs new token

Nothing. Three near-misses resolved on existing tokens: the staff bottom bar is the athlete tab bar one column wider; the More sheet is `--r-sheet` over `--scrim`; the disclosure chevron would have needed a transform duration the motion set does not carry, so the glyph swaps ▸/▾ and nothing animates.

## Open against code

1. What counts as above a threshold, and who can set them? The board shows club-owned thresholds with an owner and a date; the review reports only the count.
2. Is an open flag one per athlete, or one per athlete per metric per day? "70 other open flags" is honest for rows, wrong for athletes.
3. Does a flag close by itself, and when?
4. Is an unavailability reason stored with a clinical or non-clinical marker? "Academic" is a reason but not medical detail.
5. Is the role gate on the reason field enforced server side? The last-admin guard was client-only (§0ae).
6. Does the group filter recompute flag counts and the availability denominator server side?
7. Does the six-day strip start Monday club-local, or roll from today?
8. How far ahead is a fixture "in range"? The board uses 14 days as a placeholder.
9. What is the availability denominator when an athlete has no status? The board shows "27 of 30 · 3 not recorded" rather than counting them available.
10. Can the nutritionist act on the sections they can navigate to? If not, those rows belong at the gated treatment.
11. Are Dashboard, Squad and Schedule the right three fixed tabs? Navigation counts would settle it.

## Caveat

The five role PDFs carried one line of text each and no readable body content, so the role frames come from the review plus data rule 6. All names, counts and readings are illustrative except the figures the review measured.
