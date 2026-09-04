# 25. Injuries

## 1. Page name and URL

**Injuries**, at `/injuries`.

The working list of injuries: what is open, who is affected, and what has been
reported but not yet assessed.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The injury list in the limited view. **Not the problem reports triage** | Nothing from the list itself | The eight clinical fields, and the triage panel | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Same | Nothing | Same | Base | Same |
| Medic | Yes | The list **and** the problem reports triage | Triage a reported problem | None | Base | The triage panel is medical only, enforced by the database (migration 0040) |
| S&C | Yes | Same as coach | Nothing | Same as coach | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This screen is not in the sidebar**, which is worth noting alongside the fact
that it currently admits every staff role.

---

## 3. How you get here

- A link from an injury named on another screen.
- A direct link.
- From the injury and availability report.

---

## 4. What you see

**A header** with the group filter and a print button.

**Problem reports awaiting triage. Medics only.** Things athletes have reported
that nobody has yet turned into an injury record or dismissed. A coach does not
see this panel at all, and its absence is not announced to them.

**The injury list**, one row per injury, in the limited view: athlete, body area,
side, onset date, status, and expected return.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| None | The count of open injuries | How many are not closed | Now | Zero is a good outcome and says so |
| None | Days since onset | How long this has been going on | Per injury | Blank without an onset date, which cannot happen: onset is required |

Nothing on this page is a calculated metric with a registry entry. It is a list.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the list | Stays here | Nothing. A cookie remembers it | Any staff today | None | Never |
| Print | Header | Opens the browser print dialogue | Stays here | Nothing | Any staff | Browser's own | Never |
| An injury row | The list | Opens that injury | `/injuries/[injuryId]` | Nothing | Any staff today | None | Never |
| Triage a problem report | Triage panel | Turns a reported problem into an injury record, or dismisses it | Stays here | Creates or updates records, and writes a note | **Medic only, enforced by the database** | Yes | The whole panel is absent for anyone who is not a medic |
| New injury | Header | Opens the create screen | `/injuries/new` | Nothing | Any staff today | None | Never |

**Why the triage panel is absent rather than disabled.** A coach seeing a greyed
out list of athletes' reported problems would already have learned something they
should not. Absence is the correct treatment here, unlike a Premium feature, where
hiding leaves a paying question unanswered.

---

## 7. How this page is built, in plain English

Built on the server.

The problem reports are read by a query the database restricts to medics
regardless of who asks. The page still avoids calling it for a coach, because an
empty triage panel rendered by mistake looks like a broken page even though no
data crossed the boundary. Two independent protections, the same pattern as the
clinical record.

---

## 8. States

**Loading.** Renders when ready.

**No open injuries.** Says so, as a good outcome.

**No problem reports awaiting triage.** For a medic, says so. For everyone else,
the panel does not exist.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected. **The nutritionist should be refused
and currently is not.**

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **No role gate at all.** This screen and three of its four siblings call only
  the staff guard. The fourth, New injury, is already medical only. Decision D-01,
  ranked highest.
- **Not in the sidebar.** A coach who has not been sent a link may not know it
  exists. **Decision D-34**: give the injuries area a sidebar row, or accept that
  it is reached only through the report.
