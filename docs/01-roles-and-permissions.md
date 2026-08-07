# 01. Roles and Permissions

Authorisation is the area of Fydr most likely to cause real harm if it is wrong: leaked
medical information, one club seeing another club's squad, an athlete seeing a teammate's
injury. Treat this document as normative.

**Implementation rule**: roles are resolved server-side from the authenticated session and
enforced by Postgres row-level security. Client-side checks exist only to hide UI elements
the user cannot use. Never rely on them for access control.

---

## 1. The four roles

### Athlete

The subject of the data. The largest user group and the one whose experience determines
whether the product works at all.

**Can:**
- Submit their own wellness, nutrition, gym, and training entries
- View their own complete history across every domain
- View their assigned programmes and today's prescribed work
- View their own test results and trend over time
- View their own availability status and any restrictions placed on them
- View leaderboards they appear on, including other athletes' names and the ranked metric
- Report a problem or injury concern to medical staff
- Edit their own profile: name, contact details, notification preferences
- Export their own data

**Cannot:**
- View any other athlete's wellness, nutrition, gym, GPS, or medical data
- View squad-level dashboards, flags, analytics, or reports
- View their own clinical injury notes written by medical staff (see §4)
- Modify a submitted entry (they create a correcting revision instead)
- Modify their own availability status
- Modify thresholds, programmes, groups, or the schedule
- See anything belonging to another organisation

### Coach / S&C

The primary paying user. Builds the training and gym plan, monitors the squad, acts on
flags.

**Can:**
- Everything an athlete can do for their own account, if they also have an athlete profile
- View all athlete data in their organisation across wellness, nutrition, gym, training,
  GPS, testing, and compliance
- View the injury dashboard at **availability level**: available / modified / unavailable,
  expected return date, and any training restrictions
- Create, edit, and assign programmes; create general programmes and tailor them per athlete
- Create and manage groups
- Create and manage the schedule, sessions, and fixtures
- Set and edit thresholds that raise flags
- Acknowledge and resolve flags
- Log test results on behalf of athletes
- Build and save analytics views
- Generate and export reports
- Enter data on behalf of an athlete, recorded with provenance `staff_entered`

**Cannot:**
- View clinical diagnosis, treatment notes, or medical history
- Set or change availability status (medical decision: see §4)
- Manage billing or organisation settings
- Invite, deactivate, or change the role of a user
- See anything belonging to another organisation

### Medical / Physio

Owns athlete availability and the clinical record. Has strictly more access in one domain
and less in others.

**Can:**
- Everything Coach / S&C can, in read-only form, for context
- Create and edit injury records including diagnosis, mechanism, body area, severity,
  treatment notes, and rehabilitation plan
- Set and change athlete availability status: the only role that can
- Assign rehabilitation programmes
- Set return-to-play milestones and clearance
- View the full clinical history of any athlete in the organisation
- Export medical reports

**Cannot:**
- Edit training or gym programmes owned by coaching staff
- Manage billing, users, or organisation settings
- Delete an injury record (it is closed, never deleted)
- See anything belonging to another organisation

> **Design note**: some clubs will have one person who is both coach and physio. Roles are
> additive per user, not exclusive. A user holding both roles gets the union of both
> permission sets. Do not model this as a fifth role.

### Admin / Club owner

Manages the organisation. Deliberately has *less* data access than staff by default.

**Can:**
- Invite, deactivate, and reassign roles for users
- Create and manage groups and squad structure
- Manage organisation settings: name, timezone, sport, season dates, branding
- Manage the subscription tier and billing contact
- View compliance rates and usage statistics in aggregate
- Configure data retention and run erasure requests
- View the audit log
- Export organisation-wide data

**Cannot, by default:**
- View individual athlete wellness, nutrition, gym, GPS, or medical detail

> **Rationale**: the club chairman does not need to read a player's sleep scores. An admin
> who also needs squad data should additionally hold the Coach role. This is a deliberate
> friction: it makes data access an explicit grant rather than a side effect of paying the
> invoice.

