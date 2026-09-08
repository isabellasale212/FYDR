# My data

## 1. Where it sits

Tab 2 of 4. Route `/my-data`. File `src/app/(athlete)/my-data/page.tsx`, still
the largest screen in either app.

**Redrawn 8 September 2026** from the redesign reference (screens 03-08). §13
records what changed and the three destinations that had to be kept reachable.

## 2. Who reaches it and when

Every athlete, any time. Base package.

## 3. What you see

A page title, a **three-segment pill track — Wellness, Gym, Tests** — and that
tab's content. Below it a footer card of three rows reaching the destinations the
track no longer carries.

**TABS AND SEGMENTS ARE DIFFERENT LISTS.** Five `?tab=` routes still exist and
still render (`wellness`, `training`, `nutrition`, `testing`, `gym`); the bar
draws three of them. `SEGMENTS` is what the bar draws, `TABS` is the route
vocabulary, and `SEGMENT_DOMAINS` is derived from `SEGMENTS` so flag routing
cannot drift from the bar.

Each tab is a headline card over a list card, and every list shows a preview —
four readiness days, three of everything else — under a **"See all N ->"** link
that expands it in place via `?all=1`. There is no all-days, all-sessions or
all-tests page; the link is that route, not a new one.

The wellness region is a readiness line with a 14 day rolling mean, a plus or
minus 1 SD band, and (new) a filled area beneath the line, drawn per segment so a
missing day leaves a gap in the fill exactly as it leaves one in the line.

**`gps` and `compliance` flags still have no segment, and `training` and
`nutrition` join them.** All four fall through to the "Also noted for you" notice
above the tab content, which is shown whichever tab is open — so dropping two
tabs from the bar did not hide any flag. This was the failure mode worth
checking: leave a domain in `SEGMENT_DOMAINS` whose tab is no longer in the bar
and its flags are delivered to a tab nobody can open.

## 4. What the athlete enters here

**Nothing.** My data is read only.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-001 | Readiness | Their own readiness | Daily, charted | **A day with no entry is a gap, never a zero** |
| MET-006 | The shaded area and dashed line | 14 day rolling mean plus or minus 1 SD | 14 days | no band until there is history |
| MET-003 | Sleep | Hours slept | Daily | gap |
| MET-004 | Soreness | 1 to 5, 5 is none | Daily | gap |
| MET-028 | Test results | Their own results | All | empty |
| MET-029 | Personal best | **Best ever, not best in window** | All time | empty |
| MET-037 | Board position | Where they sit | Per board | board hidden |

**MET-029 carries a fixed bug worth knowing about.** Ordering by `test_date`
relabelled "best you have ever done" as "best in the last window", so an athlete
with a 41.6 all time best was shown 31.0 because that was their latest session
(`my-data/page.tsx:1118`). Fixed here. **Whether the staff surface had the same
error is UNVERIFIED.**

**No GPS figure is shown.** `gps_records_self_select` permits an athlete to read
their own GPS rows, and no segment renders them. So there is no tier leak, and
there is also no GPS for an athlete on any package.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A segment | Top | Switches tab | `/my-data?tab=` | nothing | no | never |
| See all N | List footer | Expands the list in place | `/my-data?tab=…&all=1` | nothing | no | the list is already whole |
| Sessions and RPE | Footer card | The training tab | `/my-data?tab=training` | nothing | no | never |
| Weekly check-ins | Footer card | The nutrition tab | `/my-data?tab=nutrition` | nothing | no | never |
| Leaderboards | Footer card | The board list | `/my-data/boards` | nothing | no | never |
| A logged gym session | Gym region | Opens the session | `/my-data/gym/[id]` | nothing | no | none logged |
| A past day | Wellness region | Opens that day's entry, read only | `/check-in?date=...` | nothing | no | no entry |

## 7. Offline and sync

Read only, so nothing is queued. **UNVERIFIED: what the screen shows with no
connection.**

## 8. Notifications

