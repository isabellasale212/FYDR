# 29. Team allocation

## 1. Page name and URL

**Team allocation**, at `/injuries/team-allocation`.

Which athletes are in which team for the week. A selection screen, sitting in the
injuries area because availability is what constrains it.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The board | View, edit, publish | The eight clinical fields | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The board | View, edit, publish. **Selection is the coach's** | The same eight | Base | Same |
| Medic | Yes | The board | **View only.** A medic decides who is available, not who is picked | None | Base | **NOT BUILT** |
| S&C | Yes | The board | **View only** | The same eight | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing until it is published, and then in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- A link from the injuries area. **Not in the sidebar.** Decision D-34.

## 4. What you see

A header with the group filter and the week. A board of teams with the athletes
allocated to each, each carrying their availability so an unavailable player
cannot be picked by accident. A count of unpublished drafts, and a **Publish this
week** button naming that count.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-013 | Availability beside each name | Whether they can play | Now | Unknown |
| None | Draft count on the publish button | How many changes are unpublished | The week | Zero, and the button says so |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the board | Stays here | Nothing | Any staff today | None | Never |
| Week navigation | Header | Moves a week | Stays here | Nothing | Any staff | None | Never |
| Move an athlete between teams | The board | Reallocates them | Stays here | Writes a draft allocation | Coach and sport scientist | None | Should be hidden from view only roles. **Not built** |
| **Publish this week** | Header | **Discloses the whole week's selection to the athletes at once** | Stays here | Publishes every draft in the week | Coach and sport scientist | The count in the label is the warning | Absent when there is nothing to publish |

**Publishing is the consequential act on this screen.** Until it happens, changes
are drafts and no athlete sees them. Publishing reveals the entire week in one
step, which is why the button names how many drafts it is about to disclose
(`src/components/PublishWeekButton/PublishWeekButton.tsx:12`).

## 7. How this page is built, in plain English

Built on the server, which reads the teams and the week's board. The board runs in
the browser. Publishing is a single write covering the week.

## 8. States

**Empty.** A club with no teams sees an empty state. **Nothing to publish.** The
button is absent rather than disabled. **Error.** Surfaces as an error, and a
failed publish leaves the drafts intact. **No permission.** Athletes redirected.
**Wrong tier.** Not applicable. **Offline.** Not handled.

## 9. Open issues

- **No role gate.** Decisions D-01 and D-06.
- **Publishing has no confirmation step beyond the count in the button label.**
  Given it discloses a week of selection to the whole squad and cannot be
  un-disclosed, **decision D-36**: add a confirmation naming what is about to
  become visible.