---

## 2. Permission matrix

`Y` = full access · `A` = aggregate or availability level only · `S` = own data only ·
`no` = no access

| Capability | Athlete | Coach/S&C | Medical | Admin |
|---|:--:|:--:|:--:|:--:|
| Submit own wellness/nutrition/gym | Y | Y | Y | Y |
| View own history | Y | Y | Y | Y |
| View other athletes' wellness | no | Y | Y | no |
| View other athletes' nutrition | no | Y | Y | no |
| View other athletes' gym logs | no | Y | Y | no |
| View other athletes' GPS | no | Y | Y | no |
| View other athletes' test results | S | Y | Y | no |
| View leaderboards | Y | Y | Y | A |
| View squad dashboard | no | Y | Y | no |
| View flags | S | Y | Y | no |
| Acknowledge/resolve flags | no | Y | Y | no |
| Set thresholds | no | Y | no | no |
| View injury, availability level | S | Y | Y | A |
| View injury, clinical detail | no | no | Y | no |
| Create/edit injury record | no | no | Y | no |
| Set availability status | no | no | Y | no |
| Create/edit schedule and sessions | no | Y | Y | no |
| Create/edit programmes | no | Y | Y | no |
| Assign programmes | no | Y | Y | no |
| Assign rehab programmes | no | no | Y | no |
| Log test results for others | no | Y | Y | no |
| Build custom analytics | no | Y | Y | no |
| Generate reports | S | Y | Y | A |
| Export data | S | Y | Y | Y |
| Manage groups | no | Y | Y | Y |
| Invite/manage users | no | no | no | Y |
| Manage org settings | no | no | no | Y |
| Manage billing | no | no | no | Y |
| View audit log | no | no | no | Y |

---

## 3. Athlete self-visibility

An athlete sees their own data in full, with two carve-outs.

**Carve-out 1, clinical notes.** An athlete sees their availability status, restrictions,
expected return date, and rehab programme. They do not see the physio's free-text clinical
notes. Those are working notes, and physios will stop writing honestly if athletes read
them.

**Carve-out 2, staff flags.** A flag raised on an athlete is visible to that athlete
*after* a staff member has acknowledged it, not at the moment it fires. An athlete should
learn "your sleep has dropped for four days, we've adjusted your load" from a coach, not
from a red badge at 6am.

> **Open question O-2**: should carve-out 2 be configurable per organisation? Some clubs
> favour full athlete transparency. Defaulting to delayed visibility, configurable later.

---

## 4. Medical data handling

This is the highest-risk area in the product. Under UK GDPR, health data is special
category data and requires an Article 9 lawful basis on top of the Article 6 basis.

**The rule**: coaching staff see *what an athlete can do*. Medical staff see *why*.

| Field | Coach sees | Medical sees | Athlete sees |
|---|:--:|:--:|:--:|
| Availability status | Yes | Yes | Yes |
| Expected return date | Yes | Yes | Yes |
| Training restrictions | Yes | Yes | Yes |
| Body area affected | Yes | Yes | Yes |
| Injury mechanism | No | Yes | Yes |
| Diagnosis | No | Yes | Yes |
| Clinical notes | No | Yes | No |
| Treatment record | No | Yes | Partial |
| Imaging and referrals | No | Yes | Yes |

Implementation: clinical fields live in a separate table (`injury_clinical`) from the
non-clinical injury record (`injuries`) and the availability event log (`availability`),
with distinct RLS policies. Do not put them in one table and filter columns in the
application layer, that is one careless `select *` away from a breach. See
`04-data-model.md` §9 for the authoritative table names and
`decisions/adr-007-clinical-data-separation.md` for the reasoning.

### The concussion exception, unresolved

Rugby is a special case and the blanket rule above does not survive contact with it. World
Rugby's Graduated Return To Play protocol is **operationally shared by design**: a coach has
to know a player is in GRTP and which stage, because it dictates what that player may do on
which day. "Head injury, cannot train" is not enough to plan a week around.

