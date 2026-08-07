# ADR-004: Offline-first athlete data entry

## Status

**ACCEPTED.** 2026-08.

---

## Context

Athletes submit data in places with bad signal. Not occasionally, but as the normal case:

- Changing rooms, which are usually concrete, usually underground, and usually have no wifi
- Training grounds on the edge of towns
- Gyms in basements
- Team coaches on motorways
- Away fixtures where nobody has the wifi password

`00-product-overview.md` design principle 3 states it directly: offline is normal, not an edge
case. That principle is downstream of the commercial thesis. Compliance above 80% after four
weeks is a v1 success criterion. Median submission under 45 seconds is another. A spinner that
resolves after eight seconds on one bar of signal, or a red error toast that loses what was
typed, destroys both.

The failure mode is not that one entry is lost. It is that an athlete learns the app is
unreliable, stops trusting it, stops using it, and the club's dataset develops holes that make
every subsequent analysis untrustworthy. Compliance is a habit, and habits are broken by
friction far more easily than they are built by features.

There is a second reason. Almost every entry in Fydr is tied to a specific day.
`04-data-model.md` gives every entry table an `entry_date`. An entry that cannot be recorded
until signal returns is not merely delayed, it risks being attributed to the wrong day or
recalled inaccurately hours later. Same-day RPE recalled the next morning is a different and
worse measurement.

---

## Decision

**Athlete writes go to local SQLite first, always, and sync in the background. The network is
never on the critical path of an athlete action.**

Concretely:

1. Every athlete-authored entry is written to `expo-sqlite` with a **client-generated UUID v4**
   as its primary key, inside the same transaction that appends an operation to the `outbox`
   table.
2. The UI confirms immediately from the local write. It does not wait on the network and it
   does not show a network error, ever.
3. The entry appears in the athlete's own history immediately, marked pending.
4. A background sync engine drains the outbox with exponential backoff and jitter, batching up
   to 200 operations per request to a single `sync-push` Edge Function.
5. **Idempotency comes from the client-generated primary key.** A replayed operation produces a
   unique-violation, which the client treats as success. Duplicate entries are therefore
   impossible, not merely unlikely.
6. Nothing is ever removed from the outbox without either a server acknowledgement or an
   explicit user action. After ten failed attempts an operation is parked and surfaced on
   **Me → Sync status**, not discarded.
7. Reads needed to complete an athlete's day (today's schedule, outstanding expectations,
   current programme, own recent history) are cached locally and readable offline.

The full design, including the local schema, the push contract, conflict rules, and backoff
parameters, is in `05-architecture.md` §6.

### Scope boundary

Offline-first applies to the athlete write path and the athlete's daily read path. **The staff
shell of the same app is in scope for offline reads and for attendance, and nothing else.**
Staff having a phone app (confirmed 5 August 2026, roadmap Phase 2m) does not widen this
boundary: it is the write conflicts that are expensive, not the shell. It does **not** apply to:

| Surface | Why not |
|---|---|
| Staff programme, threshold, and schedule editing | Shared documents with multiple authors. Two coaches editing the same programme offline creates a merge conflict with no correct resolution, and resolving it wrong silently changes what 40 athletes are told to lift. |
| Staff web dashboard | Used at a desk. |
| Analytics, reports, exports | Server-computed over the full dataset. |
| Leaderboards, long history, squad views | Not needed to complete a day. |

The one staff exception is **attendance marking**, which is queued, because it happens
pitchside and is authored by one person about a specific session.

**This boundary is what keeps the cost bounded.** Athlete entries have exactly one author,
which means conflict resolution has a defensible answer for every case. Shared editable
documents do not, and building offline editing for them would multiply the cost of this
decision several times over for a use case nobody has asked for.

---

## Consequences

**Good:**

- Submission is instant regardless of connectivity, which protects the 45-second budget.
- Athletes never see a network error, so they never learn to distrust the app.
- Entries land on the correct day because they are recorded at the moment they happen.
- The queue survives app termination and device restart.
- Duplicate entries are structurally impossible, which matters because the alternative is an
  athlete's wellness appearing twice and skewing their own rolling baseline, which then
  miscalibrates every `personal_rolling` threshold for that athlete (`04-data-model.md` §10).
- Reads are instant on the Today tab because they come from local storage.
- The app is usable on the app-store demo path with no signal at all, which is a small but real
  sales advantage.

**Bad, and these are the price:**

- **Two sources of truth exist.** SQLite is authoritative for anything an athlete created until
  the server acknowledges it; the server is authoritative for everything else. Every screen
  showing athlete-authored data has to read from the right one. Getting this wrong produces
  entries that vanish on refresh, which is the worst possible bug in this product.
- **Roughly 3 weeks of initial build**, plus continuing cost. Rough allocation: local schema and
  DAO 3 days, outbox and sync engine 5 days, `sync-push` function and conflict rules 4 days,
  pending and parked UI states 2 days, offline test harness 3 days.
