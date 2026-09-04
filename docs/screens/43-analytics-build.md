# 43. Build an analytics view

## 1. Page name and URL

**Build a view**, at `/analytics/build`.

Chooses what an analytics view contains.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The builder | Build and save a view | None | **Premium** | Route guard, then a package gate |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-02 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT** |
| S&C | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

## 3. How you get here

- The build control on Analytics.

## 4. What you see

The measures available, each with a description of what it is and where it comes
from, the period, and the cohort.

## 5. Every number on this page

None until a view is built. The measures offered are those in the registry.

**One description shown here is wrong.** The note against readiness claims it
matches the database calculation. It does not, and the next sentence of the same
note correctly describes the stricter behaviour
(`src/lib/analyticsBuilder.ts:120`). Decision D-22.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Measure chooser | The body | Picks what the view contains | Stays here | Nothing until saved | Sport scientist | None | Measures whose data does not exist are absent |
| Period and cohort | The body | Bounds the view | Stays here | Nothing until saved | Same | None | Never |
| Save | Foot | Writes the view | Analytics | Creates a saved view | Same | The form is the confirmation | Disabled while saving |

## 7. How this page is built, in plain English

Built on the server. The list of measures is fixed in code rather than read from
the database, so the builder cannot offer something the code cannot compute.

## 8. States

**Base package.** Refuses. **Saving.** Disabled and says so. **Offline.** The
connection sentence.

## 9. Open issues

- **Every staff role reaches this today.** Decision D-02.
- **The readiness description is incorrect.** Decision D-22.
