# Pending builder queue

Messages agreed with Isabella but NOT yet sent to the builder. Send when the
current queue reports. Delete a section once it has been sent and acknowledged.

---

## URGENT, ahead of the current row: two defaults

**Agreed 13 September 2026. Send immediately, not with the next batch.** These
land in PATTERN-S8's settings and thresholds work, which is in the queue now.
Getting them right while those screens are written costs nothing; retrofitting a
default costs a migration and a data fix.

> Two defaults to get right while you are in the settings work, both from a
> Children's Code finding. Read `docs/decisions/lawful-basis-open.md` first.
>
> One. **Under-18 and academy athletes are excluded from ranked boards and from
> streak mechanics by default.** This is a rule and a query change, not a
> redesign, and it does not reopen the design freeze. Age is derivable from
> `athletes.date_of_birth`. The `leaderboard_visibility` value already exists in
> the `consent_purpose` enum from migration 0002, with
> `parental_consent_recorded_at`, `parental_consent_recorded_by` and
> `parental_consent_method` beside it, so the opt-in path exists if a guardian
> ever uses it. Default is excluded. Report first what the current behaviour is:
> does an academy athlete appear on a ranked board today without anyone opting
> them in?
>
> Two. **Reminders default off, for everybody.** Not just minors. Push on iOS
> already needs an install and an explicit permission grant, so nobody receives
> anything unasked regardless; making the stored default match that reality
> satisfies high-privacy-by-default at no cost. Check what
> `notificationPreferences` currently defaults to and report before changing it.
>
> Also add to the sheet, do not build: **no field anywhere records that a medic
> is a registered practitioner.** That gap decides whether the health care
> Article 9 condition is available, which decides the wording of the consent
> flow. Isabella's, with a solicitor.

## RPE: club setting, one tap, 0 to 10
**Agreed 13 September 2026. To be sent when the S7/S8 queue reports.**

> RPE stays. Removal was considered and rejected. Three changes, and read
> `docs/decisions/decision-batch-2026-09-13.md` for the full entry.
>
> One, RPE becomes a club setting. When it is off, every dependent surface says
> so rather than showing an empty column or a zero: training report, compliance
> figure, dashboard attention card, effort leaderboards, analytics.
>
> Two, the prompt becomes one tap on Today rather than a bottom sheet. The scale
> sits on the row itself. It is one number and the sheet is why compliance is
> hard.
>
> Three, the scale becomes 0 to 10, matching CR-10. All production data is
> synthetic so there is no back-conversion: widen the constraint, change the
> control and the labels, and record in the migration that earlier rows were
> written on a 1-to-10 scale.
>
> Before touching any of it, run a sweep for every place an RPE value is tested
> for truthiness rather than for null. Zero is falsy and zero is now a real
> rating meaning rest. Report what the sweep finds before changing it. This is
> the part most likely to introduce a silent defect.

## Also waiting to be queued

- Match participation: starters, who came on, minutes each. Nothing else.
  Decide with the fixture-to-match-session question, same root.
- The tier gate moves to the database, subject access read path as a written and
  tested exception.
- The training report split: GPS board stays as the premium training report with
  its own definition sentence; the RPE-load report is built as a seventh for
  every club. NOTE: this interacts with the RPE club setting above, so send the
  two together.