- **A permanent tax on every new entry type.** Adding a new athlete-authored entity means a
  local table, a local migration, an outbox entity type, a Zod payload schema, server handling,
  and conflict rules. Budget an extra day or two per entity, forever.
- **The device schema has its own migration chain**, running on hardware the developer cannot
  inspect, against data that may be the only copy. The rules in `05-architecture.md` §6 exist
  because a failed local migration that wipes and continues would destroy a week of an athlete's
  entries with no recovery.
- **Bugs are hard to reproduce.** "It worked offline and then the entry disappeared" is a
  report that arrives with no logs, from a device you cannot access, about a state that no
  longer exists. Mitigations: an in-app sync status screen showing the outbox contents, and
  structured Sentry breadcrumbs carrying operation identifiers and error codes but never entry
  values.
- **The test matrix grows.** Every entry flow needs testing online, offline, offline then
  reconnecting, offline across an app restart, offline across a token expiry, and offline with
  a device clock that is wrong.
- **Clock skew is a real problem.** `entry_date` comes from the device, because only the
  athlete knows which day they meant. A device set to the wrong date produces plausible-looking
  data on the wrong day. Bounded by rejecting dates in the future and dates more than 14 days
  past, and by logging skew above 10 minutes.
- **Reinstall loses the queue.** Documented and accepted (`03-flows.md` §10). Uninstalling with
  pending entries loses them. The alternative is server-side draft storage, which requires the
  network the athlete does not have.

---

## Alternatives considered

### 1. Online-only with a retry toast

Submit over the network, show a spinner, and on failure show "retry".

Rejected. It fails the 45-second budget on poor signal and puts recovery in the hands of the
athlete at the moment they are least willing to help: standing in a changing room, phone in one
hand, about to leave. Every retry toast is an opportunity to give up. In aggregate this is the
difference between 80% compliance and 50%, which is the difference between a product and a
dataset with holes in it.

### 2. Optimistic UI with an in-memory queue

Update the UI immediately, hold the pending write in React state, flush when the request
succeeds.

Rejected. It looks identical to the chosen design in the demo and loses data in production.
Killing the app, or iOS reclaiming it while backgrounded, discards the queue. That is common
behaviour: submit, lock the phone, put it in a bag, the app is killed, the entry is gone and the
athlete believes they submitted it. This is worse than an honest error, because the athlete
never learns the entry was lost and the coach sees non-compliance from someone who complied.

### 3. A sync framework: WatermelonDB, RxDB, PowerSync, ElectricSQL

Adopt a library that provides local storage and sync as a unit.

This is the most serious alternative and it was close. PowerSync in particular is built for
Postgres and Supabase, and would replace most of `05-architecture.md` §6.

| | Framework | Hand-rolled |
|---|---|---|
| Initial build | Roughly 1 week | Roughly 3 weeks |
| Conflict rules | Generic, usually last-write-wins, configurable to a point | Written per entity to match the domain rules in `03-flows.md` §7 |
| Fit to immutable entries (ADR-005) | Poor. These frameworks model mutable rows with updates and deletes. Fydr has inserts and revisions and no updates at all. | Exact fit. The outbox has no `update` operation. |
| Fit to RLS-scoped partial sync | Varies. Requires expressing sync rules a second time, alongside the RLS policies. | The pull query is a normal RLS-checked read. |
| Debuggability | Framework internals | Code that can be read |
| Ongoing dependency | Another platform to track, some with their own hosted service and pricing | None |
| Cost of a wrong abstraction later | High. Replacing a sync framework mid-life is a rewrite. | Incremental |

Rejected because Fydr's sync surface is unusually narrow: **insert-only, single-author,
append-only, with no updates and no deletes**. That is the easiest sync problem there is, and
these frameworks are built to solve the hard version. Adopting one would mean fighting its
mutable-row model to express an immutable one, expressing sync rules twice, and taking on a
dependency whose failure mode is a rewrite.

This should be revisited if the scope boundary above changes. If staff offline editing becomes
a requirement (O-14), the problem becomes genuinely hard and a framework becomes the right
answer.

### 4. Offline reads only, online writes

Cache aggressively for reading, require connectivity to submit.

Rejected. It solves the wrong half. Reading yesterday's data offline is pleasant. Recording
today's data is the product.

---

## Open questions

- **O-26**: Should an athlete be able to see that an entry is pending at all? A pending badge
  is honest, and it also invites "is it broken?" questions to the coach who cannot answer them.
  The alternative is showing the entry as submitted and surfacing failure only when it parks. I
  have specified a subtle pending indicator plus a sync status screen. Confirm that is the right
  balance.
- **O-27**: The 14-day backdating limit. Beyond it, entries are rejected as too old. That
  number is a guess. It is long enough to cover a fortnight without signal and short enough to
  stop retrospective bulk entry, which produces trend data that looks real and is not. Your
  judgement on the right figure.
