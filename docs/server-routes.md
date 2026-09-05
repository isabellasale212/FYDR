# Server routes

The 27 addresses in the staff app that are not screens. They produce files or
perform actions, and each one is a door with its own lock.

**Why this document exists.** The one real access breach in this app's history was
here. The training report's two download routes once answered a plain request with
the complete GPS board while the screen above them was correctly gated, because
the buttons were simply never drawn on the Base package. The lesson is recorded in
the code: **a hidden button is not a gate**
(`src/lib/session.ts:126`).

**The rule the specification states.** A download carries the same permission as
the screen it belongs to, without exception.

**This document verifies that rule route by route.** It is the check the screen
specifications assert and do not perform.

**Jargon, expanded once.** A *route* here is an address that returns a file or
performs an action rather than a page. A *guard* is the check the server runs
before doing either. An *audit row* is a permanent record of who did something and
when, kept so that access to named athlete data can be accounted for afterwards.

---

## The result, first

**All 27 routes are guarded. None is weaker than its screen. Two findings came
out of checking.**

| | |
|---|---|
| Routes | **27** |
| Guarded | **27** |
| Weaker than their screen | **0** |
| Writing an audit row | **23** |
| Respecting the group filter, where one applies | **12 of 14** |

**Finding one.** The two athlete report downloads do **not** read the group
filter, while the other twelve do. This is correct rather than a fault, and the
reason is in section 4.

**Finding two.** The retention preview writes no audit row, while the run does.
That is arguably wrong and is raised as decision D-45.

---

## 1. Report downloads: fourteen routes

Seven reports, each with a spreadsheet route and a PDF route.

