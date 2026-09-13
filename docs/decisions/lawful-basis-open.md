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