None open this screen. `athlete.compliance.weekly` is a weekly personal summary
in the catalogue, push only, **off by default**, and **minor floor off**. **Nothing in this codebase sends a push or an email.** There is no Expo push
credential, no APNs or FCM key and no email provider account, anywhere. The
preferences are stored for real; nothing dispatches against them.

## 9. Permissions

None.

## 10. States

**The period control is gone**, and with it every state only it could produce:
the coerced-period messages, the resolved date-range caption, and the `all`-window
anchor query. Windows are fixed constants now — `WELLNESS_WINDOW_DAYS` (14),
`OTHER_WINDOW_DAYS` (28), and Testing all-time as before. **This was the only
period control on the athlete surface**, so an athlete can no longer ask any
screen for a season or a year. Recorded here rather than left as a surprise: this
file and `docs/screens/my-data.md` both still specify a selector, and the screen
no longer has one.

Loading, empty (a new athlete with no history), error, offline, no group
membership. **UNVERIFIED: whether an athlete in no positional group is told why
their comparisons are empty.** The staff surface says so explicitly; the athlete
side was not found to.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

- `gps`, `compliance`, `training` and `nutrition` flags have no segment to land
  on and surface in the orphan notice instead.
- **UNVERIFIED:** empty-comparison copy. DECISION 13.
- **The readiness area fill reads as an artefact on short data runs** — a two-point
  segment becomes a detached sliver. Cosmetic, filed as 0g in the architecture
  to-do list; the geometry is correct and the gaps are real.
- **The specification and the screen now disagree about the period control**
  (§10). One of them should move; that is a decision, not a bug.

## 13. What the 8 September redesign changed

**The tab bar, six segments to three**, drawn as a segmented pill track — a
`--surf2` band with 4px of padding and the live segment as a solid accent-filled
pill. It previously scrolled horizontally, because the old reference drew three
segments and this build had six.

**THREE DESTINATIONS LEFT THE BAR AND WOULD HAVE LEFT THE APP.** The changelog
says Training, Nutrition and Leaderboards are "dropped from the tab bar (data
still exists in the app, just not surfaced as separate tabs here)". That sentence
was not true as drawn:

| Dropped | What was only there | If nothing replaced it |
|---|---|---|
| Leaderboards | The **only** route in to `/my-data/boards` from anywhere in the athlete app. `LeaveLeaderboardButton`'s `router.push` is a redirect after leaving a board, not a way to reach one. | Both board routes orphaned, including the GPS tier gate added the same day. |
| Nutrition | The only reader of weekly check-in history in the athlete app. `NutritionCheckinForm` also redirects to `?tab=nutrition` after a successful answer. | An athlete answers the weekly check-in and lands on a tab that no longer exists, and can never see a past answer. |
| Training | The only screen showing session and RPE history, now that Today's session list has gone in the same redesign. | No session history anywhere. |

So both dropped tabs stay live as routes, and a footer card (`md-more`) reaches
all three. **That card is the one thing on this screen the reference does not
draw.** Deleting it takes the three destinations with it.

**The period control removed** (§10).

**Other changes**: the readiness card's "▲ 6 on last week" moves from the accent
to `--good-text` — the reference draws it green, and `--good` is the product's
cyan-not-green positive colour, settled product-wide in `tokens.css`, so the
token was used rather than a new hex introduced; the mean line drops its trailing
date; the coverage caption under the chart is trimmed to the one sentence that is
not period residue ("Days you missed are left blank, never counted as zero" is
MET-001's defining property, not decoration); the gym list's caption reads
"tonnage from logged sets"; and `.rd-meta` may now shrink so a long standing line
wraps instead of being clipped — measured at 22.5px past the card edge on
"▲ 1.4 cm ahead of your recorded PB" at 390px.

**Shape.** `.md-seg` / `.md-seg-track` are the third and fourth entries in
`ATHLETE_PILL_EXEMPT`. Renamed from `.seg` / `.seg-track` because that list is
matched by substring and a bare `seg` would also have exempted `.lbw-segmented`,
`.sg-segment` and `.dash-stat-bar-seg` — two of them staff controls that must
stay at 6px.
