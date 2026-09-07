# My data

## 1. Where it sits

Tab 2 of 4. Route `/my-data`. File `src/app/(athlete)/my-data/page.tsx`,
**1,726 lines, the largest screen in either app.**

## 2. Who reaches it and when

Every athlete, any time. Base package.

## 3. What you see

**Five domains as regions of one page, not five screens**: wellness, gym,
testing, training and nutrition (`my-data/page.tsx:351`). Each is a segment on
the same page, reached by an anchor.

The wellness region is a readiness line with a 14 day rolling mean and a plus or
minus 1 SD band drawn around it.

**Two domains have no segment: `gps` and `compliance`** (`my-data/page.tsx:452`).
A flag in either of those domains has nowhere to land on this screen.

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
| A domain anchor | Top | Scrolls to that region | stays | nothing | no | never |
| A logged gym session | Gym region | Opens the session | `/my-data/gym/[id]` | nothing | no | none logged |
| Boards link | Wellness or footer | Opens the board list | `/my-data/boards` | nothing | no | on no boards |
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

Loading, empty (a new athlete with no history), error, offline, no group
membership. **UNVERIFIED: whether an athlete in no positional group is told why
their comparisons are empty.** The staff surface says so explicitly; the athlete
side was not found to.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

- `gps` and `compliance` flags have no segment to land on.
- **UNVERIFIED:** empty-comparison copy. DECISION 13.
