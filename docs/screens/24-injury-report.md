# 24. Injury and availability report

## 1. Page name and URL

**Injury and availability**, at `/reports/injuries`.

Who is unavailable, why in limited terms, when they are expected back, and where
injuries are happening.

**This is the report the nutritionist must not see.**

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything on this page. **The clinical record is not on it** | Nothing. Exports only | Diagnosis, mechanism, severity detail, tissue type, imaging, referral, clinical notes, treatment plan | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Same | Nothing. Exports only | The same eight | Base | Same |
| Medic | Yes | Same on this page, and the full record on an injury's own page | Nothing here | None, in the sense that nothing is withheld from them elsewhere | Base | Same |
| S&C | Yes | Same as coach | Nothing | The same eight | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT. This is the highest ranked gap in the whole specification.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/injuries/page.tsx:59`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Injury and availability card on the reports hub.

---

## 4. What you see

**The header is one template shared by all five reports** (and specified in
`CHANGELOG-headers-spec.md`). Five rows, always in this order:

1. **Back**, a pill at the top left, to the screen you came from.
2. **The group chips**, Whole squad first with a tick when it is active, then
   the club's own groups. The filter sits above everything now rather than over
   the table, which is the truth: it scopes every number on the screen.
3. **The eyebrow**, where the screen has one, on the left with the **actions**
   on the right.
4. **The title**.
5. **The scope subheading**, directly under the title: who this report covers,
   over what window, and how many athletes. It sits **below** the title rather
   than above it, which is a deliberate change from the canvas: a qualifier
   read before the thing it qualifies is just a string of words.
6. **The tabs** on the left with the **period control** on the right, so the
   control that scopes every tab rides the tab row rather than a row of its own.

**The gap from the header to whatever the screen puts first is 20px on every
one of the six**, set once on the header rather than on each screen's first
block, so they are equal by construction rather than by six numbers agreeing.

**Availability now**, split into available, modified, unavailable and unknown.
Unknown is shown rather than folded into one of the others, because an athlete
nobody has assessed is a different problem from an athlete who is fit.

**Per athlete rows**, with:

- **Availability**, the current status
- **What they can do**, the restrictions in the words whoever set them used
- **Expected back**, a date where one has been recorded
- **Days lost**

**New injuries**, and **new injuries by body area**, so a pattern in one site
becomes visible.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-013 | Available now, Modified, Unavailable, Unknown | The squad's availability split | Right now | **Unknown is its own count**, not folded into the others |
| None | Days lost | How many days an athlete has been unavailable | The period | Zero is a real answer |
| None | New injuries | How many were recorded in the period | The period | Zero is a real answer |
| None | By body area | Where injuries are happening | The period | An empty chart is a good outcome |

**Days lost and new injuries are counts, not calculated metrics**, and have no
registry entries.

**Everything on this page is the limited view.** Body area, side, onset, expected
return, status and restrictions. The diagnosis is not here and cannot be reached
from here.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff who can reach the page | None | Never |
| Group chips | Second row of the header | Narrows every number on the screen to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Same | None | Never |
| Period selector | Header | Changes the window | Stays here, period in the address | Nothing | Report access | None | A period the data cannot express is disabled with its reason |
| An athlete's name | A row | Opens that athlete | `/squad/[athleteId]` | Nothing | Report access | None | Never |
| An injury | A row | Opens that injury record | `/injuries/[injuryId]` | Nothing | Report access. **A medic sees more when they arrive** | None | Never |
| Download spreadsheet and PDF | Header | Download the report | Server routes | Record that the report was viewed | Report access | None | Never |

**The downloads carry the limited view too.** A coach's spreadsheet of this report
does not contain a diagnosis, because the underlying query never reads the
clinical table.

---

## 7. How this page is built, in plain English

Built on the server.

**The clinical table is not selected from, not joined to, and not reachable from
this page.** That is a stated contract in the query layer
(`src/lib/queries/availability.ts:12`), and beneath it the database refuses the
table to anyone who is not a medic regardless of what the app asks for.

So there are two independent reasons a coach cannot see a diagnosis here: the
query does not ask, and the database would not answer.

---

## 8. States

**Loading.** Renders when ready.

**Nobody injured.** Says so, as a good outcome, rather than showing an empty
table.

**Unknown availability.** Counted and shown separately, because it is an action
for somebody rather than a gap in the report.

**Error.** Surfaces as an error.

**No permission.** Redirected with a reason. **The nutritionist should be refused
here and currently is not.**

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist reaches this report today.** This is the single most
  important gap in the specification, because it is the one place where the agreed
  model makes visible information that must stop being visible. Decision D-01.
- **A duplicate of this report inside another report section was deliberately
  cut** (`src/app/(staff)/reports/injuries/page.tsx:53`). Recorded so it is not
  rebuilt.
