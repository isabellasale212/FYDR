# Pending builder queue

Messages agreed with Isabella but NOT yet sent to the builder. Send when the
current queue reports. Delete a section once it has been sent and acknowledged.

---

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
