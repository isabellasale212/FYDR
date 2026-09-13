# Lawful basis: OPEN, and it gates the first club

**Raised 13 September 2026 by the design manager, while scoping S9. Not a design
question. Nobody involved is a lawyer, including the advisory chat, and nothing
here is legal advice.**

## The problem

S9 was scoped as a consent flow. **Consent may be the wrong lawful basis.**
Under UK GDPR consent must be freely given, and an athlete in a squad where the
coach picks the team cannot realistically refuse. That is the same
power-imbalance reasoning that makes employee consent unreliable. A consent
screen an athlete cannot decline gives a club the appearance of compliance
without the substance, which is worse than nothing because it is documented.

**Likely correct shape**, to be confirmed: legitimate interests for the
performance data, explicit consent only where genuinely required, and refusal
having no effect on selection and visibly saying so.

## Three things that make it bigger than the board

**Health and injury data needs an Article 9 condition, not just a lawful basis.**
Explicit consent is one condition. Another is processing for health care
purposes by or under the responsibility of a health professional bound by
confidentiality. Fydr has a medic role, clinical data separated at the database
and medic-only at every read. **If that condition applies, the clinical boundary
already built stops being good practice and becomes the compliance mechanism.**
Put this to the solicitor specifically.

**The Children's Code probably applies.** The squad includes a 16-year-old and
an Academy group. The ICO's Age Appropriate Design Code applies to services
likely to be accessed by children: fifteen standards covering defaults,
profiling, data minimisation and nudge techniques. Separate exercise from the
consent question, and the largest compliance surface nobody has examined.

**A DPIA is probably mandatory.** Special category data, plus children, plus
systematic monitoring of individuals. It is a document, and it is what an ICO
conversation opens with.

## Consequences already agreed

- **S9 is drawn to work under EITHER lawful basis**, so the legal answer can
  arrive without a redraw. Wording placeholders change; the frames do not.
- **A guardian route is a separate path, not a variant of the adult one.** S9 is
  six frames: the under-18 route is frame 4, install teaching is frame 6.
- **Withdrawal must exist somewhere.** A consent that cannot be withdrawn is not
  consent. A row on an existing settings screen, named in the S9 notes so it
  actually gets built.
- **If the answer is legitimate interests, somebody must write a legitimate
  interests assessment.** A document, not a screen, and the piece most likely to
  be discovered late.

## Verified against the code, 13 September 2026

**No professional registration field exists anywhere.** Searched migrations and
`src/lib` for registration number, HCPC, GMC, NMC, professional body,
qualification, practitioner. Nothing. So the health care Article 9 condition
cannot be relied on as things stand, and the basis falls back to explicit
consent. Adding the field is cheap insurance; whether it unlocks the condition
is a solicitor question.

**The data model already anticipated the Children's Code.** Migration `0002`
carries a `consent_purpose` enum whose values are `healthkit_sync` and
**`leaderboard_visibility`**, plus `parental_consent_recorded_at`,
`parental_consent_recorded_by` and a `parental_consent_method` enum. Its own
comment says granular consents exist because the Children's Code work in
`04-data-model.md` §17.16 assumes a set of granular revocable consents, and a
comment at line 117 records that the legitimate-interests-versus-consent
question was known and deliberately left unresolved. **The shape exists. What
was missing is the default.**

## Two defaults, decided by Isabella 13 September 2026

**Under-18 and academy athletes are excluded from ranked boards and from streak
mechanics by default.** A rule and a query change, not a redesign, so it does
not reopen the design freeze. The `leaderboard_visibility` consent purpose
already exists if a guardian ever opts one in. Reasoning: ranking a named
sixteen-year-old at twenty-ninth for not filling in a wellness form is the
Children's Code detrimental-use standard, and streaks, leaderboards and badges
are its named examples under nudge techniques.

**Reminders default off, for everybody.** Push on iOS already requires an
install and an explicit permission grant, so nobody receives anything unasked
regardless; making the stored default match that reality satisfies
high-privacy-by-default at no cost.

**Both are urgent rather than important**, because PATTERN-S8's settings and
thresholds work is in the build queue now and retrofitting a default costs a
migration.

## Two more decisions, 13 September 2026 (Isabella)

**Both guardian consent methods are built, not one.** `parental_consent_method`
is an enum, and an enum exists because more than one method was always
anticipated. So the question was never web page or offline: it is which methods
a club may use and what each one records.

- Build a **guardian contact field captured at invite**, and a **tokenised
  guardian page with no account** (S9 artboard 4B, structurally close to
  artboard 1).
- **Keep admin-recorded offline consent as one value of the enum.** A club that
  can reach guardians by email gets the stronger evidence; a club that cannot
  still has a lawful route.
- **The record says which method was used.** That distinction is precisely what
  a regulator asks about, and redrawing 4B as offline-only would throw away a
  capability the model was built to carry.

Note the schema comment currently reads "There is no parent login." That stays
true: the guardian page is tokenised and accountless, not a login. Update the
comment when the field lands so it does not read as a contradiction.

**The consent record splits in two now, and only the certain half is named.**
O-951 proposes renaming `consent_given_at` and `consent_version` to
`notice_acknowledged_at` and `notice_version`, on the view that the basis is
legitimate interests. Renaming after a club has signed does not just cost a
migration: it changes what the stored records claim an athlete did. But the
right name depends on an answer that does not exist yet, and guessing it means
renaming twice.

- **Split into two records, one for performance data and one for health data**,
  as the S9 board's two blocks require.
- **Name the health record now.** Health and injury data needs explicit consent
  under Article 9 whatever the performance basis turns out to be, so a health
  consent field can be named truthfully today.
- **Hold the performance record's name** until the solicitor answers.
- **Hard rule, enforceable and free today: no real athlete account is created
  until that name is settled.** There are no real accounts yet, so this costs
  nothing now and cannot be complied with later.

## Two not-active states that must never render the same

Folded into S9 open question 4, which already touches every figure in the staff
app. An athlete with **no asserted date of birth**, who cannot be activated, and
an athlete who has **declined**, both sit in a squad and both drop out of every
denominator. They mean opposite things: one is a club administrative gap, the
other is an exercised right. If they render alike, a coach chases the wrong
person.

## Why the under-18 defaults matter more than they looked

`activation_blocked_reason` has one value, `under_13`. The Children's Code
applies to everyone under 18. Between 13 and 18 the only protection in the model
today is the parental consent record, so the exclusion of under-18s from ranked
boards and streak mechanics is what fills that gap. It now has
`athletes.date_of_birth` and `dob_asserted_at` to key off. Already with the
builder.

## What to take to a solicitor

1. Lawful basis for performance data, given the coach-player power imbalance.
2. The Article 9 condition for health and injury data, and specifically whether
   the health care condition applies given the medic role and the existing
   clinical separation.
3. Controller or processor: is Fydr the processor and the club the controller,
   or are they joint controllers. This shapes every other document.
4. Under-18s: the guardian route, and whether the Children's Code applies.
5. Whether a DPIA is required, and who writes it.
6. The DPA template handed to every club.

**Free, and worth doing first:** the ICO's published guidance on lawful basis,
on children's data, and their DPIA screening checklist. Reading them turns a
three-hour engagement into a one-hour one.

## Status

**OPEN. On the critical path, ahead of S9 and therefore ahead of the first
club.** Isabella's, with a solicitor.
