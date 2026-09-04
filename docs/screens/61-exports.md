# 61. Exports

## 1. Page name and URL

**Exports**, at `/settings/exports`.

Generates a data export for the club.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The export options | Generate an export | None | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | The export options | Generate an export | None | Base | Same |
| Medic | Yes | The export options | Generate an export | None | Base | Same |
| S&C | Yes | The export options | Generate an export | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**This screen uses the report guard**, so an administrator holding no other role
cannot reach it. That is deliberate: an export is named athlete data.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/settings/exports/page.tsx:23`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Exports link in Settings.

## 4. What you see

What can be exported, and the controls to choose scope and period.

## 5. Every number on this page

None displayed. The export contains whichever metrics the chosen scope includes.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Scope and period | The body | Choose what the export covers | Stays here | Nothing until generated | Report access | None | Never |
| **Generate** | Foot | Produces the file | A server route | **Nothing is changed, but the export is audited** | Report access, checked again on the server | None | Never |

**An export leaves the building.** Once generated it is a file on somebody's
computer, outside every protection in this document. That is why it is audited and
why the report guard applies.

**The clinical record is not in any export produced here**, because the queries
behind it never read that table.

## 7. How this page is built, in plain English

Built on the server. Generating is a server route that checks the permission
again and records who exported what.

## 8. States

**Nothing to export.** Says so. **Generating.** The control is disabled and says
so. **Error.** Surfaces as an error and no file is produced. **Offline.** The
connection sentence.

## 9. Open issues

- **The nutritionist should not reach this.** Decision D-01.
- **Resolved, and the behaviour is correct.** The export takes the group scope
  from the request and reports back both the athlete count and the group label it
  used (`src/app/(staff)/settings/exports/generate/route.ts:74`, `:21`), so an
  export matches what the coach was looking at and says so on the file.