| Route | Guard | Package | Group filter | Audit |
|---|---|---|---|---|
| `/reports/athlete/[athleteId]/export` | `requireReportAccess` | Base | See §4 | Yes |
| `/reports/athlete/[athleteId]/pdf` | `requireReportAccess` | Base, GPS regions gated | See §4 | Yes |
| `/reports/compliance/export` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/compliance/pdf` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/injuries/export` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/injuries/pdf` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/squad/export` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/squad/pdf` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/testing/export` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/testing/pdf` | `requireReportAccess` | Base | Yes | Yes |
| `/reports/training/export` | `requireReportAccess` **plus a package check** | **Premium** | Yes | Yes |
| `/reports/training/pdf` | `requireReportAccess` **plus a package check** | **Premium** | Yes | Yes |
| `/leaderboards/[leaderboardId]/export` | `requireStaff`, then coach or medical, **plus a package check** | Base, Premium for a GPS board | Yes | Yes |
| `/leaderboards/[leaderboardId]/pdf` | Same | Same | Yes | Yes |

**The training report's two routes carry the package check on the server.** That
is the fix for the breach described above, and it is present on both. Verified.

**What each does when refused.** A route cannot refuse by rendering something, so
it refuses with a status and a sentence. A person on the Base package asking for
the training report gets a **403** and plain text saying the club is on Basic,
rather than an empty file. 403 rather than 404 is deliberate: the club is
authenticated and the report genuinely exists, it is their plan that does not
include it, and saying so is what makes the upgrade conversation possible
(`src/lib/session.ts:139`).

**What each writes.** Nothing to the data. Each writes one audit row recording
that a named athlete report was viewed. **Reading a person's data is an auditable
act**, and a downloaded file is the strongest form of reading it: the file leaves
the building and every protection in this specification stops applying to it.

---

## 2. Testing downloads: two routes

| Route | Guard | Package | Audit |
|---|---|---|---|
| `/testing/[testDefId]/[athleteId]/export` | `requireReportAccess` | Base | Yes |
| `/testing/[testDefId]/[athleteId]/pdf` | `requireReportAccess` | Base | Yes |

One athlete's history for one test. Scoped to a named athlete, so no group filter
applies.

---

## 3. Action routes: eleven

These change something. They are ordered by what they can destroy.

| Route | Guard | What it does | Audit |
|---|---|---|---|
| `/settings/retention/run` | admin | **Permanently deletes athlete data** | Yes |
| `/settings/retention/preview` | admin | Shows what would be deleted. **Changes nothing** | **No.** See D-45 |
| `/settings/subject-access/[requestId]/release` | admin | Hands an athlete their complete data pack | Yes |
| `/squad/[athleteId]/subject-access` | admin | Opens a subject access request | Yes |
| `/settings/users/create` | admin | Creates an account, grants roles, links an athlete record, **sends an invitation email** | Yes |
| `/settings/users/bulk-invite/send` | admin | Creates accounts in bulk. **Sends nothing; returns temporary passwords** | Yes |
| `/settings/users/[userId]/mfa` | admin | Removes somebody's second factor | Yes |
| `/settings/exports/generate` | `requireReportAccess` | Produces an export file | Yes |
| `/settings/imports/upload` | `requireStaff`, coach or medical, **and Premium** | **Writes GPS records** | The import batch is the record |
| `/settings/imports/[batchId]/export` | Same | Exports what one import contained | Yes, as `import_batch.export` |
| `/settings/imports/template` | Same | Downloads a blank template. No athlete data | No, and correctly so |

**Every route marked admin moves to the sport scientist** under the agreed role
model. **This table is the checklist for that work**, which is gap G-02.

**Three of these deserve reading twice.**

**Retention run** is the only route in Fydr that permanently deletes athlete data.
Everything else soft deletes. It requires a confirmation in the request body and
refuses without one, and it is not all or nothing: categories are processed in
sequence and it returns on the first error, which is decision D-43.

**Subject access release** is irreversible in the way that matters. The data has
left.

**Bulk invite send** returns working credentials for members of the squad, which
the operator must then distribute themselves. Decision D-38.

**The import batch is its own audit row.** The upload route does not write to the
audit log, because creating an import batch already records the filename, who
uploaded it, when, and how many rows were accepted and rejected. That is a fuller
record than an audit row would be.

**The batch export writes a bespoke audit row rather than reusing the report
helper**, with the entity type `import_batch` and the real batch identifier. The
reasoning is worth preserving: GPS output is not clinical data but it is named
athlete performance data leaving as a file, and **an audit trail that mislabels
the entity is worse than a bespoke row**
(`src/lib/queries/gpsImport.ts:498`).

---

## 4. Why two routes do not read the group filter, and why that is right

Twelve of the fourteen report downloads resolve the group filter exactly as their
screen does, from the same cookie
(`src/app/(staff)/reports/squad/pdf/route.tsx:27`).

**The two athlete report routes do not, and should not.** An athlete report is
about one named person, chosen by identifier in the address. A group filter
narrows a list of athletes; it has no meaning once the athlete is named. Applying
it could only produce one outcome, which is an empty report for an athlete who
happens to sit outside the current filter, which would be a fault rather than a
feature.

**The athlete report's downloads do share their screen's period**, which was a
real defect and was fixed: asking for a season once exported 28 days and said
nothing about it
(`src/app/(staff)/reports/athlete/[athleteId]/export/route.ts:31`). Screen and
downloads now resolve the period through the same function, so they cannot
diverge.

---

## 5. The four sections a route specification needs

A route has no layout, so it needs four sections rather than the nine a screen
needs. Every route in this document has been checked against all four.

**What it produces, and whether it reads or writes.** A download reads. An action
writes. The distinction decides how carefully the rest must be read.

**Who can call it, and where that is enforced.** Named guard, and the exact file
and line. **Never the screen it is reached from**: the screen's button is not the
gate.

**What it does when refused.** A status code and a sentence. A route that refuses
with an empty file is worse than one that refuses loudly, because the reader
concludes the data is missing rather than that they are not allowed it.

**What it records.** An audit row, or a reasoned explanation of why none is
needed.

---

## 6. The rule, restated as a requirement

**Every new route must be added to this document before it ships.**

**A route's guard is the route's own.** It may never rely on the screen that links
to it, on a button not being drawn, or on the address being hard to guess.

**Any route that returns named athlete data writes an audit row.** The test is not
whether the data is clinical: it is whether a person could be identified from what
leaves.

**A route refuses with a status and a sentence**, never with an empty result.

---

## 7. Open items

**Decision D-45, new.** The retention preview writes no audit row while the run
does. A preview names exactly which athlete records are about to be destroyed, and
running it is how somebody would find that out without acting. **Recommendation:
audit the preview too.** Reason: it is one row, and the question "who looked at
what was about to be deleted" is exactly the kind an audit log exists to answer.

**UNVERIFIED: whether any route is reachable without a session at all.** Every one
checked here calls a guard that requires a signed in user, and the middleware sits
above them, but that has not been tested by hand against a route address with no
session. This is a Run level check as defined in `docs/verification-standard.md`,
and no route in this document has had one.