But concussion is a diagnosis, and the rule above says coaches never see a diagnosis.

Three ways out, none free:

1. **Treat GRTP stage as a restriction, not a diagnosis.** The coach sees "return-to-play
   protocol, stage 2 of 6" and the restrictions it implies, never the word concussion or any
   clinical detail. This is what the mockup now does and it is my recommendation.
2. **Carve out concussion explicitly**, on the basis that it is a mandated safety protocol
   rather than private clinical information. Defensible, and it opens the door to the next
   carve-out.
3. **Leave the rule absolute** and accept that coaches work around it by asking the physio,
   which means the product is not the source of truth for the thing rugby cares most about.

> **Open question O-995**: which of the three? This is a rugby-specific decision and it needs
> a physio's view, not mine. It was found by building a mockup, where the availability list
> read "concussion, GRTP stage 2" to a coach, which the rule above forbids and which every
> real club does anyway.

Full treatment in `09-security-and-compliance.md`.

### There is no parent or guardian role

Added 5 August 2026, when the client confirmed under-18 athletes are in scope. It belongs here
because "who can see this athlete's data" is this document's question and the intuitive answer
for a child is wrong.

**A parent or guardian gets no login and no view.** The four roles are the four roles. A parent
who wants to know something asks the club, and the club answers as controller. Reasoning, and the
counter-argument, in `09-security-and-compliance.md` §4.7, in short:

- A holder of parental responsibility exercises rights *on behalf of* a young child. As the child
  matures, the child's own rights take precedence, and by the mid-teens the ordinary UK position
  is that a competent child exercises them personally. A permanent parent view would be wrong for
  most of the age range Fydr serves. `[medium, this is the greyest point in the security document
  and it needs the solicitor drafting the terms to confirm it]`
- A parent login would need its own permission model, its own medical-access answer, and its own
  abuse case, which is a family the club knows nothing about.
- Where a club requires parental involvement before a minor turns on an optional extra, that is a
  club process recorded by an admin, not an account (`screens/onboarding.md` step 6).

**Where a club or a parent is involved in a child's account, the child is told.** Standard 11 of
the Children's Code requires it, and Fydr implements it as a standing statement in the Me tab
rather than a one-off screen at onboarding. Monitoring a child without their knowledge is the
outcome this rule exists to prevent, and a coach seeing a wellness score is monitoring.

O-962 asks whether a parent role is ever wanted. My position is no, and it is a permission-model
question rather than a screen, which is why it is recorded here as well as there.

---

## 5. Groups and scoping

Groups filter *views*, they do not restrict *access*. A coach with squad-wide access who
filters to "Forwards" still has permission to view the backs; they have simply chosen not
to.

> **Open question O-3**: do you need group-restricted staff, an academy coach who can only
> ever see academy athletes? This is a meaningful additional complexity (access-scoping
> groups vs view-filtering groups) and I have assumed **no** for v1. Confirm.

---

## 6. Cross-organisation isolation

Absolute. There is no legitimate cross-organisation read in Fydr. Every RLS policy begins
by matching `org_id` against the organisation on the authenticated session's claims.

A user belongs to exactly one organisation in v1. Multi-org users (a physio contracting to
three clubs) are a Phase 3 concern and are explicitly out of scope now.

**Testing requirement**: an automated test suite must attempt, for every table, to read
another organisation's rows as each of the four roles, and assert zero rows returned. This
suite runs in CI and blocks merge on failure. It is the only test suite that is mandatory.

---

## 7. Impersonation and support access

Support staff (you) may need to see a client's data to debug. Build this properly or it
will happen through a shared password.

- A `platform_support` role exists outside the organisation model
- It grants time-limited, explicitly-granted read access to one organisation
- Every access is written to the audit log with the reason
- The organisation's admin is notified by email when it is used
- It never grants access to clinical detail fields

> **Open question O-4**: acceptable to defer support access to Phase 3, or needed at
> launch? Defaulting to Phase 3.
