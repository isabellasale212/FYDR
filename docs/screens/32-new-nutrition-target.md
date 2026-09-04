# 32. New nutrition target

## 1. Page name and URL

**New nutrition target**, at `/nutrition/new`.

Creates a nutrition rule and chooses who it applies to.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a rule | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-03 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| S&C | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| Nutritionist | Yes | The form | Create a rule | None | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/nutrition/new/page.tsx:15`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The create control on the Nutrition screen.

## 4. What you see

**Who it applies to**: the whole club, a group, or one athlete. The most specific
wins where several could apply.

**The rates per kilogram**: protein, carbohydrate, fat and fluid.

**An optional energy cap**, which clamps the derived total and never sets it.

**A reason**, recorded so a later reader knows why the rule exists.

**Create and Cancel.**

## 5. Every number on this page

The rates entered here become MET-031 to MET-035. This screen displays no
calculated figures of its own, though it may preview what the rule would produce.

**The database refuses rates outside sane bounds**: protein 0.5 to 4 grams per
kilogram, carbohydrate 1 to 14, fat 0.2 to 3, and an energy cap between 800 and
10,000 kilocalories. These are not guidance, they are enforced
(`supabase/migrations/0039_nutrition_rules.sql:99`).

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Scope chooser | Top | Club, group or athlete | Stays here | Nothing until submitted | Nutritionist and sport scientist | None | Never |
| The four rate fields | Middle | Set the rule | Stays here | Nothing until submitted | Same | None | Never |
| Energy cap | Middle | Sets an upper limit on the derived energy | Stays here | Nothing until submitted | Same | None | Never |
| Reason | Lower | Records why | Stays here | Nothing until submitted | Same | None | Never |
| **Create** | Foot | Writes the rule | Back to Nutrition | Creates one rule. **It does not by itself change any athlete's target** | Nutritionist and sport scientist | The form is the confirmation | Disabled while saving |
| Cancel | Foot | Abandons | Back to Nutrition | Nothing | Same | None | Never |

**Creating a rule and applying it are two acts.** A rule that has been created but
not assigned changes nothing an athlete sees.

## 7. How this page is built, in plain English

Built on the server; the form runs in the browser. The bounds above are checked by
the database whatever the form allows.

## 8. States

**Saving.** The button is disabled and says so. **Out of bounds.** The database
refuses and the form says which field. **Error.** The form stays, filled in.
**No permission.** Every staff role currently reaches it. **Offline.** The
connection sentence.

## 9. Open issues

- **Every staff role can create a nutrition rule.** Decision D-03.
- **UNVERIFIED: whether the form shows the sane bounds before submitting**, or
  only reports them after the database refuses. Files searched:
  `src/app/(staff)/nutrition/new/page.tsx`.
