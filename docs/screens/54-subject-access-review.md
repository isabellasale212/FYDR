# 54. Clinical review

## 1. Page name and URL

**Clinical review**, at `/settings/subject-access/[requestId]/review`.

Where a medic checks the clinical part of a data pack before it is handed over.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Medic | Yes | The clinical part of the pack | Approve or amend what is released | None | Base | `src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx:19` |
| Sport scientist | **No**, and this is deliberate | Nothing | Nothing | The whole page | Base | Same line, plus the database refusing the clinical record to anyone who is not a medic |
| Coach, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same line |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This page is medic only, and enforced properly.** A staff member who is not a
medic is redirected back to the request list with a reason in the address, before
anything is read. Beneath that, the database refuses the clinical record to
anyone who is not a medic, so there are two independent protections as everywhere
else clinical data appears.

**An earlier draft of this specification recorded this page as unguarded.** That
was wrong, and the finding has been withdrawn. See the corrections section of
`docs/decisions-required.md`.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx:18`; a **medical** check at `src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx:19`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A request awaiting review, from the subject access list.
- Directly, which is the problem.

## 4. What you see

The athlete, the request, and the clinical records proposed for release, with
controls to approve or amend.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Approve the clinical part | The body | Marks it reviewed and ready for release | Back to the request | Updates the request, and audits it | Medic | Form submission | Should be absent for everyone else |
| Amend what is released | The body | Adjusts what the pack contains | Stays here | Updates the request | Medic | Form submission | As above |

## 7. How this page is built, in plain English

Built on the server. The clinical records come from the table the database
restricts to medics.

## 8. States

**Already reviewed.** Shown as done. **No clinical records.** Says there is
nothing to review and offers to make the pack ready anyway. **Error.** Surfaces as
an error. **No permission.** Redirected to the request list with a reason.
**Offline.** Not handled.

## 9. Open issues

- **None.** The access model on this screen is correct as built. Recorded
  positively, because an earlier draft claimed otherwise.
- One behaviour worth knowing: **every clinical record is included in a pack by
  default.** Withholding one is the exception, requires a reason, and is
  recorded.
