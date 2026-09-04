# 17. Reports hub

## 1. Page name and URL

**Reports**, at `/reports`.

The way in to six reports. It holds no data of its own: it exists so that a coach
looking for "the medical one" reads six titles rather than remembering six
addresses.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | All six | Nothing | None | Base, with one card marked Premium | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | All six | Nothing | None | Same | Same |
| Medic | Yes | All six | Nothing | None | Same | Same |
| S&C | Yes | All six | Nothing | None | Same | Same |
| Nutritionist | Yes | Five. **The injury and availability card is withheld** | Nothing | The injury card entirely | Same | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This page uses a weaker guard than every report it links to.** The six reports
each require coach or medic; the hub requires only staff. The practical effect
today is that a person who can open the hub may be refused at every link on it.
Decision D-08.

---

## 3. How you get here

- Reports, the fourth item in the sidebar.
- The Compliance link on the dashboard's Outstanding entries card, which goes
  straight to one report rather than here.

---

## 4. What you see

**A header** naming the screen.

**Six cards**, each with a title, a sentence on what the report answers, and where
its numbers come from.

| Card | What it answers | Package |
|---|---|---|
| Compliance | Who has and has not submitted what was expected | Base |
| Injury and availability | Who is unavailable, why in limited terms, and when they are expected back | Base |
| Training report | How hard each session was against a typical one | **Premium**, and the card says so |
| Athlete report | Everything about one athlete over a period | Base |
| Squad weekly | The squad's week on one page | Base |
| Testing | Test results and personal bests | Base |

The Premium card is marked as Premium rather than hidden, so a club on the Base
package can see that the report exists and what it would give them.

---

## 5. Every number on this page

None. The hub displays no figures of its own.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Compliance card | The grid | Opens the compliance report | `/reports/compliance` | Nothing | Coach, medic, sport scientist, S&C, nutritionist | None | Never |
| Injury and availability card | The grid | Opens the injury report | `/reports/injuries` | Nothing | Everyone except the nutritionist | None | **Should be hidden from the nutritionist. Not built** |
| Training report card | The grid | Opens the training report | `/reports/training` | Nothing | As the report | None | Marked Premium on the Base package. **UNVERIFIED whether it is clickable there** |
| Athlete report card | The grid | Opens the athlete picker | `/reports/athlete` | Nothing | As the report | None | Never |
| Squad weekly card | The grid | Opens the squad weekly report | `/reports/squad` | Nothing | As the report | None | Never |
| Testing card | The grid | Opens the testing report | `/reports/testing` | Nothing | As the report | None | Never |

**Nothing on this page writes anything.**

---

## 7. How this page is built, in plain English

Built on the server. The six cards are a fixed list in the page itself, not a
database read, so the hub cannot fall out of step with what exists by showing a
report that has been removed.

The only thing it asks the server is the club's package, so it can mark the
Premium card.

---

## 8. States

**Loading.** Renders immediately.

**Empty.** Not possible. The six cards always exist.

**Error.** Not possible for the card list. A failure to read the package would at
worst mark the Premium card wrongly.

**No permission.** Athletes are redirected. A staff member with no report access
currently reaches the hub and is refused at the links. Decision D-08.

**Wrong tier.** The training report card is marked Premium.

**Offline.** Not handled.

---

## 9. Open issues

- **The hub uses a weaker guard than its own children.** Decision D-08.
- **The nutritionist should not see the injury card.** Decision D-01.
- **UNVERIFIED: whether the Premium card is clickable on the Base package**, and
  what a coach sees if it is. Files searched: `src/app/(staff)/reports/page.tsx`.
