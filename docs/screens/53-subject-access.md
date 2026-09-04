# 53. Subject access requests

## 1. Page name and URL

**Subject access requests**, at `/settings/subject-access`.

Requests from athletes to be given their own data, and the process for answering
them.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every request | Open, progress and release a request | None | Base | **Currently admin or medic**, `src/lib/session.ts:159`. Decision D-07 |
| Medic | Yes | Every request | Open and progress, and review the clinical part | None | Base | Same |
| Coach, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** here. An athlete makes a request, they do not administer it | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Two roles share this screen, and that is deliberate.** Answering a request means
gathering a person's whole record, including the clinical part, and only a medic
may read that. So the process needs both.

## 3. How you get here

- The Subject access link in the Settings administration block.
- Starting a request from an athlete's profile.

## 4. What you see

Every request with the athlete, when it was made, what stage it has reached, and
who is waiting on whom.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Days since the request | How long it has been outstanding | Since it was made | Cannot be blank |

**A subject access request has a legal deadline.** The count of days is not
decoration.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A request | The list | Opens it | Its review screen | Nothing | Sport scientist or medic | None | Absent for everyone else |
| **Clinical review** | A request | Opens the medical part for checking | `/settings/subject-access/[requestId]/review` | Nothing | **Medic** | None | See open issues |
| **Release** | A request | **Hands the athlete their data pack** | A server route | Marks the request released, and audits it | Sport scientist | **Yes** | Absent for everyone else |

**Releasing is irreversible in the way that matters**: the data has left. It is
audited for that reason.

## 7. How this page is built, in plain English

Built on the server. The release is a server route checking the permission again.

The pack itself is assembled from the athlete's records, with the clinical part
included only after a medic has reviewed it.

## 8. States

**No requests.** The normal state, and says so. **A request awaiting clinical
review.** Named as waiting on a medic, so it is clear who is blocking. **Error.**
Surfaces as an error. **Offline.** Not handled.

## 9. Open issues

- **This belongs to admin and medic today.** Decision D-07.
- **The clinical review screen is correctly gated to medics.** An earlier draft of
  this specification recorded otherwise; that finding has been withdrawn.
